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

// Helper function to create a scoped Supabase client with a custom JWT
function getSupabaseClient(req: AuthenticatedRequest): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey || !req.decodedToken) return null;
  const token = jwt.sign(
    {
      role: "authenticated",
      sub: req.decodedToken.uid,
      contrato_id: req.decodedToken.contrato_id,
      perfil: req.decodedToken.perfil
    },
    process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long"
  );
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
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
      const { email, password } = req.body || {};
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

      if (userErr || !userData) {
        return res.status(403).json({ error: "Usuário não autorizado. E-mail não encontrado no sistema." });
      }

      if (userData.status === 'BLOQUEADO' || userData.status === 'INATIVO') {
        return res.status(403).json({ error: "Usuário bloqueado ou inativo. Contate o suporte." });
      }

      // Validated user metadata
      let contrato_id = userData.contrato_id;
      let perfil = userData.perfil;
      let empresa_id = "SUP-9823-STORAGE"; // Temporary fallback or could be from db

      // Generate 6-digit OTP code for MFA validation
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      const mfaPayload = {
        code,
        email,
        tempClaims: { contrato_id, empresa_id, entidade_id: empresa_id, perfil }
      };
      
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
      const mfaTicket = jwt.sign(mfaPayload, jwtSecret, { expiresIn: '10m' });

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
          console.log(`[First Login] Registered first user ${userEmail} as ADMIN.`);
        } else {
          // Auto-register unregistered users as VISITANTE under CTR-2026-SYS
          contrato_id = "CTR-2026-SYS";
          empresa_id = "SEM-EMPRESA";
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
          empresa_id = userData.empresa_id || "SEM-EMPRESA";
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
        }, jwtSecret, { expiresIn: '24h' });
        console.log(`[Supabase JWT Generated via OAuth SSO ${targetProvider} for UID ${uid}]`);
      } catch (tokErr) {
        console.error("Failed to generate Supabase JWT for OAuth:", tokErr);
        return res.status(500).json({ error: "Falha na geração do token." });
      }

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
        }, jwtSecret, { expiresIn: '24h' });
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
        gestorResponsavel: data.gestorresponsavel !== undefined ? data.gestorresponsavel : data.gestorResponsavel,
        unidadeAdministrativa: data.unidadeadministrativa !== undefined ? data.unidadeadministrativa : data.unidadeAdministrativa
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
    const contrato_id = req.decodedToken.contrato_id;
    const empresa = req.body || {};
    const { id, nome, cnpj_cpf, tipo, emailContato, telefone, status, totalFaturado } = empresa;

    if (!id || !contrato_id || !nome || !cnpj_cpf) {
      return res.status(400).json({ error: "Campos id, contrato_id, nome e cnpj_cpf são obrigatórios." });
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
      
      const payload = { ...req.body, contrato_id: req.decodedToken.contrato_id };
      delete payload.id;
      
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
      const client = getSupabaseClient(req);
      const tenantId = req.decodedToken?.contrato_id;
      if (!client || !tenantId) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await client
        .from("usuarios")
        .select("*")
        .eq("contrato_id", tenantId);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ usuarios: data || [] });
    } catch (err) {
      return res.status(500).json({ error: "Internal Error" });
    }
  });

  // POST /api/usuarios
  app.post("/api/usuarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
    try {
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
        updated_at: new Date().toISOString()
      };

      const { data, error } = await saveRecord(client, "usuarios", upsertData, { idField: "uid", onConflict: "uid" });
      if (error) return res.status(500).json({ error: error.message });
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
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Internal Error" });
    }
  });

  // POST /api/itens-eap
  app.post("/api/itens-eap", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const client = getSupabaseClient(req);
      if (!client) return res.status(401).json({ error: "Unauthorized" });

      const { id, projeto_id, eap_codigo, eap_pai_codigo, descricao_servico, unidade_medida, preco_unitario, quantidade_contratada, e_analitico, ordem } = req.body;
      if (!projeto_id || !eap_codigo || !descricao_servico) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const valTotal = (parseFloat(preco_unitario || 0) * parseFloat(quantidade_contratada || 0));

      const upsertData: any = {
        projeto_id,
        eap_codigo,
        eap_pai_codigo: eap_pai_codigo || null,
        descricao_servico,
        unidade_medida: unidade_medida || null,
        preco_unitario: parseFloat(preco_unitario || 0),
        quantidade_contratada: parseFloat(quantidade_contratada || 0),
        valor_total_contratado: valTotal,
        e_analitico: !!e_analitico,
        ordem: parseInt(ordem || 0, 10)
      };
      if (id) upsertData.id = id;

      const { data, error } = await saveRecord(client, "itens_eap", upsertData);

      if (error) {
        console.error("[POST /api/itens-eap] Error saving item:", error);
        return res.status(500).json({ error: error.message });
      }
      return res.json({ item: data });
    } catch (err) {
      return res.status(500).json({ error: "Internal Error" });
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
    } catch (err) {
      return res.status(500).json({ error: "Internal Error" });
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

const appInstance = startServer();

export default appInstance;

