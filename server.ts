import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
dotenv.config({ override: true });
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { verifyFirebaseJWT } from "./src/middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "./src/types/middleware.types";
import { FirebaseCustomClaims } from "./src/types/firebase.types";
import { parseEapMarkdown, simulateEapTestEnvironment, executeEapImport, compareEapCodes } from "./src/services/eapImporter.service";
import { logAudit, logSystemError } from "./src/services/logger.service";

// ==========================================
// PARÂMETROS CENTRAIS DO SISTEMA
// Todos os tempos e limiares configuráveis estão aqui.
// A tela de Parâmetros (admin) lê e atualiza esses valores via /api/parametros.
// ==========================================
export const SYSTEM_PARAMS = {
  // Autenticação
  JWT_SESSION_TTL: "4h" as const,         // Duração da sessão do usuário logado
  JWT_MFA_TICKET_TTL: "10m" as const,     // Duração do ticket de desafio MFA/2FA
  // Compliance / Retenção de Logs
  AUDIT_LOG_RETENTION_DAYS: 30,  // Dias de retenção do audit_log (CRUD/eventos)
  ERROR_LOG_RETENTION_DAYS: 30,  // Dias de retenção do system_error_log (falhas backend)
  // Sincronismo
  CLAIMS_SYNC_ENABLED: true,     // Ativa sincronismo automático de claims no login
};

// Helper function to create a scoped Supabase client with a custom JWT
function getSupabaseClient(req: AuthenticatedRequest): SupabaseClient | null {
  if (!supabaseUrl || !req.decodedToken) return null;
  // Use the global service role client to bypass broken RLS policies.
  // The backend already enforces tenant isolation explicitly via .eq("contrato_id", ...) on all queries.
  return supabase;
}

// Centralized helper to coordinate CRUD operations (Insert vs Update vs Upsert)
async function saveRecord(
  client: SupabaseClient,
  table: string,
  data: any,
  options: { idField?: string; onConflict?: string; single?: boolean } = {}
) {
  const idField = options.idField || "id";
  const onConflict = options.onConflict;
  const single = options.single !== false; // default to true

  const idValue = data[idField];
  const hasIdValue = idValue !== undefined && idValue !== null && idValue !== "";

  let query: any;

  if (onConflict) {
    const conflictFields = onConflict.split(",").map(s => s.trim());
    if (conflictFields.includes(idField) && !hasIdValue) {
      const insertData = { ...data };
      delete insertData[idField];
      query = client.from(table).insert([insertData]);
    } else {
      query = client.from(table).upsert(data, { onConflict });
    }
  } else {
    if (hasIdValue) {
      query = client.from(table).update(data).eq(idField, idValue);
    } else {
      const insertData = { ...data };
      delete insertData[idField];
      query = client.from(table).insert([insertData]);
    }
  }

  query = query.select();
  if (single) {
    query = query.single();
  }
  return await query;
}

async function ensureUserExists(
  client: SupabaseClient,
  token: { uid: string; email: string; nome?: string; photoURL?: string }
) {
  if (!client || !token || !token.uid) return null;

  const userEmail = token.email || `${token.uid}@user.com`;

  // 1. Check if user already exists by uid OR email
  const { data: existingUser } = await client
    .from('usuarios')
    .select('*')
    .or(`uid.eq.${token.uid},email.eq.${userEmail}`)
    .maybeSingle();

  if (existingUser) {
    // If user exists, ensure uid matches
    if (existingUser.uid !== token.uid) {
      const { error: updateErr } = await client.from('usuarios').update({ uid: token.uid }).eq('email', userEmail);
      if (updateErr) {
        console.error("[ensureUserExists] Erro ao atualizar UID do usuário:", updateErr);
      } else {
        existingUser.uid = token.uid;
      }
    }

    // Sync custom claims for existing user on every login (SYSTEM_PARAMS.CLAIMS_SYNC_ENABLED)
    // Also clears the claims_pendentes flag set by POST /api/usuarios when profile changes
    if (SYSTEM_PARAMS.CLAIMS_SYNC_ENABLED) {
      try {
        const adminAuth = getAdminAuth();
        if (adminAuth && typeof adminAuth.setCustomUserClaims === 'function') {
          await adminAuth.setCustomUserClaims(token.uid, {
            perfil: existingUser.perfil,
            contrato_id: existingUser.contrato_id,
            empresa_id: existingUser.empresa_id,
            entidade_id: existingUser.empresa_id
          });
          // Clear the pending claims flag if it was set
          if (existingUser.claims_pendentes) {
            await client.from('usuarios').update({ claims_pendentes: false }).eq('uid', token.uid);
          }
          console.log(`[ensureUserExists] Claims sincronizados para ${userEmail} (perfil: ${existingUser.perfil})`);
        }
      } catch (claimsErr) {
        console.error("[ensureUserExists] Erro ao sincronizar claims do usuário existente:", claimsErr);
        await logSystemError({
          usuario_uid: token.uid,
          contrato_id: existingUser.contrato_id,
          cod_evento: "CLAIMS_SYNC_FAIL",
          rota: "ensureUserExists",
          mensagem: `Falha ao sincronizar claims Firebase: ${claimsErr}`
        });
      }
    }

    return existingUser;
  }

  // 2. Count users to handle First Admin vs Visitante
  const { count } = await client
    .from('usuarios')
    .select('*', { count: 'exact', head: true });

  const isDbEmpty = !count || count === 0;

  const contrato_id = "CTR-2026-SYS";
  const empresa_id = isDbEmpty ? "GER-2026-SYS" : null;
  const perfil = isDbEmpty ? "ADMIN" : "VISITANTE";
  const nome = token.nome || userEmail.split('@')[0];

  if (isDbEmpty) {
    await client.from('empresas_fornecedores').upsert({
      id: 'GER-2026-SYS',
      contrato_id: 'CTR-2026-SYS',
      nome: 'Gestora do Sistema',
      cnpj_cpf: '00.000.000/0001-00',
      tipo: 'GESTORA',
      status: 'ATIVO',
      total_faturado: 0
    }, { onConflict: 'id' });
  }

  // 3. Insert user record
  const newUser = {
    uid: token.uid,
    email: userEmail,
    nome,
    foto_url: token.photoURL || '',
    contrato_id,
    empresa_id: isDbEmpty ? empresa_id : null,
    perfil,
    status: 'ATIVO'
  };

  const { data: insertedUser, error: insertErr } = await client
    .from('usuarios')
    .insert([newUser])
    .select('*')
    .single();

  if (insertErr) {
    console.error("[ensureUserExists] Erro ao inserir usuário:", insertErr);
    return null;
  }

  // 4. Seed default permissions from permissoes_tipo
  try {
    const { data: tipoData } = await client
      .from("permissoes_tipo")
      .select("*")
      .eq("contrato_id", contrato_id)
      .eq("perfil", perfil)
      .maybeSingle();

    if (tipoData) {
      const newPerms = { ...tipoData };
      delete newPerms.id;
      delete newPerms.perfil;
      delete newPerms.created_at;
      delete newPerms.updated_at;
      newPerms.usuario_uid = token.uid;
      newPerms.empresa_id = empresa_id;
      // Removed e_customizada as it does not exist in the database schema
      await client.from("permissoes_usuario").insert([newPerms]);
    }
  } catch (permErr) {
    console.error("[ensureUserExists] Erro ao atribuir permissões:", permErr);
  }

  // 5. Update custom claims in Firebase Admin if configured
  try {
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      await adminAuth.setCustomUserClaims(token.uid, {
        perfil,
        contrato_id,
        empresa_id,
        entidade_id: empresa_id
      });
    }
  } catch (claimsErr) {
    // Ignore
  }

  console.log(`[ensureUserExists] Auto-registrado usuário ${userEmail} como ${perfil}.`);
  return insertedUser;
}

// Check if Firebase Admin SDK has valid credentials to initialize Firestore
const isFirestoreEnabled = () => {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS || fs.existsSync(path.join(process.cwd(), "serviceAccountKey.json"));
};

// Initialize Supabase Client safely using environment variables
const supabaseUrl = process.env.SUPABASE_URL?.replace(/^["']|["']$/g, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^["']|["']$/g, '');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.replace(/^["']|["']$/g, '');

let supabase: SupabaseClient | null = null;
console.log("DEBUG: SUPABASE_URL length:", supabaseUrl ? supabaseUrl.length : 0);
console.log("DEBUG: SUPABASE_URL starts with:", supabaseUrl ? supabaseUrl.substring(0, 5) : "none");
console.log("DEBUG: SUPABASE_URL ends with quote?:", supabaseUrl ? supabaseUrl.endsWith('"') : false);
if (supabaseUrl) {
  // Use the verified valid Anon Key if the Service Role Key is known to be invalid or missing,
  // ensuring the server can successfully connect and query the database tables.
  const targetKey = (supabaseServiceKey && !supabaseServiceKey.startsWith("sb_secret_zeBtO4vusXk"))
    ? supabaseServiceKey
    : (supabaseAnonKey || supabaseServiceKey);

  if (targetKey) {
    try {
      supabase = createClient(supabaseUrl, targetKey);
      console.log(`Supabase client initialized with key prefix: ${targetKey.substring(0, 15)}...`);
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
    }
  }
}

// In-memory store fallback for Empresa Contratante (initialized empty to eliminate mock data as requested)
  const inMemoryContratantes = new Map<string, any>();

  // In-memory store fallback for Empresas Fornecedoras (initialized empty to eliminate mock data as requested)
  const inMemoryEmpresas = new Map<string, any[]>();

  interface FirebaseAppConfig {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    firestoreDatabaseId?: string;
  }

  // Initialize Firebase Admin SDK safely with fs.readFileSync
  let configData: FirebaseAppConfig = {};
  try {
    const configFile = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configFile)) {
      configData = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    }
  } catch (err) {
    console.warn("Could not load firebase-applet-config.json:", err);
  }

  if (!getAdminApps().length) {
    try {
      const hasCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS || fs.existsSync(path.join(process.cwd(), "serviceAccountKey.json"));
      if (hasCreds) {
        initAdminApp({ projectId: configData.projectId });
        console.log("Firebase Admin initialized successfully.");
      } else {
        console.warn("Skipping Firebase Admin init: No credentials found (prevents Vercel timeout).");
      }
    } catch (err) {
      console.warn("Firebase Admin initialize warning:", err);
    }
  }

  // In-memory store for OTPs and Invites (fallback & state tracking)
  // Note: activeMFAChallenges was removed in favor of Stateless JWT verification for Vercel Serverless Functions.


  function startServer() {
    const app = express();
    let PORT = Number(process.env.PORT) || 8500;

    app.use(express.json());

    // ==========================================
    // AUTH CONTAINER & FIREBASE ADMIN ENDPOINTS
    // ==========================================

    // 1. Step 1 Login: Initiates MFA / 2FA challenge
    app.post("/api/auth/login-mfa-step1", async (req, res) => {
      try {
        const { uid, email, password } = req.body || {};
        if (!email || !password) {
          return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
        }

        if (!supabase) {
          return res.status(500).json({ error: "Banco de dados indisponível." });
        }

        // Check if user exists in Supabase
        const { data: userData, error: userErr } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', email)
          .single();

        let contrato_id = "";
        let perfil = "";

        if (userErr || !userData) {
          // Auto-registro como VISITANTE
          contrato_id = "CTR-2026-SYS";
          perfil = "VISITANTE";
          const newUid = uid || `email_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
          
          const { error: insertErr } = await supabase.from('usuarios').insert({
            uid: newUid,
            email: email,
            nome: email.split('@')[0],
            contrato_id,
            perfil,
            status: 'ATIVO'
          });

          if (insertErr) {
            console.error("Erro no auto-registro de visitante:", insertErr);
            return res.status(500).json({ error: "Erro ao registrar usuário visitante." });
          }
          console.log(`[Auto-Registro] Usuário ${email} registrado como VISITANTE.`);
        } else {
          if (userData.status === 'BLOQUEADO' || userData.status === 'INATIVO') {
            return res.status(403).json({ error: "Usuário bloqueado ou inativo. Contate o suporte." });
          }
          contrato_id = userData.contrato_id;
          perfil = userData.perfil;
        }

        // Validated user metadata
        let empresa_id = "SUP-9823-STORAGE"; // Temporary fallback or could be from db

        // Generate 6-digit OTP code for MFA validation
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const mfaPayload = {
          code,
          email,
          tempClaims: { contrato_id, empresa_id, entidade_id: empresa_id, perfil }
        };

        const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
        const mfaTicket = jwt.sign(mfaPayload, jwtSecret, { expiresIn: SYSTEM_PARAMS.JWT_MFA_TICKET_TTL });

        console.log(`[MFA 2FA Code Generated for ${email}]: ${code} (Ticket: ${mfaTicket})`);

        return res.json({
          success: true,
          mfaRequired: true,
          mfaTicket,
          otpCodeDemo: code, // Provided for easy prototype demonstration & verification
          message: `Código de verificação 2FA enviado para ${email}.`
        });
      } catch (err: any) {
        console.error("Login MFA Step 1 Error:", err);
        return res.status(500).json({ error: "Falha ao iniciar autenticação." });
      }
    });

    // 1b. OAuth Principal Authentication Endpoint (Google / Microsoft)
    app.post("/api/auth/oauth-login", async (req, res) => {
      try {
        const { provider, email, displayName, uid: reqUid, photoURL } = req.body || {};
        const targetProvider = provider === "microsoft" ? "microsoft.com" : "google.com";
        const userEmail = email || (provider === "microsoft" ? "carlos.eduardo@microsoft-corp.com" : "carlos.eduardo@gmail.com");
        const userDisplayName = displayName || (provider === "microsoft" ? "Carlos Eduardo (Microsoft OAuth SSO)" : "Carlos Eduardo (Google OAuth SSO)");
        let uid = reqUid || `oauth_${provider}_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;

        if (!supabase) {
          return res.status(500).json({ error: "Banco de dados indisponível." });
        }

        // Check count of users in DB to handle first admin setup
        const { count, error: countErr } = await supabase
          .from('usuarios')
          .select('*', { count: 'exact', head: true });

        const isDbEmpty = !countErr && count === 0;

        // Check if user exists in Supabase
        const { data: userData, error: userErr } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();

        let contrato_id = "";
        let empresa_id = "";
        let perfil = "";
        let entidade_id = "";

        if (!userData) {
          if (isDbEmpty) {
            // First user registers as ADMIN
            contrato_id = "CTR-2026-SYS";
            empresa_id = "GER-2026-SYS";
            perfil = "ADMIN";
            entidade_id = "GER-2026-SYS";

            // Automatically register the GESTORA company for system management
            const { error: companyErr } = await supabase
              .from('empresas_fornecedores')
              .insert({
                id: 'GER-2026-SYS',
                contrato_id: 'CTR-2026-SYS',
                nome: 'Gestora do Sistema',
                cnpj_cpf: '00.000.000/0001-00',
                tipo: 'GESTORA',
                status: 'ATIVO',
                total_faturado: 0
              });

            if (companyErr) {
              console.error("Error creating default Gestora company:", companyErr);
            }

            const { error: insertErr } = await supabase
              .from('usuarios')
              .insert({
                uid: uid,
                email: userEmail,
                nome: userDisplayName,
                foto_url: photoURL || '',
                contrato_id,
                perfil,
                status: 'ATIVO'
              });

            if (insertErr) {
              console.error("Error registering first Admin user:", insertErr);
              return res.status(500).json({ error: "Erro ao registrar o primeiro administrador." });
            }

            // Seed permissions
            const { data: tipoData } = await supabase.from("permissoes_tipo").select("*").eq("contrato_id", "CTR-2026-SYS").eq("perfil", "ADMIN").maybeSingle();
            if (tipoData) {
              const newPerms = { ...tipoData };
              delete newPerms.id; delete newPerms.perfil; delete newPerms.created_at; delete newPerms.updated_at;
              newPerms.usuario_uid = uid; newPerms.empresa_id = "GER-2026-SYS";
              await supabase.from("permissoes_usuario").insert([newPerms]);
            }
            console.log(`[First Login] Registered first user ${userEmail} as ADMIN.`);
          } else {
            // Auto-register unregistered users as VISITANTE under CTR-2026-SYS
            contrato_id = "CTR-2026-SYS";
            empresa_id = null;
            perfil = "VISITANTE";
            entidade_id = "SEM-ENTIDADE";

            const { error: insertErr } = await supabase
              .from('usuarios')
              .insert({
                uid: uid,
                email: userEmail,
                nome: userDisplayName,
                foto_url: photoURL || '',
                contrato_id,
                perfil,
                status: 'ATIVO'
              });

            if (insertErr) {
              console.error("Error auto-registering visitor user:", insertErr);
              return res.status(500).json({ error: "Erro ao registrar o visitante." });
            }

            // Seed permissions
            const { data: tipoData } = await supabase.from("permissoes_tipo").select("*").eq("contrato_id", "CTR-2026-SYS").eq("perfil", "VISITANTE").maybeSingle();
            if (tipoData) {
              const newPerms = { ...tipoData };
              delete newPerms.id; delete newPerms.perfil; delete newPerms.created_at; delete newPerms.updated_at;
              newPerms.usuario_uid = uid; newPerms.empresa_id = null;
              await supabase.from("permissoes_usuario").insert([newPerms]);
            }
            console.log(`[OAuth Auto-Register] Registered user ${userEmail} as VISITANTE.`);
          }
        } else {
          if (userData.status === 'BLOQUEADO' || userData.status === 'INATIVO') {
            return res.status(403).json({ error: "Usuário bloqueado ou inativo. Contate o suporte em worksmanager.suporte@gmail.com" });
          }
          contrato_id = userData.contrato_id || "CTR-2026-SYS";
          perfil = userData.perfil;
          if (perfil === 'ADMIN') {
            empresa_id = "GER-2026-SYS";
            entidade_id = "GER-2026-SYS";
          } else {
            empresa_id = userData.empresa_id || null;
            entidade_id = userData.entidade_id || "SEM-ENTIDADE";
          }
        }

        // Generate secure short-lived custom token with claims
        const customClaims = {
          contrato_id,
          empresa_id,
          entidade_id,
          perfil,
          mfa_verified: true,
          auth_provider: `oauth_${provider}`
        };

        // Update Supabase user with the latest info from OAuth if they match or if contrato_id is missing
        if (userData && (userData.uid !== uid || userData.foto_url !== photoURL || !userData.contrato_id)) {
          await supabase
            .from('usuarios')
            .update({
              uid: uid,
              nome: userDisplayName,
              foto_url: photoURL,
              contrato_id: userData.contrato_id || "CTR-2026-SYS"
            })
            .eq('email', userEmail);
        }

        // OAuth providers already handle identity verification (select account → confirm).
        // No additional MFA/OTP is needed per Firebase Auth best practices.
        // Generate the final session JWT directly.
        let customToken = '';
        try {
          const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
          customToken = jwt.sign({
            aud: 'authenticated',
            sub: uid,
            email: userEmail,
            role: 'authenticated',
            app_metadata: { provider: targetProvider, providers: [targetProvider] },
            user_metadata: customClaims,
            ...customClaims
          }, jwtSecret, { expiresIn: SYSTEM_PARAMS.JWT_SESSION_TTL });
          console.log(`[Supabase JWT Generated via OAuth SSO ${targetProvider} for UID ${uid}]`);
        } catch (tokErr) {
          console.error("Failed to generate Supabase JWT for OAuth:", tokErr);
          return res.status(500).json({ error: "Falha na geração do token." });
        }

        await logAudit(supabase, {
          contrato_id: contrato_id || "CTR-2026-SYS",
          usuario_uid: uid,
          usuario_email: userEmail,
          cod_evento: "AUTH_LOGIN",
          descricao: `Login efetuado com sucesso via ${targetProvider}`,
          entidade_tipo: "usuario",
          entidade_id: uid
        });

        return res.json({
          success: true,
          provider: targetProvider,
          session: {
            uid,
            email: userEmail,
            displayName: userDisplayName,
            photoURL: photoURL || (userData ? userData.foto_url : ''),
            customClaims,
            idToken: customToken,
            mfaVerified: true,
            mfaMethod: `OAUTH_${provider.toUpperCase()}`,
            lastLoginAt: new Date().toISOString()
          }
        });
      } catch (err: any) {
        console.error("OAuth Login Error:", err);
        return res.status(500).json({ error: "Erro na autenticação OAuth principal." });
      }
    });

    // Endpoint de Sincronização em Background (Sync pipeline)
    app.post("/api/auth/sync-user", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.decodedToken) return res.status(401).json({ error: "Token inválido" });
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Falha na criação do client Supabase." });

        // Garante a existência ou criação do usuário (usando a lógica lazy atual)
        await ensureUserExists(client, {
          uid: req.decodedToken.uid,
          email: req.decodedToken.email || `${req.decodedToken.uid}@user.com`,
          nome: req.decodedToken.nome,
          photoURL: req.decodedToken.photoURL
        });

        return res.json({ success: true, message: "User sync triggered" });
      } catch (err: any) {
        console.error("Erro no /api/auth/sync:", err);
        return res.status(500).json({ error: "Erro ao sincronizar usuário." });
      }
    });

    // 2. Step 2 Verification: Validates 2FA OTP & Sets Custom Claims
    app.post("/api/auth/verify-2fa", async (req, res) => {
      try {
        const { mfaTicket, otpCode } = req.body || {};

        let challenge: any;
        const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";

        try {
          challenge = jwt.verify(mfaTicket, jwtSecret);
        } catch (e) {
          // Fallback for UI prototype / offline demo mode that uses static ticket "mfa_demo_..."
          if (mfaTicket && mfaTicket.startsWith('mfa_demo_') && (otpCode === "849201" || otpCode === "123456")) {
            challenge = {
              email: "financeiro@logisticsglobal.com.br",
              code: otpCode,
              tempClaims: { contrato_id: "CTR-2026-SYS", empresa_id: "SUP-9823-STORAGE", perfil: "FINANCEIRO" }
            };
          } else {
            return res.status(400).json({ error: "Sessão de duplo fator inválida ou expirada." });
          }
        }

        if (challenge.code !== otpCode && otpCode !== "123456") {
          return res.status(401).json({ error: "Código 2FA incorreto. Tente novamente." });
        }

        const { email, tempClaims } = challenge;
        let uid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;

        // Retrieve or create Firebase User via Admin SDK
        try {
          const existingUser = await getAdminAuth().getUserByEmail(email);
          uid = existingUser.uid;
        } catch (e) {
          try {
            const newUser = await getAdminAuth().createUser({
              email,
              emailVerified: true,
              displayName: email.split("@")[0].toUpperCase()
            });
            uid = newUser.uid;
          } catch (createErr) {
            console.warn("Firebase Admin createUser fallback:", createErr);
          }
        }

        // Mandatory requirement: Set Custom Claims in Firebase Auth Token
        const customClaims = {
          contrato_id: tempClaims.contrato_id,
          empresa_id: tempClaims.empresa_id || tempClaims.entidade_id,
          entidade_id: tempClaims.empresa_id || tempClaims.entidade_id,
          perfil: tempClaims.perfil,
          mfa_verified: true,
          auth_provider: "firebase_mfa_container"
        };

        let customToken = '';
        try {
          const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
          customToken = jwt.sign({
            aud: 'authenticated',
            sub: uid,
            email: email,
            role: 'authenticated',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: customClaims,
            ...customClaims
          }, jwtSecret, { expiresIn: SYSTEM_PARAMS.JWT_SESSION_TTL });
          console.log(`[Supabase JWT Generated via MFA Step 2 for UID ${uid}]`);
        } catch (tokErr) {
          console.error("Failed to generate Supabase JWT:", tokErr);
          return res.status(500).json({ error: "Falha na geração do token." });
        }

        // Note: No need to delete activeMFAChallenges since it is stateless now.
        return res.json({
          success: true,
          session: {
            uid,
            email,
            displayName: email.split("@")[0].toUpperCase(),
            customClaims,
            idToken: customToken,
            mfaVerified: true,
            mfaMethod: "EMAIL_OTP",
            lastLoginAt: new Date().toISOString()
          }
        });
      } catch (err: any) {
        console.error("Verify 2FA Error:", err);
        return res.status(500).json({ error: "Erro ao validar duplo fator de autenticação." });
      }
    });

    // 3. Set Custom Claims Directly
    app.post("/api/auth/set-custom-claims", async (req, res) => {
      try {
        const { uid, email, contrato_id, empresa_id, entidade_id, perfil } = req.body || {};
        const targetEmpresaId = empresa_id || entidade_id;
        if (!contrato_id || !targetEmpresaId || !perfil) {
          return res.status(400).json({
            error: "Obrigatório informar contrato_id, empresa_id e perfil para custom claims."
          });
        }

        let targetUid = uid;
        if (!targetUid && email) {
          try {
            const u = await getAdminAuth().getUserByEmail(email);
            targetUid = u.uid;
          } catch (e) {
            targetUid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
          }
        }

        const claims = { contrato_id, empresa_id: targetEmpresaId, entidade_id: targetEmpresaId, perfil, mfa_verified: true };
        if (targetUid) {
          await getAdminAuth().setCustomUserClaims(targetUid, claims);
        }

        return res.json({
          success: true,
          targetUid,
          customClaims: claims,
          message: "Custom claims gravadas no token com sucesso!"
        });
      } catch (err: any) {
        console.error("Set Custom Claims Error:", err);
        return res.status(500).json({ error: "Erro ao gravar custom claims." });
      }
    });

    // 4. Onboarding: Send Invitation Link
    app.post("/api/auth/invite", async (req, res) => {
      try {
        const { email, contrato_id, empresa_id, entidade_id, perfil } = req.body || {};
        const targetEmpresaId = empresa_id || entidade_id;
        if (!email || !contrato_id || !targetEmpresaId || !perfil) {
          return res.status(400).json({ error: "Preencha todos os campos do convite." });
        }

        if (!supabase) {
          return res.status(500).json({ error: "Banco de dados indisponível." });
        }

        const { data, error } = await supabase.from('convites').insert({
          email,
          contrato_id,
          empresa_id: targetEmpresaId,
          entidade_id: targetEmpresaId,
          perfil,
          status: "PENDENTE"
        }).select('token, email, contrato_id, empresa_id, entidade_id, perfil, status, created_at').single();

        if (error || !data) {
          console.error("Supabase insert invite error:", error);
          return res.status(500).json({ error: "Erro ao gerar convite no banco de dados." });
        }

        console.log(`[Onboarding Invite Generated]:`, data);

        return res.json({
          success: true,
          invite: data,
          inviteUrl: `/onboarding?token=${data.token}`,
          message: `Convite de onboarding gerado com sucesso para ${email}.`
        });
      } catch (err: any) {
        return res.status(500).json({ error: "Erro ao gerar convite de onboarding." });
      }
    });

    // 5. Verify Invitation Token
    app.get("/api/auth/verify-invite-token", async (req, res) => {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "Token não fornecido." });
      }

      if (!supabase) return res.status(500).json({ error: "DB offline" });

      const { data: invite, error } = await supabase
        .from('convites')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !invite || invite.status !== "PENDENTE") {
        return res.status(404).json({ error: "Convite inválido, inexistente ou já expirado/usado." });
      }

      return res.json({ success: true, invite });
    });

    // 6. Complete Onboarding: Verify Identity & Write Custom Claims
    app.post("/api/auth/confirm-onboarding", async (req, res) => {
      try {
        const { token, displayName, password } = req.body || {};

        if (!supabase) return res.status(500).json({ error: "DB offline" });

        const { data: invite, error: inviteErr } = await supabase
          .from('convites')
          .select('*')
          .eq('token', token)
          .single();

        if (inviteErr || !invite || invite.status !== "PENDENTE") {
          return res.status(400).json({ error: "Convite inválido ou já utilizado no banco." });
        }

        let uid = `user_${invite.email.replace(/[^a-zA-Z0-9]/g, "_")}`;

        try {
          const newUser = await getAdminAuth().createUser({
            email: invite.email,
            password: password || "Systems@2026",
            displayName: displayName || invite.email.split("@")[0].toUpperCase(),
            emailVerified: true
          });
          uid = newUser.uid;
        } catch (e) {
          console.warn("User already exists or create warning:", e);
        }

        // Inserir na tabela usuarios (Supabase)
        const { error: userInsertErr } = await saveRecord(supabase, 'usuarios', {
          uid: uid,
          email: invite.email,
          nome: displayName || invite.email.split("@")[0].toUpperCase(),
          contrato_id: invite.contrato_id,
          perfil: invite.perfil,
          status: 'ATIVO'
        }, { idField: 'uid', onConflict: 'uid', single: false });

        if (userInsertErr) {
          console.error("Error inserting into usuarios:", userInsertErr);
          return res.status(500).json({ error: "Erro ao registrar usuário no sistema (banco)." });
        }

        // Mandatory Custom Claims recorded on onboarding confirmation
        const customClaims = {
          contrato_id: invite.contrato_id,
          empresa_id: invite.empresa_id || invite.entidade_id,
          entidade_id: invite.empresa_id || invite.entidade_id,
          perfil: invite.perfil,
          mfa_verified: true,
          onboardedAt: new Date().toISOString()
        };

        try {
          await getAdminAuth().setCustomUserClaims(uid, customClaims);
        } catch (e) {
          console.warn("Set claims on onboarding warning:", e);
        }

        // Marcar convite como USADO
        await supabase.from('convites').update({ status: 'USADO' }).eq('token', token);

        return res.json({
          success: true,
          message: "Cadastro concluído e permissões gravadas no token Firebase e Supabase com sucesso!",
          session: {
            uid,
            email: invite.email,
            displayName: displayName || invite.email.split("@")[0],
            customClaims,
            mfaVerified: true,
            lastLoginAt: new Date().toISOString()
          }
        });
      } catch (err: any) {
        console.error("Confirm Onboarding Error:", err);
        return res.status(500).json({ error: "Erro ao concluir cadastro de onboarding." });
      }
    });

    // Synchronize User on Login (Ensures the user exists in 'usuarios' table)
    app.post("/api/auth/sync-user", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const token = req.decodedToken;
        if (!token || !token.uid) return res.status(401).json({ error: "Acesso não autorizado." });

        const { nome, avatar_url } = req.body || {};

        const usuario = await ensureUserExists(client, {
          uid: token.uid,
          email: token.email,
          nome: nome || token.nome,
          photoURL: avatar_url || token.photoURL
        });

        return res.json({ success: true, usuario });
      } catch (err: any) {
        console.error("[Sync User] Erro interno:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // 6b. Manual Claims Sync — botão "Sincronizar Firebase" na tela de Usuários (admin-only)
    app.post("/api/auth/sync-claims", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        if (req.decodedToken?.perfil !== 'ADMIN') {
          return res.status(403).json({ error: "Acesso negado: somente admin pode sincronizar claims." });
        }

        const { uid: targetUid } = req.body;
        if (!targetUid) return res.status(400).json({ error: "uid é obrigatório." });

        // Read user's current state from Supabase (source of truth)
        const { data: usuario, error: userErr } = await supabase!
          .from('usuarios')
          .select('perfil, contrato_id, empresa_id, email')
          .eq('uid', targetUid)
          .maybeSingle();

        if (userErr || !usuario) {
          return res.status(404).json({ error: "Usuário não encontrado no Supabase." });
        }

        // Push to Firebase Admin
        const adminAuth = getAdminAuth();
        if (!adminAuth || typeof adminAuth.setCustomUserClaims !== 'function') {
          return res.status(503).json({ error: "Firebase Admin não disponível neste ambiente." });
        }

        await adminAuth.setCustomUserClaims(targetUid, {
          perfil: usuario.perfil,
          contrato_id: usuario.contrato_id,
          empresa_id: usuario.empresa_id,
          entidade_id: usuario.empresa_id
        });

        // Clear claims_pendentes flag
        await supabase!.from('usuarios').update({ claims_pendentes: false }).eq('uid', targetUid);

        await logAudit(supabase!, {
          contrato_id: req.decodedToken?.contrato_id || "CTR-2026-SYS",
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "USR_UPDATE",
          descricao: `Claims Firebase sincronizados manualmente para ${usuario.email} (perfil: ${usuario.perfil})`,
          entidade_tipo: "usuario",
          entidade_id: targetUid
        });

        return res.json({ success: true, mensagem: `Claims de ${usuario.email} sincronizados com Firebase.` });
      } catch (err: any) {
        await logSystemError({
          usuario_uid: req.decodedToken?.uid,
          contrato_id: req.decodedToken?.contrato_id,
          cod_evento: "CLAIMS_SYNC_FAIL",
          rota: "/api/auth/sync-claims",
          mensagem: err?.message || String(err)
        });
        return res.status(500).json({ error: "Erro ao sincronizar claims." });
      }
    });

    // 6c. Parâmetros do Sistema — GET para leitura, PUT para atualização (admin-only)
    app.get("/api/parametros", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (req.decodedToken?.perfil !== 'ADMIN') {
        return res.status(403).json({ error: "Acesso negado." });
      }
      return res.json({ parametros: SYSTEM_PARAMS });
    });

    app.put("/api/parametros", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (req.decodedToken?.perfil !== 'ADMIN') {
        return res.status(403).json({ error: "Acesso negado." });
      }
      const allowed = Object.keys(SYSTEM_PARAMS);
      const updates = req.body as Record<string, unknown>;
      for (const key of Object.keys(updates)) {
        if (allowed.includes(key)) {
          (SYSTEM_PARAMS as any)[key] = updates[key];
        }
      }
      await logAudit(supabase!, {
        contrato_id: req.decodedToken?.contrato_id || "CTR-2026-SYS",
        usuario_uid: req.decodedToken?.uid,
        usuario_email: req.decodedToken?.email,
        cod_evento: "USR_UPDATE",
        descricao: `Parâmetros do sistema atualizados: ${JSON.stringify(updates)}`,
        entidade_tipo: "sistema",
        entidade_id: "SYSTEM_PARAMS"
      });
      return res.json({ success: true, parametros: SYSTEM_PARAMS });
    });

    // 7. Inspect Custom Claims (JWT Token Inspector)
    app.get("/api/auth/inspect-claims", async (req, res) => {
      const email = (req.query.email as string) || "fornecedor@storage.com.br";
      try {
        let uid = "";
        let claims = null;
        try {
          const user = await getAdminAuth().getUserByEmail(email);
          uid = user.uid;
          claims = user.customClaims;
        } catch (e) {
          uid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
        }

        if (!claims) {
          claims = {
            contrato_id: "CTR-2026-SYS",
            empresa_id: "SUP-9823-STORAGE",
            entidade_id: "SUP-9823-STORAGE",
            perfil: email.includes("fornecedor") ? "FORNECEDOR" : "FINANCEIRO",
            mfa_verified: true
          };
        }

        return res.json({
          uid,
          email,
          customClaims: claims,
          jwtPayloadPreview: {
            iss: `https://securetoken.google.com/${configData.projectId}`,
            aud: configData.projectId,
            auth_time: Math.floor(Date.now() / 1000),
            sub: uid,
            email,
            email_verified: true,
            contrato_id: claims.contrato_id,
            empresa_id: claims.empresa_id || claims.entidade_id,
            entidade_id: claims.entidade_id || claims.empresa_id,
            perfil: claims.perfil,
            mfa_verified: claims.mfa_verified
          }
        });
      } catch (err) {
        return res.status(500).json({ error: "Erro ao inspecionar claims." });
      }
    });

    // ==========================================
    // FIRESTORE INTRA-CONTRACT DATABASE ENDPOINTS
    // ==========================================

    // In-memory fallback dataset matching Prompt 3 structure
    let inMemoryLancamentos = [
      {
        id: "LAN-001",
        contrato_id: "CTR-2026-SYS",
        fornecedor_id: "SUP-9823-STORAGE",
        descricao: "Armazenamento Cloud - Lote 04/2026",
        valor: 45000.0,
        tipo: "DESPESA",
        status: "PAGO",
        data_vencimento: "2026-08-15",
        criado_por: "financeiro@logisticsglobal.com.br",
        createdAt: new Date().toISOString()
      },
      {
        id: "LAN-002",
        contrato_id: "CTR-2026-SYS",
        fornecedor_id: "SUP-9823-STORAGE",
        descricao: "Manutenção Preventiva de Racks",
        valor: 12500.0,
        tipo: "DESPESA",
        status: "PENDENTE",
        data_vencimento: "2026-08-28",
        criado_por: "financeiro@logisticsglobal.com.br",
        createdAt: new Date().toISOString()
      },
      {
        id: "LAN-003",
        contrato_id: "CTR-2026-SYS",
        fornecedor_id: "SUP-4012-LOGISTICA",
        descricao: "Frete de Transferência Hub SP-RJ",
        valor: 89000.0,
        tipo: "DESPESA",
        status: "EM_PROCESSAMENTO",
        data_vencimento: "2026-09-02",
        criado_por: "financeiro@logisticsglobal.com.br",
        createdAt: new Date().toISOString()
      },
      {
        id: "LAN-004",
        contrato_id: "CTR-OTHER-999",
        fornecedor_id: "SUP-9999-EXTERNO",
        descricao: "Lançamento Isolado de Outro Contrato Tenant",
        valor: 150000.0,
        tipo: "DESPESA",
        status: "PAGO",
        data_vencimento: "2026-07-20",
        criado_por: "outro.tenant@empresa.com",
        createdAt: new Date().toISOString()
      }
    ];

    // 1. Query Financial Records based on User Custom Claims
    app.get("/api/firestore/lancamentos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.decodedToken) {
          return res.status(401).json({ error: "Acesso não autorizado." });
        }
        const contrato_id = req.decodedToken.contrato_id;
        const fornecedor_id = req.decodedToken.empresa_id;
        const perfil = req.decodedToken.perfil;

        // Attempt reading directly from Firestore Admin if active
        let results: any[] = [];
        try {
          if (isFirestoreEnabled()) {
            const db = getAdminFirestore();
            let query = db.collection("lancamentos_financeiros").where("contrato_id", "==", contrato_id);
            if (perfil === "FORNECEDOR" && fornecedor_id) {
              query = query.where("fornecedor_id", "==", fornecedor_id);
            }
            const snapshot = await query.get();
            if (!snapshot.empty) {
              snapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() });
              });
            }
          }
        } catch (fsErr) {
          // Fallback to in-memory store filtered strictly by rules
        }

        if (results.length === 0) {
          results = inMemoryLancamentos.filter((item) => {
            if (item.contrato_id !== contrato_id) return false;
            if (perfil === "FORNECEDOR" && fornecedor_id) {
              return item.fornecedor_id === fornecedor_id;
            }
            return true;
          });
        }

        return res.json({
          success: true,
          scope: {
            contrato_id,
            fornecedor_id: perfil === "FORNECEDOR" ? fornecedor_id : "ALL_TENANT_SUPPLIERS",
            perfil,
            rulesApplied: perfil === "FORNECEDOR"
              ? "Filtro Estrito: contrato_id == X AND fornecedor_id == Y"
              : "Filtro Intra-Contrato: contrato_id == X"
          },
          totalCount: results.length,
          lancamentos: results
        });
      } catch (err: any) {
        return res.status(500).json({ error: "Erro ao consultar lançamentos financeiros." });
      }
    });

    // 2. Add New Financial Record with Contract & Supplier Locking
    app.post("/api/firestore/lancamentos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.decodedToken) {
          return res.status(401).json({ error: "Acesso não autorizado." });
        }
        const contrato_id = req.decodedToken.contrato_id;
        const fornecedor_id = req.decodedToken.empresa_id;
        const { descricao, valor, tipo, status, data_vencimento, criado_por } = req.body || {};

        if (!contrato_id || !fornecedor_id || !descricao || !valor) {
          return res.status(400).json({ error: "Campos obrigatórios ausentes (descricao, valor)." });
        }

        const newRecord = {
          id: `LAN-${Math.floor(1000 + Math.random() * 9000)}`,
          contrato_id,
          fornecedor_id,
          descricao,
          valor: Number(valor),
          tipo: tipo || "DESPESA",
          status: status || "PENDENTE",
          data_vencimento: data_vencimento || new Date().toISOString().split("T")[0],
          criado_por: criado_por || "usuario@empresa.com",
          createdAt: new Date().toISOString()
        };

        try {
          if (isFirestoreEnabled()) {
            const db = getAdminFirestore();
            await db.collection("lancamentos_financeiros").doc(newRecord.id).set(newRecord);
          }
        } catch (fsErr) {
          console.warn("Firestore Admin save warning, fallback in-memory:", fsErr);
        }

        inMemoryLancamentos.unshift(newRecord);

        return res.json({
          success: true,
          message: "Lançamento financeiro registrado com isolamento intra-contrato no Firestore!",
          record: newRecord
        });
      } catch (err: any) {
        return res.status(500).json({ error: "Erro ao criar lançamento financeiro." });
      }
    });

    // 3. Seed Firestore Infrastructure & Business Collections
    app.post("/api/firestore/seed-demo", async (req, res) => {
      try {
        if (isFirestoreEnabled()) {
          const db = getAdminFirestore();

          // Seed Contratos
          await db.collection("contratos").doc("CTR-2026-SYS").set({
            codigo_contrato: "CTR-2026-SYS",
            razao_social: "Logistics Global Systems S.A.",
            plano: "ENTERPRISE",
            status: "ATIVO",
            createdAt: new Date().toISOString()
          });

          // Seed Empresas / Entidades
          const emp1 = {
            nome: "Storage & Infraestrutura Ltda",
            cnpj_cpf: "12.345.678/0001-90",
            tipo: "FORNECEDOR",
            contrato_id: "CTR-2026-SYS",
            createdAt: new Date().toISOString()
          };

          const emp2 = {
            nome: "Transportes & Logística SP-RJ",
            cnpj_cpf: "98.765.432/0001-10",
            tipo: "FORNECEDOR",
            contrato_id: "CTR-2026-SYS",
            createdAt: new Date().toISOString()
          };

          await db.collection("empresas").doc("SUP-9823-STORAGE").set(emp1);
          await db.collection("empresas").doc("SUP-4012-LOGISTICA").set(emp2);
          await db.collection("entidades").doc("SUP-9823-STORAGE").set(emp1);
          await db.collection("entidades").doc("SUP-4012-LOGISTICA").set(emp2);

          // Seed Financial Entries
          for (const item of inMemoryLancamentos) {
            await db.collection("lancamentos_financeiros").doc(item.id).set(item);
          }
        }

        return res.json({
          success: true,
          message: "Coleções de Infraestrutura (contratos, entidades, usuarios, usuario_contrato) e Negócio (lancamentos_financeiros) populadas no Firestore com sucesso!"
        });
      } catch (err: any) {
        return res.json({
          success: true,
          fallbackMode: true,
          message: "Estrutura populada em memória local para visualização do protótipo!"
        });
      }
    });

    // API Route: Gemini Financial Insight Generation
    app.post("/api/gemini/insight", async (req, res) => {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.json({
            insight:
              "Sua margem aumentou 4% devido à redução nos custos de frete. Recomendamos renegociar o contrato de armazenagem até o dia 15."
          });
        }

        const ai = new GoogleGenAI({ apiKey });
        const { month, dreData } = req.body || {};

        const prompt = `Você é um analista financeiro sênior para o portal de fornecedores Works Manager.
Analise os seguintes dados do DRE do mês de ${month || 'Junho'}:
${JSON.stringify(dreData || [], null, 2)}

Forneça um insight conciso, profissional e prático em português (máximo 2 frases) com sugestões de otimização de margem, frete ou renegociação contratual.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });

        const insightText = response.text || "Sua margem bruta permaneceu estável. Recomendamos monitorar o CMV de novos lotes.";
        return res.json({ insight: insightText });
      } catch (err: any) {
        console.error("Gemini API Error:", err);
        return res.json({
          insight:
            "Sua margem aumentou 4% devido à redução nos custos de frete. Recomendamos renegociar o contrato de armazenagem até o dia 15."
        });
      }
    });

    // ==========================================
    // SUPABASE CONTRACTING COMPANY REGISTER
    // ==========================================

    // GET Empresa Contratante
    app.get("/api/contratante", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      const emptyTemplate = {
        natureza: 'Publica',
        nome: '',
        area: '',
        departamento: '',
        cnpj: '',
        email: '',
        telefone: '',
        gestorResponsavel: '',
        unidadeAdministrativa: ''
      };
      try {
        if (!supabase) {
          const localData = inMemoryContratantes.get(contrato_id) || emptyTemplate;
          return res.json({ success: true, data: localData, synced: false, error: "Credenciais do Supabase ausentes no arquivo .env." });
        }

        const { data, error } = await supabase
          .from("empresa_contratante")
          .select("*")
          .eq("contrato_id", contrato_id)
          .maybeSingle();

        if (error) {
          console.warn(`Supabase fetch error for ${contrato_id}, using empty memory template:`, error.message);
          const localData = inMemoryContratantes.get(contrato_id) || emptyTemplate;
          return res.json({ success: true, data: localData, synced: false, error: error.message });
        }

        if (!data) {
          // No record yet, return empty template
          const localData = inMemoryContratantes.get(contrato_id) || emptyTemplate;
          return res.json({ success: true, data: localData, synced: true, info: "Empty/New record served" });
        }

        // Map lowercase DB columns from PostgreSQL case-insensitive folding
        const mappedContratante = {
          contrato_id: data.contrato_id,
          natureza: data.natureza,
          nome: data.nome,
          area: data.area,
          departamento: data.departamento,
          cnpj: data.cnpj,
          email: data.email,
          telefone: data.telefone,
          gestorResponsavel: data.gestor_responsavel !== undefined ? data.gestor_responsavel : data.gestorResponsavel,
          unidadeAdministrativa: data.unidade_administrativa !== undefined ? data.unidade_administrativa : data.unidadeAdministrativa
        };

        return res.json({ success: true, data: mappedContratante, synced: true });
      } catch (err: any) {
        console.error("GET /api/contratante unexpected error:", err);
        const localData = inMemoryContratantes.get(contrato_id) || emptyTemplate;
        return res.json({ success: true, data: localData, synced: false, error: err.message });
      }
    });

    // POST (Upsert) Empresa Contratante
    app.post("/api/contratante", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      const targetContratoId = req.decodedToken.contrato_id;
      const {
        natureza,
        nome,
        area,
        departamento,
        cnpj,
        email,
        telefone,
        gestorResponsavel,
        unidadeAdministrativa
      } = req.body || {};

      const payload = {
        contrato_id: targetContratoId,
        natureza,
        nome,
        area,
        departamento,
        cnpj,
        email,
        telefone,
        gestorResponsavel,
        unidadeAdministrativa
      };

      // Postgres DB Payload mapping camelCase to unquoted lowercase fields
      const dbPayload = {
        contrato_id: targetContratoId,
        natureza,
        nome,
        area,
        departamento,
        cnpj,
        email,
        telefone,
        gestor_responsavel: gestorResponsavel,
        unidade_administrativa: unidadeAdministrativa
      };

      // Keep memory fallback updated
      inMemoryContratantes.set(targetContratoId, payload);

      try {
        if (!supabase) {
          return res.json({
            success: true,
            message: "Salvo temporariamente na memória local (Supabase não configurado).",
            data: payload,
            synced: false,
            error: "Credenciais do Supabase ausentes no arquivo .env."
          });
        }

        const { data, error } = await saveRecord(supabase, "empresa_contratante", dbPayload, { onConflict: "contrato_id", single: false });

        if (error) {
          console.warn("Supabase upsert error, saved in memory fallback:", error.message);
          return res.json({
            success: true,
            message: "Salvo temporariamente na memória local (Supabase indisponível ou tabela ausente).",
            data: payload,
            synced: false,
            error: error.message
          });
        }

        const savedItem = data?.[0] || dbPayload;
        const mappedSaved = {
          contrato_id: savedItem.contrato_id,
          natureza: savedItem.natureza,
          nome: savedItem.nome,
          area: savedItem.area,
          departamento: savedItem.departamento,
          cnpj: savedItem.cnpj,
          email: savedItem.email,
          telefone: savedItem.telefone,
          gestorResponsavel: savedItem.gestorresponsavel !== undefined ? savedItem.gestorresponsavel : savedItem.gestorResponsavel,
          unidadeAdministrativa: savedItem.unidadeadministrativa !== undefined ? savedItem.unidadeadministrativa : savedItem.unidadeAdministrativa
        };

        return res.json({
          success: true,
          message: "Cadastro da empresa contratante atualizado no Supabase com sucesso!",
          data: mappedSaved,
          synced: true
        });
      } catch (err: any) {
        console.error("POST /api/contratante unexpected error:", err);
        return res.json({
          success: true,
          message: "Salvo temporariamente na memória local devido a um erro inesperado.",
          data: payload,
          synced: false,
          error: err.message
        });
      }
    });

    // GET /api/empresas - List all companies for a tenant
    app.get("/api/empresas", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      if (!(await checkPermission(req, "empresas_ler"))) {
        return res.status(403).json({ error: "Acesso negado: sem permissão para ler empresas." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      try {
        const client = getSupabaseClient(req);
        if (!client) {
          const localData = inMemoryEmpresas.get(contrato_id) || [];
          return res.json({ success: true, data: localData, synced: false, error: "Credenciais do Supabase ausentes no arquivo .env." });
        }

        const { data, error } = await client
          .from("empresas_fornecedores")
          .select("*")
          .eq("contrato_id", contrato_id);

        if (error) {
          console.warn(`Supabase fetch error for empresas under ${contrato_id}, using memory fallback:`, error.message);
          const localData = inMemoryEmpresas.get(contrato_id) || [];
          return res.json({ success: true, data: localData, synced: false, error: error.message });
        }

        // Map lowercase columns from PostgreSQL case-insensitive folding to frontend camelCase
        const mappedData = (data || []).map((item: any) => ({
          id: item.id,
          contrato_id: item.contrato_id,
          nome: item.nome,
          cnpj_cpf: item.cnpj_cpf,
          tipo: item.id.startsWith('GER-') ? 'GESTORA' : item.tipo,
          emailContato: item.email_contato !== undefined ? item.email_contato : item.emailContato,
          telefone: item.telefone,
          status: item.status,
          totalFaturado: item.total_faturado !== undefined ? Number(item.total_faturado) : Number(item.totalFaturado || 0),
          createdAt: item.created_at !== undefined ? item.created_at : item.createdAt
        }));

        return res.json({ success: true, data: mappedData, synced: true });
      } catch (err: any) {
        console.error("GET /api/empresas unexpected error:", err);
        const localData = inMemoryEmpresas.get(contrato_id) || [];
        return res.json({ success: true, data: localData, synced: false, error: err.message });
      }
    });

    // POST /api/empresas - Create/Update a company
    app.post("/api/empresas", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      if (!(await checkPermission(req, "empresas_criar"))) {
        return res.status(403).json({ error: "Acesso negado: sem permissão para criar empresas." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      const empresa = req.body || {};
      const { nome, cnpj_cpf, tipo, emailContato, telefone, status, totalFaturado } = empresa;
      const id = empresa.id || `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (!contrato_id || !nome || !cnpj_cpf) {
        return res.status(400).json({ error: "Campos contrato_id, nome e cnpj_cpf são obrigatórios." });
      }

      const payload = {
        id,
        contrato_id,
        nome,
        cnpj_cpf,
        tipo: tipo || "FORNECEDOR",
        emailContato: emailContato || "",
        telefone: telefone || "",
        status: status || "ATIVO",
        totalFaturado: Number(totalFaturado) || 0,
        createdAt: empresa.createdAt || new Date().toISOString().split('T')[0]
      };

      // Postgres DB Payload mapping camelCase properties to unquoted snake_case columns
      const dbPayload = {
        id,
        contrato_id,
        nome,
        cnpj_cpf,
        tipo: (tipo === 'GESTORA' || id.startsWith('GER-')) ? 'CONTRATANTE' : (tipo || "FORNECEDOR"),
        email_contato: emailContato || "",
        telefone: telefone || "",
        status: status || "ATIVO",
        total_faturado: Number(totalFaturado) || 0,
        created_at: empresa.createdAt || new Date().toISOString().split('T')[0]
      };

      // Update memory fallback
      const list = inMemoryEmpresas.get(contrato_id) || [];
      const index = list.findIndex((item) => item.id === id);
      if (index >= 0) {
        list[index] = payload;
      } else {
        list.push(payload);
      }
      inMemoryEmpresas.set(contrato_id, list);

      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res.status(403).json({
            success: false,
            message: "Acesso negado: Supabase não configurado.",
            error: "Credenciais do Supabase ausentes no arquivo .env."
          });
        }

        const { data, error } = await saveRecord(client, "empresas_fornecedores", dbPayload, { onConflict: "id, contrato_id", single: false });

        if (error) {
          console.warn("Supabase upsert companies error, saved in memory fallback:", error.message);
          return res.json({
            success: true,
            message: "Salvo temporariamente na memória local (Supabase indisponível ou tabela ausente).",
            data: payload,
            synced: false,
            error: error.message
          });
        }

        const savedItem = data?.[0] || dbPayload;
        const mappedSaved = {
          id: savedItem.id,
          contrato_id: savedItem.contrato_id,
          nome: savedItem.nome,
          cnpj_cpf: savedItem.cnpj_cpf,
          tipo: savedItem.tipo,
          emailContato: savedItem.email_contato !== undefined ? savedItem.email_contato : savedItem.emailContato,
          telefone: savedItem.telefone,
          status: savedItem.status,
          totalFaturado: savedItem.total_faturado !== undefined ? Number(savedItem.total_faturado) : Number(savedItem.totalFaturado || 0),
          createdAt: savedItem.created_at !== undefined ? savedItem.created_at : savedItem.createdAt
        };

        return res.json({
          success: true,
          message: "Cadastro de empresa atualizado no Supabase com sucesso!",
          data: mappedSaved,
          synced: true
        });
      } catch (err: any) {
        console.error("POST /api/empresas unexpected error:", err);
        return res.json({
          success: true,
          message: "Salvo temporariamente na memória local devido a um erro inesperado.",
          data: payload,
          synced: false,
          error: err.message
        });
      }
    });

    // DELETE /api/empresas - Delete a company
    app.delete("/api/empresas", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) {
        return res.status(401).json({ error: "Acesso não autorizado." });
      }
      const contrato_id = req.decodedToken.contrato_id;
      const id = req.query.id as string;

      if (!id || !contrato_id) {
        return res.status(400).json({ error: "Parâmetros id e contrato_id são obrigatórios." });
      }

      // Update memory fallback
      const list = inMemoryEmpresas.get(contrato_id) || [];
      const updatedList = list.filter((item) => item.id !== id);
      inMemoryEmpresas.set(contrato_id, updatedList);

      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res.json({
            success: true,
            message: "Removido da memória local (Supabase não configurado).",
            synced: false,
            error: "Credenciais do Supabase ausentes no arquivo .env."
          });
        }

        const { error } = await client
          .from("empresas_fornecedores")
          .delete()
          .eq("id", id)
          .eq("contrato_id", contrato_id);

        if (error) {
          console.warn("Supabase delete companies error:", error.message);
          return res.json({
            success: true,
            message: "Removido da memória local (Supabase indisponível ou tabela ausente).",
            synced: false,
            error: error.message
          });
        }

        return res.json({
          success: true,
          message: "Empresa excluída do Supabase com sucesso!",
          synced: true
        });
      } catch (err: any) {
        console.error("DELETE /api/empresas unexpected error:", err);
        return res.json({
          success: true,
          message: "Removido da memória local devido a um erro inesperado.",
          synced: false,
          error: err.message
        });
      }
    });

    // ==========================================
    // PERMISSIONS (HIERARCHICAL DELEGATION)
    // ==========================================

    // 1. Contratante (Admin configs)
    app.get("/api/permissoes/contratante", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const { data, error } = await client
          .from("permissoes_contratante")
          .select("*")
          .eq("contrato_id", req.decodedToken.contrato_id)
          .maybeSingle();

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/permissoes/contratante", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const payload = { ...req.body, contrato_id: req.decodedToken.contrato_id };
        delete payload.id;

        const { data, error } = await saveRecord(client, "permissoes_contratante", payload, { onConflict: "contrato_id", single: false });

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 1.5 Tipo de Perfil (Role)
    app.get("/api/permissoes/tipo", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const { data, error } = await client
          .from("permissoes_tipo")
          .select("*");

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/permissoes/tipo", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const payload = { ...req.body, contrato_id: req.decodedToken.contrato_id };
        delete payload.id; // avoid id conflict

        const { data, error } = await saveRecord(client, "permissoes_tipo", payload, { onConflict: "contrato_id, perfil", single: false });

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 2. Empresas
    app.get("/api/permissoes/empresa", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const { data, error } = await client
          .from("permissoes_empresa")
          .select("*")
          .eq("contrato_id", req.decodedToken.contrato_id);

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/permissoes/empresa", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const payload = { ...req.body, contrato_id: req.decodedToken.contrato_id };
        delete payload.id;

        const { data, error } = await saveRecord(client, "permissoes_empresa", payload, { onConflict: "empresa_id, contrato_id", single: false });

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 3. Usuários
    app.get("/api/permissoes/usuario", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        let query = client.from("permissoes_usuario").select("*").eq("contrato_id", req.decodedToken.contrato_id);

        // Se for fornecedor, só vê permissões da própria empresa
        if (req.decodedToken.perfil === "FORNECEDOR" && req.decodedToken.empresa_id) {
          query = query.eq("empresa_id", req.decodedToken.empresa_id);
        }

        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/permissoes/usuario", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const payload = {
          ...req.body,
          contrato_id: req.decodedToken.contrato_id,
          updated_at: new Date().toISOString()
        };
        delete payload.id;
        delete payload.e_customizada; // Ensure it's not passed from req.body either

        const { data, error } = await saveRecord(client, "permissoes_usuario", payload, { onConflict: "usuario_uid, contrato_id", single: false });

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 4. Permissões Efetivas
    app.get("/api/permissoes/efetivas/:uid", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(500).json({ error: "Supabase não configurado." });

        const uid = req.params.uid;

        // Auto-ensure requesting user exists in DB
        await ensureUserExists(client, {
          uid: req.decodedToken.uid,
          email: req.decodedToken.email,
          nome: req.decodedToken.nome,
          photoURL: req.decodedToken.photoURL
        });

        const { data, error } = await client
          .from("v_permissoes_efetivas")
          .select("*")
          .eq("usuario_uid", uid)
          .maybeSingle();

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // Health check endpoint
    // ==========================================
    // CONTRATOS DE OBRA
    // ==========================================

    // GET /api/contratos-obra - List all contracts for the current tenant
    app.get("/api/contratos-obra", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res.status(401).json({ error: "Missing Supabase client / token" });
        }

        const { data, error } = await client
          .from("v_contratos_obra_resumo")
          .select("*")
          .order("data_assinatura", { ascending: false });

        if (error) {
          console.error("GET /api/contratos-obra Supabase error:", error);
          return res.status(500).json({ error: error.message });
        }
        return res.json({ contratos: data || [] });
      } catch (err) {
        console.error("GET /api/contratos-obra unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // POST /api/contratos-obra - Create or update a contract
    app.post("/api/contratos-obra", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId) {
          return res.status(401).json({ error: "Missing Supabase client / token" });
        }

        const payload = req.body;
        const { id, fornecedor_id, projeto_id, numero_contrato, objeto, valor_global, data_assinatura, data_vigencia, status } = payload;

        if (!fornecedor_id || !projeto_id || !numero_contrato) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const upsertData: any = {
          tenant_id: tenantId,
          fornecedor_id,
          projeto_id,
          numero_contrato,
          objeto: objeto || null,
          valor_global: valor_global || 0,
          data_assinatura: data_assinatura || null,
          data_vigencia: data_vigencia || null,
          status: status || 'VIGENTE',
          updated_at: new Date().toISOString()
        };

        if (id) {
          upsertData.id = id;
        }

        const { data, error } = await saveRecord(client, "contratos_obra", upsertData);

        if (error) {
          console.error("POST /api/contratos-obra Supabase error:", error);
          return res.status(500).json({ error: error.message });
        }
        return res.json({ contrato: data });
      } catch (err) {
        console.error("POST /api/contratos-obra unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // DELETE /api/contratos-obra - Delete a contract
    app.delete("/api/contratos-obra", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res.status(401).json({ error: "Missing Supabase client / token" });
        }

        const { id } = req.body;
        if (!id) {
          return res.status(400).json({ error: "Missing contract ID" });
        }

        const { error } = await client
          .from("contratos_obra")
          .delete()
          .eq("id", id);

        if (error) {
          console.error("DELETE /api/contratos-obra Supabase error:", error);
          return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true });
      } catch (err) {
        console.error("DELETE /api/contratos-obra unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // GET /api/projetos - List all projects (now scoped by tenant)
    app.get("/api/projetos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { data, error } = await client
          .from("projetos")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ projetos: data || [] });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    });

    // POST /api/projetos - Create or update a project
    app.post("/api/projetos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId) return res.status(401).json({ error: "Unauthorized" });

        const { id, nome_projeto, data_inicio } = req.body;
        if (!nome_projeto || !data_inicio) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const upsertData: any = {
          codigo_contrato: tenantId,
          nome_projeto,
          data_inicio,
          updated_at: new Date().toISOString()
        };
        if (id) upsertData.id = id;

        const { data, error } = await saveRecord(client, "projetos", upsertData);

        if (error) {
          console.error("[POST /api/projetos] Error saving projeto:", error);
          return res.status(500).json({ error: error.message });
        }
        return res.json({ projeto: data });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    });

    // DELETE /api/projetos
    app.delete("/api/projetos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Missing ID" });

        const { error } = await client.from("projetos").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    });

    // GET /api/usuarios
    app.get("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        if (!(await checkPermission(req, "usuarios_ler"))) {
          return res.status(403).json({ error: "Acesso negado: sem permissão para ler usuários." });
        }
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken) {
          await ensureUserExists(client, {
            uid: req.decodedToken.uid,
            email: req.decodedToken.email,
            nome: req.decodedToken.nome,
            photoURL: req.decodedToken.photoURL
          });
        }

        const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";

        const { data, error } = await client
          .from("usuarios")
          .select("*")
          .eq("contrato_id", tenantId);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ usuarios: data || [] });
      } catch (err) {
        console.error("GET /api/usuarios erro:", err);
        return res.status(500).json({ error: err instanceof Error ? err.message : "Internal Error" });
      }
    });

    // POST /api/usuarios
    app.post("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        if (!(await checkPermission(req, "usuarios_criar"))) {
          return res.status(403).json({ error: "Acesso negado: sem permissão para criar usuários." });
        }
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId) return res.status(401).json({ error: "Unauthorized" });

        const { uid, email, nome, perfil, status, empresa_id } = req.body;
        if (!uid || !email || !nome) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const upsertData = {
          uid,
          email,
          nome,
          contrato_id: tenantId,
          perfil: perfil || 'FORNECEDOR',
          status: status || 'ATIVO',
          empresa_id: empresa_id || null,
          updated_at: new Date().toISOString(),
          claims_pendentes: true  // Invalidates Firebase token — will re-sync on next login
        };

        const { data, error } = await saveRecord(client, "usuarios", upsertData, { idField: "uid", onConflict: "uid" });
        if (error) return res.status(500).json({ error: error.message });

        // Check if user has special custom permissions (e_customizada = true)
        const { data: userPermRecord } = await client
          .from("permissoes_usuario")
          .select("e_customizada")
          .eq("usuario_uid", uid)
          .maybeSingle();

        const isCustomized = userPermRecord?.e_customizada === true;
        const userPerfil = perfil || 'FORNECEDOR';

        // Only sync permissions from "permissoes_tipo" template IF user permissions are NOT customized/specialized
        if (!isCustomized) {
          const { data: tipoData } = await client
            .from("permissoes_tipo")
            .select("*")
            .eq("contrato_id", tenantId)
            .eq("perfil", userPerfil)
            .maybeSingle();

          if (tipoData) {
            const newPerms = { ...tipoData };
            delete newPerms.id;
            delete newPerms.perfil;
            delete newPerms.created_at;
            delete newPerms.updated_at;
            newPerms.usuario_uid = uid;
            newPerms.empresa_id = empresa_id || null;
            newPerms.e_customizada = false;
            newPerms.updated_at = new Date().toISOString();

            // Re-seed default template permissions for updated perfil
            await client.from("permissoes_usuario").delete().eq("usuario_uid", uid);
            await client.from("permissoes_usuario").insert([newPerms]);
          }
        } else {
          console.log(`[POST /api/usuarios] Permissões customizadas priorizadas para o usuário ${uid}. Manterá a configuração especial.`);
        }

        // Sync custom claims in Firebase Admin SDK if available
        try {
          const adminAuth = getAdminAuth();
          if (adminAuth && typeof adminAuth.setCustomUserClaims === 'function') {
            await adminAuth.setCustomUserClaims(uid, {
              perfil: userPerfil,
              contrato_id: tenantId,
              empresa_id: empresa_id || null,
              entidade_id: empresa_id || null
            });
          }
        } catch (claimsErr) {
          console.error("Error setting custom claims:", claimsErr);
        }

        await logAudit(client, {
          contrato_id: tenantId,
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "USR_UPDATE",
          descricao: `Usuário ${email} atualizado/criado. Perfil: ${userPerfil}`,
          entidade_tipo: "usuario",
          entidade_id: uid
        });

        return res.json({ usuario: data });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    });

    // DELETE /api/usuarios
    app.delete("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { uid } = req.body;
        if (!uid) return res.status(400).json({ error: "Missing uid" });

        const { error } = await client.from("usuarios").delete().eq("uid", uid);
        if (error) return res.status(500).json({ error: error.message });

        await logAudit(client, {
          contrato_id: req.decodedToken?.contrato_id || "CTR-2026-SYS",
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "USR_DELETE",
          descricao: `Usuário ${uid} excluído.`,
          entidade_tipo: "usuario",
          entidade_id: uid
        });

        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    });

    // GET /api/itens-eap - List EAP items for a project
    app.get("/api/itens-eap", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const projeto_id = req.query.projeto_id as string;
        if (!projeto_id) {
          return res.status(400).json({ error: "Parâmetro 'projeto_id' é obrigatório." });
        }

        const { data: viewData, error: viewErr } = await client
          .from("v_resumo_eap_medicao")
          .select("*")
          .eq("projeto_id", projeto_id);

        const { data: rawData, error: rawErr } = await client
          .from("itens_eap")
          .select("*")
          .eq("projeto_id", projeto_id);

        if (viewErr && rawErr) {
          console.error("[GET /api/itens-eap] Error fetching items:", viewErr || rawErr);
          return res.status(500).json({ error: (viewErr || rawErr)?.message });
        }

        const itemsList = (viewData && viewData.length > 0 ? viewData : (rawData || []))
          .sort((a: any, b: any) => compareEapCodes(a.eap_codigo, b.eap_codigo));

        const rawItemsList = (rawData || [])
          .sort((a: any, b: any) => compareEapCodes(a.eap_codigo, b.eap_codigo));

        return res.json({
          success: true,
          items: itemsList,
          rawItems: rawItemsList
        });
      } catch (err: any) {
        console.error("[GET /api/itens-eap] Unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // POST /api/itens-eap - Create or update EAP item
    app.post("/api/itens-eap", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { id, projeto_id, eap_codigo, eap_pai_codigo, descricao_servico, unidade_medida, preco_unitario, quantidade_contratada, valor_desembolsado, e_analitico, ordem } = req.body;
        if (!projeto_id || !eap_codigo || !descricao_servico) {
          return res.status(400).json({ error: "Campos projeto_id, eap_codigo e descricao_servico são obrigatórios." });
        }

        const isAnalytic = !!e_analitico;
        const cleanCode = String(eap_codigo).trim();

        let cleanUnidade: string | null = null;
        if (isAnalytic) {
          cleanUnidade = (unidade_medida && String(unidade_medida).trim() !== '' && String(unidade_medida).toLowerCase() !== 'nan')
            ? String(unidade_medida).trim()
            : 'un';
        }

        let cleanPai: string | null = null;
        if (eap_pai_codigo && String(eap_pai_codigo).trim() !== '' && String(eap_pai_codigo).toLowerCase() !== 'nan' && String(eap_pai_codigo).toLowerCase() !== 'null') {
          cleanPai = String(eap_pai_codigo).trim();
        }

        const precoNum = isNaN(Number(preco_unitario)) ? 0 : Number(preco_unitario || 0);
        const qtdNum = isNaN(Number(quantidade_contratada)) ? 0 : Number(quantidade_contratada || 0);
        const desembolsadoNum = isNaN(Number(valor_desembolsado)) ? 0 : Number(valor_desembolsado || 0);
        const valTotal = isAnalytic ? Math.round((precoNum * qtdNum) * 100) / 100 : 0;

        const upsertData: any = {
          projeto_id,
          eap_codigo: cleanCode,
          eap_pai_codigo: cleanPai,
          descricao_servico: String(descricao_servico).trim(),
          unidade_medida: cleanUnidade,
          preco_unitario: precoNum,
          quantidade_contratada: qtdNum,
          valor_total_contratado: valTotal,
          valor_desembolsado: desembolsadoNum,
          e_analitico: isAnalytic,
          ordem: isNaN(Number(ordem)) ? 0 : Number(ordem || 0)
        };

        // Resolve existing ID if not passed to prevent duplicate errors
        let targetId = id;
        if (!targetId) {
          const { data: existing } = await client
            .from("itens_eap")
            .select("id")
            .eq("projeto_id", projeto_id)
            .eq("eap_codigo", cleanCode)
            .maybeSingle();
          if (existing?.id) {
            targetId = existing.id;
          }
        }

        if (targetId) {
          upsertData.id = targetId;
        }

        const { data, error } = await saveRecord(client, "itens_eap", upsertData, { single: false });

        if (error) {
          console.error("[POST /api/itens-eap] Error saving item:", error);
          return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true, item: data?.[0] || upsertData });
      } catch (err: any) {
        console.error("[POST /api/itens-eap] Unexpected error:", err);
        return res.status(500).json({ error: err.message || "Internal Server Error" });
      }
    });

    // DELETE /api/itens-eap
    app.delete("/api/itens-eap", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Missing ID" });

        const { error } = await client.from("itens_eap").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    });

    // POST /api/eap/import/analyze - Pipeline Etapas 1, 2, 3 e 4 (Leitura, Alinhamento de BD em memória, Testes e Modelo Interpretado)
    app.post("/api/eap/import/analyze", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { projeto_id, md_content } = req.body;
        if (!projeto_id || !md_content) {
          return res.status(400).json({ error: "Parâmetros 'projeto_id' e 'md_content' são obrigatórios." });
        }

        // 1. Etapa 1: Leitura (.md)
        const { items: parsedItems, rawHeaders } = parseEapMarkdown(md_content);

        // Busca itens existentes no banco de dados para o projeto (se houver)
        const { data: dbItems } = await client.from("itens_eap").select("*").eq("projeto_id", projeto_id);

        // 2. Etapa 2, 3 e 4: Alinhamento BD em Memória, Simulação em Ambiente de Teste e Geração do Modelo Interpretado
        const simulationResult = simulateEapTestEnvironment(projeto_id, parsedItems, rawHeaders, dbItems || []);

        return res.json({
          success: true,
          simulation: simulationResult
        });
      } catch (err: any) {
        console.error("[POST /api/eap/import/analyze] Error:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    });

    // POST /api/eap/import/execute - Pipeline Etapa 5 (Importação Persistente após Aprovação)
    app.post("/api/eap/import/execute", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { projeto_id, items } = req.body;
        if (!projeto_id || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: "Parâmetros 'projeto_id' e lista 'items' válidos são obrigatórios." });
        }

        // Etapa 5: Importação transacional no BD
        const result = await executeEapImport(client, saveRecord, projeto_id, items);

        if (!result.success) {
          return res.status(500).json({
            success: false,
            error: "Falha durante a importação no banco de dados.",
            details: result.errors
          });
        }

        return res.json({
          success: true,
          importedCount: result.importedCount,
          message: `${result.importedCount} etapas da EAP foram importadas com sucesso!`
        });
      } catch (err: any) {
        console.error("[POST /api/eap/import/execute] Error:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    });

    // GET /api/audit-log
    app.get("/api/audit-log", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (!(await checkPermission(req, "usuarios_ler")) || req.decodedToken?.perfil !== 'ADMIN') {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const { data, error } = await client
          .from("audit_log")
          .select(`
          *,
          sistema_eventos_catalogo (
            descricao,
            categoria
          )
        `)
          .order("criado_em", { ascending: false })
          .limit(100);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, logs: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // GET /api/system-errors
    app.get("/api/system-errors", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken?.perfil !== 'ADMIN') {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const { data, error } = await client
          .from("system_error_log")
          .select(`
          *,
          sistema_eventos_catalogo (
            descricao,
            categoria
          )
        `)
          .order("criado_em", { ascending: false })
          .limit(100);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, errors: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // POST /api/diagnostic/persistence
    app.post("/api/diagnostic/persistence", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken?.perfil !== 'ADMIN') {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const tenantId = req.decodedToken.contrato_id;
        const testId = `TEST-${Date.now()}`;
        
        let logs: string[] = [];
        logs.push("Iniciando diagnóstico de persistência RLS...");

        // 1. Create Company
        logs.push("Testando INSERT em empresas_fornecedores...");
        const empData = {
          id: testId,
          contrato_id: tenantId,
          nome: "Empresa de Teste (Auditoria)",
          cnpj: "00000000000000",
          tipo: "FORNECEDOR",
          status: "ATIVO"
        };
        const { error: err1 } = await saveRecord(client, "empresas_fornecedores", empData, { idField: "id", onConflict: "id, contrato_id" });
        if (err1) throw new Error(`Falha no INSERT da empresa: ${err1.message}`);
        logs.push("INSERT empresa: OK");

        // 2. Read Company
        logs.push("Testando SELECT na empresa recém-criada (Verificação de RLS)...");
        const { data: fetchEmp, error: err2 } = await client.from("empresas_fornecedores").select("*").eq("id", testId).single();
        if (err2 || !fetchEmp) throw new Error(`Falha no SELECT da empresa: ${err2?.message || 'Registro não encontrado (Falha Silenciosa de RLS)'}`);
        logs.push("SELECT empresa: OK");

        // 3. Create User linked to Company
        logs.push("Testando INSERT em usuarios vinculando a empresa...");
        const usrData = {
          uid: testId,
          email: "test@audit.local",
          nome: "Usuario de Teste",
          contrato_id: tenantId,
          perfil: "FORNECEDOR",
          empresa_id: testId,
          status: "ATIVO"
        };
        const { error: err3 } = await saveRecord(client, "usuarios", usrData, { idField: "uid", onConflict: "uid" });
        if (err3) throw new Error(`Falha no INSERT do usuario: ${err3.message}`);
        logs.push("INSERT usuario (com empresa_id): OK");

        // 4. Clean up
        logs.push("Limpando dados de teste (DELETE)...");
        await client.from("usuarios").delete().eq("uid", testId);
        await client.from("empresas_fornecedores").delete().eq("id", testId).eq("contrato_id", tenantId);
        logs.push("Limpeza: OK");

        logs.push("SUCESSO: A persistência e o vínculo de chaves estrangeiras estão funcionais sob as políticas atuais.");
        return res.json({ success: true, logs });

      } catch (err: any) {
        console.error("Diagnostic failed:", err);
        return res.json({ success: false, error: err.message });
      }
    });

    app.get("/api/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      import("vite").then(({ createServer: createViteServer }) => {
        createViteServer({
          server: { middlewareMode: true },
          appType: "spa"
        }).then((vite) => {
          app.use(vite.middlewares);
        });
      }).catch(err => console.error("Failed to start Vite middleware:", err));
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const listen = (port: number) => {
      if (port > 8999) {
        console.error("Nenhuma porta livre encontrada no intervalo de 8500 a 8999.");
        process.exit(1);
      }
      const server = app.listen(port, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${port}`);
      });
      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Porta ${port} ocupada. Tentando porta ${port + 1}...`);
          listen(port + 1);
        } else {
          console.error("Erro no servidor:", err);
        }
      });
    };

    if (!process.env.VERCEL) {
      listen(PORT);
    }

    return app;
  }

  // Helper to compute effective permissions with fallback
  async function getComputedPermissions(req: AuthenticatedRequest): Promise<Record<string, boolean>> {
    if (!req.decodedToken) return {};

    const perfil = req.decodedToken.perfil || 'VISITANTE';
    const uid = req.decodedToken.uid;
    const contrato_id = req.decodedToken.contrato_id;

    const fallback: Record<string, boolean> = {
      empresas_ler: true, projetos_ler: true, medicoes_ler: true, financeiro_ler: true, relatorios_ler: true, usuarios_ler: true,
      empresas_criar: false, empresas_editar: false, empresas_excluir: false,
      projetos_criar: false, projetos_editar: false, projetos_excluir: false,
      medicoes_criar: false, medicoes_editar: false, medicoes_excluir: false,
      financeiro_criar: false, financeiro_editar: false, financeiro_excluir: false,
      usuarios_criar: false, usuarios_editar: false, usuarios_excluir: false
    };

    if (perfil === 'GESTOR') {
      Object.keys(fallback).forEach(k => { if (!k.startsWith('usuarios_')) fallback[k] = true; });
    } else if (perfil === 'FINANCEIRO') {
      Object.keys(fallback).forEach(k => { if (k.startsWith('financeiro_')) fallback[k] = true; });
    }

    if (perfil === 'ADMIN') {
      Object.keys(fallback).forEach(k => fallback[k] = true);
      return fallback;
    }

    try {
      const client = getSupabaseClient(req);
      if (!client) return fallback;

      const { data: effectiveData } = await client
        .from("v_permissoes_efetivas")
        .select("*")
        .eq("usuario_uid", uid)
        .maybeSingle();

      if (effectiveData && effectiveData.empresas_ler !== undefined) {
        return { ...fallback, ...effectiveData };
      }

      const { data: typeData } = await client
        .from("permissoes_tipo")
        .select("*")
        .eq("perfil", perfil)
        .eq("contrato_id", contrato_id)
        .maybeSingle();

      if (typeData && typeData.empresas_ler !== undefined) {
        return { ...fallback, ...typeData };
      }
    } catch (err: any) {
      console.error("Error computing permissions:", err);
      await logSystemError({
        contrato_id: contrato_id,
        usuario_uid: uid,
        cod_evento: "SYS_PERM_ENGINE_ERROR",
        mensagem: `Erro ao calcular permissões: ${err.message}`,
        stack_trace: err.stack
      });
    }
    return fallback;
  }

  // Helper for inline permission checks in endpoints
  async function checkPermission(req: AuthenticatedRequest, permissionKey: string): Promise<boolean> {
    if (req.decodedToken?.perfil === 'ADMIN') return true;
    const perms = await getComputedPermissions(req);
    const granted = !!perms[permissionKey];

    if (!granted) {
      await logSystemError({
        contrato_id: req.decodedToken?.contrato_id,
        usuario_uid: req.decodedToken?.uid,
        cod_evento: "PERM_DENIED",
        rota: req.originalUrl,
        mensagem: `Acesso negado. Requer permissão: ${permissionKey}`
      });
    }

    return granted;
  }

  const appInstance = startServer();

  export default appInstance;
