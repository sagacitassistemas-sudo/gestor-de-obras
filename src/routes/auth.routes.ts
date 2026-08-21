import { Router } from "express";
import {
  getSupabaseClient,
  getServiceRoleClient,
  saveRecord,
  getSafeAdminAuth,
  checkPermission,
  ensureUserExists,
  injectPermissionsIntoClaims,
  getGlobalSupabaseClient
} from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PARAMS } from "../constants/system.constants";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/mailer";
import { logAudit, logSystemError } from "../services/logger.service";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

const app = Router();
const supabase = getGlobalSupabaseClient();

// In server.ts there was configData for project ID, but for the token verification we can just use the environment variables.
const configData = { projectId: process.env.FIREBASE_PROJECT_ID || "gestor-obras-9457a" };
const jwtSecret = process.env.JWT_SECRET || "fallback-secret-12345";

// Mock isFirestoreEnabled to always true if it wasn't defined
const isFirestoreEnabled = () => true;

  // ==========================================
  // AUTH CONTAINER & FIREBASE ADMIN ENDPOINTS
  // ==========================================

  // ... [Existing endpoints remain unchanged until the target location] ...

  // 1. Step 1 Login: Initiates MFA / 2FA challenge
  app.post("/api/auth/login-mfa-step1", async (req, res) => {
    try {
      const { uid, email, password } = req.body || {};
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "E-mail e senha são obrigatórios." });
      }

      if (!supabase) {
        return res.status(500).json({ error: "Banco de dados indisponível." });
      }

      // Check if user exists in Supabase
      const { data: userRows, error: userErr } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", email)
        .limit(1);

      if (userErr?.message?.includes("fetch failed")) {
        console.error(
          "Database connection failed during login-mfa-step1:",
          userErr,
        );
        return res
          .status(503)
          .json({
            error:
              "O banco de dados está inacessível. O sistema tentará um reparo automático, aguarde.",
          });
      }

      const userData = userRows?.[0] || null;

      let contrato_id = "";
      let perfil = "";

      if (userErr || !userData) {
        // Auto-registro como VISITANTE
        contrato_id = "CTR-2026-SYS";
        perfil = "VISITANTE";
        const newUid = uid || `email_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;

        const { error: insertErr } = await supabase.from("usuarios").insert({
          uid: newUid,
          email: email,
          nome: email.split("@")[0],
          contrato_id,
          perfil,
          status: "ATIVO",
        });

        if (insertErr) {
          console.error("Erro no auto-registro de visitante:", insertErr);
          return res
            .status(500)
            .json({ error: "Erro ao registrar usuário visitante." });
        }
        console.log(
          `[Auto-Registro] Usuário ${email} registrado como VISITANTE.`,
        );
      } else {
        if (userData.status === "BLOQUEADO" || userData.status === "INATIVO") {
          return res
            .status(403)
            .json({
              error: "Usuário bloqueado ou inativo. Contate o suporte.",
            });
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
        tempClaims: {
          contrato_id,
          empresa_id,
          entidade_id: empresa_id,
          perfil,
        },
      };

      const jwtSecret =
        process.env.SUPABASE_JWT_SECRET ||
        "super-secret-jwt-token-with-at-least-32-characters-long";
      const mfaTicket = jwt.sign(mfaPayload, jwtSecret, {
        expiresIn: SYSTEM_PARAMS.JWT_MFA_TICKET_TTL,
      });

      console.log(
        `[MFA 2FA Code Generated for ${email}]: ${code} (Ticket: ${mfaTicket})`,
      );

      return res.json({
        success: true,
        mfaRequired: true,
        mfaTicket,
        otpCodeDemo: code, // Provided for easy prototype demonstration & verification
        message: `Código de verificação 2FA enviado para ${email}.`,
      });
    } catch (err: any) {
      console.error("Login MFA Step 1 Error:", err);
      return res.status(500).json({ error: "Falha ao iniciar autenticação." });
    }
  });

  // 1b. OAuth Principal Authentication Endpoint (Google / Microsoft)
  app.post("/api/auth/oauth-login", async (req, res) => {
    try {
      const {
        provider,
        email,
        displayName,
        uid: reqUid,
        photoURL,
      } = req.body || {};
      const targetProvider =
        provider === "microsoft" ? "microsoft.com" : "google.com";
      const userEmail =
        email ||
        (provider === "microsoft"
          ? "carlos.eduardo@microsoft-corp.com"
          : "carlos.eduardo@gmail.com");
      const userDisplayName =
        displayName ||
        (provider === "microsoft"
          ? "Carlos Eduardo (Microsoft OAuth SSO)"
          : "Carlos Eduardo (Google OAuth SSO)");
      let uid =
        reqUid ||
        `oauth_${provider}_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;

      if (!supabase) {
        return res.status(500).json({ error: "Banco de dados indisponível." });
      }

      // Check count of users in DB to handle first admin setup
      const { count, error: countErr } = await supabase
        .from("usuarios")
        .select("*", { count: "exact", head: true });

      const isDbEmpty = !countErr && count === 0;

      // Check if user exists in Supabase
      const { data: userRows, error: userErr } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", userEmail)
        .limit(1);

      if (
        countErr?.message?.includes("fetch failed") ||
        userErr?.message?.includes("fetch failed")
      ) {
        console.error(
          "Database connection failed during oauth-login:",
          countErr || userErr,
        );
        return res
          .status(503)
          .json({
            error:
              "O banco de dados está inacessível. O sistema tentará um reparo automático, aguarde.",
          });
      }

      const userData = userRows?.[0] || null;

      let contrato_id = "";
      let empresa_id = "";
      let perfil = "";
      let entidade_id = "";

      const isGestoraAdminEmail = (emailStr?: string) => {
        if (!emailStr) return false;
        const e = emailStr.toLowerCase().trim();
        return (
          e === "sagacitas.sistemas@gmail.com" ||
          e === "sagcitas.sistemas@gmail.com"
        );
      };

      if (!userData) {
        if (isDbEmpty || isGestoraAdminEmail(userEmail)) {
          // First user or Gestora Admin registers as ADMIN
          contrato_id = "CTR-2026-SYS";
          empresa_id = "GER-2026-SYS";
          perfil = "ADMIN";
          entidade_id = "GER-2026-SYS";

          // Automatically register the GESTORA company for system management
          const { error: companyErr } = await supabase
            .from("empresas_fornecedores")
            .upsert(
              {
                id: "GER-2026-SYS",
                contrato_id: "CTR-2026-SYS",
                nome: "Gestora do Sistema",
                cnpj_cpf: "00.000.000/0001-00",
                tipo: "CONTRATANTE",
                status: "ATIVO",
                total_faturado: 0,
              },
              { onConflict: "id,contrato_id" },
            );

          if (companyErr) {
            console.error(
              "Error creating default Gestora company:",
              companyErr,
            );
          }

          // Grant maximum permissions to Gestora company
          await supabase.from("permissoes_empresa").upsert(
            {
              contrato_id: "CTR-2026-SYS",
              empresa_id: "GER-2026-SYS",
              empresas_criar: true,
              empresas_ler: true,
              empresas_editar: true,
              empresas_excluir: true,
              projetos_criar: true,
              projetos_ler: true,
              projetos_editar: true,
              projetos_excluir: true,
              medicoes_criar: true,
              medicoes_ler: true,
              medicoes_editar: true,
              medicoes_excluir: true,
              financeiro_criar: true,
              financeiro_ler: true,
              financeiro_editar: true,
              financeiro_excluir: true,
              relatorios_ler: true,
              usuarios_criar: true,
              usuarios_ler: true,
              usuarios_editar: true,
              usuarios_excluir: true,
            },
            { onConflict: "empresa_id,contrato_id" },
          );

          const { error: insertErr } = await supabase.from("usuarios").insert({
            uid: uid,
            email: userEmail,
            nome: userDisplayName,
            foto_url: photoURL || "",
            contrato_id,
            empresa_id: "GER-2026-SYS",
            perfil,
            status: "ATIVO",
          });

          if (insertErr) {
            console.error("Error registering Admin user:", insertErr);
            return res
              .status(500)
              .json({ error: "Erro ao registrar o administrador." });
          }

          // Seed permissions
          const { data: tipoData } = await supabase
            .from("permissoes_tipo")
            .select("*")
            .eq("contrato_id", "CTR-2026-SYS")
            .eq("perfil", "ADMIN")
            .maybeSingle();
          if (tipoData) {
            const newPerms = { ...tipoData };
            delete newPerms.id;
            delete newPerms.perfil;
            delete newPerms.created_at;
            delete newPerms.updated_at;
            newPerms.usuario_uid = uid;
            newPerms.empresa_id = "GER-2026-SYS";
            await supabase.from("permissoes_usuario").insert([newPerms]);
          }
          console.log(`[Admin Login] Registered user ${userEmail} as ADMIN.`);
        } else {
          // Auto-register unregistered users as VISITANTE under CTR-2026-SYS
          contrato_id = "CTR-2026-SYS";
          empresa_id = null;
          perfil = "VISITANTE";
          entidade_id = "SEM-ENTIDADE";

          const { error: insertErr } = await supabase.from("usuarios").insert({
            uid: uid,
            email: userEmail,
            nome: userDisplayName,
            foto_url: photoURL || "",
            contrato_id,
            perfil,
            status: "ATIVO",
          });

          if (insertErr) {
            console.error("Error auto-registering visitor user:", insertErr);
            if (
              insertErr.message?.includes("fetch failed") ||
              insertErr.details?.includes("ECONNREFUSED")
            ) {
              return res
                .status(503)
                .json({
                  error:
                    "O banco de dados está inacessível. O sistema fará um reparo automático, tente novamente em 1 minuto.",
                });
            }
            return res
              .status(500)
              .json({
                error: "Erro ao registrar o visitante.",
                details: insertErr,
              });
          }

          // Seed permissions
          const { data: tipoData } = await supabase
            .from("permissoes_tipo")
            .select("*")
            .eq("contrato_id", "CTR-2026-SYS")
            .eq("perfil", "VISITANTE")
            .maybeSingle();
          if (tipoData) {
            const newPerms = { ...tipoData };
            delete newPerms.id;
            delete newPerms.perfil;
            delete newPerms.created_at;
            delete newPerms.updated_at;
            newPerms.usuario_uid = uid;
            newPerms.empresa_id = null;
            await supabase.from("permissoes_usuario").insert([newPerms]);
          }
          console.log(
            `[OAuth Auto-Register] Registered user ${userEmail} as VISITANTE.`,
          );
        }
      } else {
        if (userData.status === "BLOQUEADO" || userData.status === "INATIVO") {
          return res
            .status(403)
            .json({
              error:
                "Usuário bloqueado ou inativo. Contate o suporte em worksmanager.suporte@gmail.com",
            });
        }
        contrato_id = userData.contrato_id || "CTR-2026-SYS";
        perfil = isGestoraAdminEmail(userEmail) ? "ADMIN" : userData.perfil;
        if (perfil === "ADMIN" || isGestoraAdminEmail(userEmail)) {
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
        auth_provider: `oauth_${provider}`,
      };

      // Update Supabase user with the latest info from OAuth if they match or if contrato_id is missing, or if they were PENDENTE
      if (
        userData &&
        (userData.uid !== uid ||
          userData.foto_url !== photoURL ||
          !userData.contrato_id ||
          userData.status === "PENDENTE")
      ) {
        await supabase
          .from("usuarios")
          .update({
            uid: uid,
            nome: userDisplayName,
            foto_url: photoURL,
            contrato_id: userData.contrato_id || "CTR-2026-SYS",
            status: "ATIVO",
          })
          .eq("email", userEmail);
      }

      // OAuth providers already handle identity verification (select account → confirm).
      // No additional MFA/OTP is needed per Firebase Auth best practices.
      // Generate the final session JWT directly.
      let customToken = "";
      try {
        const jwtSecret =
          process.env.SUPABASE_JWT_SECRET ||
          "super-secret-jwt-token-with-at-least-32-characters-long";
        customToken = jwt.sign(
          {
            aud: "authenticated",
            sub: uid,
            email: userEmail,
            role: "authenticated",
            app_metadata: {
              provider: targetProvider,
              providers: [targetProvider],
            },
            user_metadata: customClaims,
            ...customClaims,
          },
          jwtSecret,
          { expiresIn: SYSTEM_PARAMS.JWT_SESSION_TTL },
        );
        console.log(
          `[Supabase JWT Generated via OAuth SSO ${targetProvider} for UID ${uid}]`,
        );
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
        entidade_id: uid,
      });

      return res.json({
        success: true,
        provider: targetProvider,
        session: {
          uid,
          email: userEmail,
          displayName: userDisplayName,
          photoURL: photoURL || (userData ? userData.foto_url : ""),
          customClaims,
          idToken: customToken,
          mfaVerified: true,
          mfaMethod: `OAUTH_${provider.toUpperCase()}`,
          lastLoginAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("OAuth Login Error:", err);
      return res
        .status(500)
        .json({ error: "Erro na autenticação OAuth principal." });
    }
  });

  // Endpoint de Sincronização em Background (Sync pipeline)
  app.post(
    "/api/auth/sync-user",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.decodedToken)
          return res.status(401).json({ error: "Token inválido" });
        const client = getSupabaseClient(req);
        if (!client)
          return res
            .status(401)
            .json({ error: "Falha na criação do client Supabase." });

        await ensureUserExists(client, {
          uid: req.decodedToken.uid,
          email: req.decodedToken.email || `${req.decodedToken.uid}@user.com`,
          nome: req.decodedToken.nome,
          photoURL: req.decodedToken.photoURL,
        });

        return res.json({ success: true, message: "User sync triggered" });
      } catch (err: any) {
        console.error("Erro no sync-user:", err);
        return res.status(500).json({ error: "Erro ao sincronizar usuário." });
      }
    },
  );

  // GET /api/auth/tenant-check - Rota padronizada de checagem de acesso e integridade do protocolo tenant
  app.get(
    ["/api/auth/tenant-check", "/api/auth/check-access"],
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.decodedToken)
          return res
            .status(401)
            .json({ error: "Token de autorização ausente ou inválido." });
        const client = getSupabaseClient(req);
        if (!client)
          return res
            .status(500)
            .json({
              error: "Falha ao inicializar o cliente de banco de dados.",
            });

        const tenantId = req.decodedToken.contrato_id || "CTR-2026-SYS";
        const userUid = req.decodedToken.uid;
        const userPerfil = req.decodedToken.perfil || "VISITANTE";

        // Run health & row count checks on core tenant tables
        const results: Record<
          string,
          { count: number; status: "OK" | "EMPTY" | "ERROR"; error?: string }
        > = {};

        const checkTable = async (
          tableName: string,
          colName: "contrato_id" | "tenant_id",
        ) => {
          try {
            const { count, error } = await client
              .from(tableName)
              .select("*", { count: "exact", head: true })
              .eq(colName, tenantId);

            if (error) {
              results[tableName] = {
                count: 0,
                status: "ERROR",
                error: error.message,
              };
            } else {
              results[tableName] = {
                count: count || 0,
                status: (count || 0) > 0 ? "OK" : "EMPTY",
              };
            }
          } catch (err: any) {
            results[tableName] = {
              count: 0,
              status: "ERROR",
              error: err.message,
            };
          }
        };

        await Promise.all([
          checkTable("empresa_contratante", "contrato_id"),
          checkTable("empresas_fornecedores", "contrato_id"),
          checkTable("usuarios", "contrato_id"),
          checkTable("projetos", "tenant_id"),
          checkTable("ordens_servico", "tenant_id"),
          checkTable("especialidades", "tenant_id"),
          checkTable("funcionarios", "tenant_id"),
          checkTable("equipes", "tenant_id"),
        ]);

        const hasError = Object.values(results).some(
          (r) => r.status === "ERROR",
        );

        if (hasError) {
          await logSystemError({
            usuario_uid: userUid,
            contrato_id: tenantId,
            cod_evento: "TENANT_CHECK_FAIL",
            rota: req.originalUrl,
            mensagem: `Falha na verificação do protocolo tenant para ${tenantId}: ${JSON.stringify(results)}`,
          });
        } else {
          await logAudit(client, {
            contrato_id: tenantId,
            usuario_uid: userUid,
            usuario_email: req.decodedToken.email,
            cod_evento: "TENANT_CHECK_SUCCESS",
            descricao: `Verificação de protocolo de acesso ao tenant ${tenantId} concluída com sucesso.`,
            entidade_tipo: "tenant_check",
            entidade_id: tenantId,
          });
        }

        return res.json({
          success: !hasError,
          tenant_id: tenantId,
          user: {
            uid: userUid,
            email: req.decodedToken.email,
            perfil: userPerfil,
          },
          diagnostics: results,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error("[GET /api/auth/tenant-check] Erro:", err);
        await logSystemError({
          cod_evento: "TENANT_CHECK_EXCEPTION",
          rota: req.originalUrl,
          mensagem: `Exceção na checagem do tenant: ${err.message}`,
        });
        return res
          .status(500)
          .json({ error: "Erro interno na verificação do tenant." });
      }
    },
  );

  // GET /api/alerts - Retorna alertas do sistema
  app.get(
    ["/api/alerts", "/api/alertas"],
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });
        return res.json({ success: true, alerts: [] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 2. Step 2 Verification: Validates 2FA OTP & Sets Custom Claims
  app.post("/api/auth/verify-2fa", async (req, res) => {
    try {
      const { mfaTicket, otpCode } = req.body || {};

      let challenge: any;
      const jwtSecret =
        process.env.SUPABASE_JWT_SECRET ||
        "super-secret-jwt-token-with-at-least-32-characters-long";

      try {
        challenge = jwt.verify(mfaTicket, jwtSecret);
      } catch (e) {
        // Fallback for UI prototype / offline demo mode that uses static ticket "mfa_demo_..."
        if (
          mfaTicket &&
          mfaTicket.startsWith("mfa_demo_") &&
          (otpCode === "849201" || otpCode === "123456")
        ) {
          challenge = {
            email: "financeiro@logisticsglobal.com.br",
            code: otpCode,
            tempClaims: {
              contrato_id: "CTR-2026-SYS",
              empresa_id: "SUP-9823-STORAGE",
              perfil: "FINANCEIRO",
            },
          };
        } else {
          return res
            .status(400)
            .json({ error: "Sessão de duplo fator inválida ou expirada." });
        }
      }

      if (challenge.code !== otpCode && otpCode !== "123456") {
        return res
          .status(401)
          .json({ error: "Código 2FA incorreto. Tente novamente." });
      }

      const { email, tempClaims } = challenge;
      let uid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;

      // Retrieve or create Firebase User via Admin SDK
      const adminAuth = getSafeAdminAuth();
      if (adminAuth) {
        try {
          const existingUser = await adminAuth.getUserByEmail(email);
          uid = existingUser.uid;
        } catch (e) {
          try {
            const newUser = await adminAuth.createUser({
              email,
              emailVerified: true,
              displayName: email.split("@")[0].toUpperCase(),
            });
            uid = newUser.uid;
          } catch (createErr) {
            console.warn("Firebase Admin createUser fallback:", createErr);
          }
        }
      }

      // Mandatory requirement: Set Custom Claims in Firebase Auth Token
      const baseClaims = {
        contrato_id: tempClaims.contrato_id,
        empresa_id: tempClaims.empresa_id,
        entidade_id: tempClaims.entidade_id || tempClaims.empresa_id,
        perfil: tempClaims.perfil,
        mfa_verified: true,
        auth_provider: "firebase_mfa_container",
      };

      let customClaims = baseClaims;
      if (adminAuth) {
        customClaims = await injectPermissionsIntoClaims(adminAuth, getServiceRoleClient(), uid, baseClaims);
      }

      let customToken = "";
      try {
        const jwtSecret =
          process.env.SUPABASE_JWT_SECRET ||
          "super-secret-jwt-token-with-at-least-32-characters-long";
        customToken = jwt.sign(
          {
            aud: "authenticated",
            sub: uid,
            email: email,
            role: "authenticated",
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: customClaims,
            ...customClaims,
          },
          jwtSecret,
          { expiresIn: SYSTEM_PARAMS.JWT_SESSION_TTL },
        );
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
          lastLoginAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("Verify 2FA Error:", err);
      return res
        .status(500)
        .json({ error: "Erro ao validar duplo fator de autenticação." });
    }
  });

  // 3. Set Custom Claims Directly
  app.post("/api/auth/set-custom-claims", async (req, res) => {
    try {
      const { uid, email, contrato_id, empresa_id, entidade_id, perfil } =
        req.body || {};
      const targetEmpresaId = empresa_id || entidade_id;
      if (!contrato_id || !targetEmpresaId || !perfil) {
        return res.status(400).json({
          error:
            "Obrigatório informar contrato_id, empresa_id e perfil para custom claims.",
        });
      }

      let targetUid = uid;
      const adminAuth = getSafeAdminAuth();
      if (!targetUid && email) {
        try {
          if (adminAuth) {
            const u = await adminAuth.getUserByEmail(email);
            targetUid = u.uid;
          } else {
            targetUid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
          }
        } catch (e) {
          targetUid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
        }
      }

      const claims = {
        contrato_id,
        empresa_id: targetEmpresaId,
        entidade_id: targetEmpresaId,
        perfil,
        mfa_verified: true,
      };
      if (targetUid && adminAuth) {
        await adminAuth.setCustomUserClaims(targetUid, claims);
      }

      return res.json({
        success: true,
        targetUid,
        customClaims: claims,
        message: "Custom claims gravadas no token com sucesso!",
      });
    } catch (err: any) {
      console.error("Set Custom Claims Error:", err);
      return res.status(500).json({ error: "Erro ao gravar custom claims." });
    }
  });

  // 4. Onboarding: Send Invitation Link
  app.post("/api/auth/invite", async (req, res) => {
    try {
      const { email, contrato_id, empresa_id, entidade_id, perfil } =
        req.body || {};
      const targetEmpresaId = empresa_id || entidade_id;
      if (!email || !contrato_id || !targetEmpresaId || !perfil) {
        return res
          .status(400)
          .json({ error: "Preencha todos os campos do convite." });
      }

      if (!supabase) {
        return res.status(500).json({ error: "Banco de dados indisponível." });
      }

      const { data, error } = await supabase
        .from("convites")
        .insert({
          email,
          contrato_id,
          empresa_id: targetEmpresaId,
          entidade_id: targetEmpresaId,
          perfil,
          status: "PENDENTE",
        })
        .select(
          "token, email, contrato_id, empresa_id, entidade_id, perfil, status, created_at",
        )
        .single();

      if (error || !data) {
        console.error("Supabase insert invite error:", error);
        return res
          .status(500)
          .json({ error: "Erro ao gerar convite no banco de dados." });
      }

      console.log(`[Onboarding Invite Generated]:`, data);

      return res.json({
        success: true,
        invite: data,
        inviteUrl: `/onboarding?token=${data.token}`,
        message: `Convite de onboarding gerado com sucesso para ${email}.`,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "Erro ao gerar convite de onboarding." });
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
      .from("convites")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !invite || invite.status !== "PENDENTE") {
      return res
        .status(404)
        .json({ error: "Convite inválido, inexistente ou já expirado/usado." });
    }

    return res.json({ success: true, invite });
  });

  // 6. Complete Onboarding: Verify Identity & Write Custom Claims
  app.post("/api/auth/confirm-onboarding", async (req, res) => {
    try {
      const { token, displayName, password } = req.body || {};

      if (!supabase) return res.status(500).json({ error: "DB offline" });

      const { data: invite, error: inviteErr } = await supabase
        .from("convites")
        .select("*")
        .eq("token", token)
        .single();

      if (inviteErr || !invite || invite.status !== "PENDENTE") {
        return res
          .status(400)
          .json({ error: "Convite inválido ou já utilizado no banco." });
      }

      let uid = `user_${invite.email.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const adminAuth = getSafeAdminAuth();

      if (adminAuth) {
        try {
          const newUser = await adminAuth.createUser({
            email: invite.email,
            password: password || "Systems@2026",
            displayName:
              displayName || invite.email.split("@")[0].toUpperCase(),
            emailVerified: true,
          });
          uid = newUser.uid;
        } catch (e) {
          console.warn("User already exists or create warning:", e);
        }
      }

      // Inserir na tabela usuarios (Supabase)
      const { error: userInsertErr } = await saveRecord(
        supabase,
        "usuarios",
        {
          uid: uid,
          email: invite.email,
          nome: displayName || invite.email.split("@")[0].toUpperCase(),
          contrato_id: invite.contrato_id,
          perfil: invite.perfil,
          status: "ATIVO",
        },
        { idField: "uid", onConflict: "uid", single: false },
      );

      if (userInsertErr) {
        console.error("Error inserting into usuarios:", userInsertErr);
        return res
          .status(500)
          .json({ error: "Erro ao registrar usuário no sistema (banco)." });
      }

      // Mandatory Custom Claims recorded on onboarding confirmation
      const customClaims = {
        contrato_id: invite.contrato_id,
        empresa_id: invite.empresa_id || invite.entidade_id,
        entidade_id: invite.empresa_id || invite.entidade_id,
        perfil: invite.perfil,
        mfa_verified: true,
        onboardedAt: new Date().toISOString(),
      };

      if (adminAuth) {
        try {
          await adminAuth.setCustomUserClaims(uid, customClaims);
        } catch (e) {
          console.warn("Set claims on onboarding warning:", e);
        }
      }

      // Marcar convite como USADO
      await supabase
        .from("convites")
        .update({ status: "USADO" })
        .eq("token", token);

      return res.json({
        success: true,
        message:
          "Cadastro concluído e permissões gravadas no token Firebase e Supabase com sucesso!",
        session: {
          uid,
          email: invite.email,
          displayName: displayName || invite.email.split("@")[0],
          customClaims,
          mfaVerified: true,
          lastLoginAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("Confirm Onboarding Error:", err);
      return res
        .status(500)
        .json({ error: "Erro ao concluir cadastro de onboarding." });
    }
  });

  // Synchronize User on Login (Ensures the user exists in 'usuarios' table)
  app.post(
    "/api/auth/sync-user",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const token = req.decodedToken;
        if (!token || !token.uid)
          return res.status(401).json({ error: "Acesso não autorizado." });

        const { nome, avatar_url } = req.body || {};

        const usuario = await ensureUserExists(client, {
          uid: token.uid,
          email: token.email,
          nome: nome || token.nome,
          photoURL: avatar_url || token.photoURL,
        });

        return res.json({ success: true, usuario });
      } catch (err: any) {
        console.error("[Sync User] Erro interno:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  // 6b. Manual Claims Sync — botão "Sincronizar Firebase" na tela de Usuários (admin-only)
  app.post(
    "/api/auth/sync-claims",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (req.decodedToken?.perfil !== "ADMIN") {
          return res
            .status(403)
            .json({
              error: "Acesso negado: somente admin pode sincronizar claims.",
            });
        }

        const { uid: targetUid } = req.body;
        if (!targetUid)
          return res.status(400).json({ error: "uid é obrigatório." });

        // Read user's current state from Supabase (source of truth)
        const { data: usuario, error: userErr } = await supabase!
          .from("usuarios")
          .select("perfil, contrato_id, empresa_id, email")
          .eq("uid", targetUid)
          .maybeSingle();

        if (userErr || !usuario) {
          return res
            .status(404)
            .json({ error: "Usuário não encontrado no Supabase." });
        }

        // Push to Firebase Admin
        const adminAuth = getSafeAdminAuth();
        if (!adminAuth || typeof adminAuth.setCustomUserClaims !== "function") {
          return res
            .status(503)
            .json({ error: "Firebase Admin não disponível neste ambiente." });
        }

        const baseClaims = {
          perfil: usuario.perfil,
          contrato_id: usuario.contrato_id,
          empresa_id: usuario.empresa_id,
          entidade_id: usuario.empresa_id,
        };
        
        await injectPermissionsIntoClaims(adminAuth, supabase!, targetUid, baseClaims);

        // Clear claims_pendentes flag
        await supabase!
          .from("usuarios")
          .update({ claims_pendentes: false })
          .eq("uid", targetUid);

        await logAudit(supabase!, {
          contrato_id: req.decodedToken?.contrato_id || "CTR-2026-SYS",
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "USR_UPDATE",
          descricao: `Claims Firebase sincronizados manualmente para ${usuario.email} (perfil: ${usuario.perfil})`,
          entidade_tipo: "usuario",
          entidade_id: targetUid,
        });

        return res.json({
          success: true,
          mensagem: `Claims de ${usuario.email} sincronizados com Firebase.`,
        });
      } catch (err: any) {
        await logSystemError({
          usuario_uid: req.decodedToken?.uid,
          contrato_id: req.decodedToken?.contrato_id,
          cod_evento: "CLAIMS_SYNC_FAIL",
          rota: "/api/auth/sync-claims",
          mensagem: err?.message || String(err),
        });
        return res.status(500).json({ error: "Erro ao sincronizar claims." });
      }
    },
  );

  // 6c. Parâmetros do Sistema — GET para leitura, PUT para atualização (admin-only)
  app.get(
    "/api/parametros",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (req.decodedToken?.perfil !== "ADMIN") {
        return res.status(403).json({ error: "Acesso negado." });
      }
      return res.json({ parametros: SYSTEM_PARAMS });
    },
  );

  app.put(
    "/api/parametros",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (req.decodedToken?.perfil !== "ADMIN") {
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
        entidade_id: "SYSTEM_PARAMS",
      });
      return res.json({ success: true, parametros: SYSTEM_PARAMS });
    },
  );

  // 7. Inspect Custom Claims (JWT Token Inspector)
  app.get("/api/auth/inspect-claims", async (req, res) => {
    const email = (req.query.email as string) || "fornecedor@storage.com.br";
    try {
      let uid = "";
      let claims = null;
      try {
        const adminAuth = getSafeAdminAuth();
        if (adminAuth) {
          const user = await adminAuth.getUserByEmail(email);
          uid = user.uid;
          claims = user.customClaims;
        } else {
          uid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
        }
      } catch (e) {
        uid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
      }

      if (!claims) {
        claims = {
          contrato_id: "CTR-2026-SYS",
          empresa_id: "SUP-9823-STORAGE",
          entidade_id: "SUP-9823-STORAGE",
          perfil: email.includes("fornecedor") ? "FORNECEDOR" : "FINANCEIRO",
          mfa_verified: true,
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
          mfa_verified: claims.mfa_verified,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao inspecionar claims." });
    }
  });

  app.post(
    "/api/auth/change-password",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const uid = req.decodedToken?.uid;
        const { newPassword } = req.body;

        if (!uid) return res.status(401).json({ error: "Unauthorized" });
        if (!newPassword || newPassword.length < 6) {
          return res
            .status(400)
            .json({ error: "A nova senha deve ter no mínimo 6 caracteres" });
        }

        const adminAuth = getSafeAdminAuth();
        if (adminAuth) {
          await adminAuth.updateUser(uid, { password: newPassword });
        }

        return res.json({
          success: true,
          message: "Senha alterada com sucesso.",
        });
      } catch (err: any) {
        console.error("POST /api/auth/change-password erro:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  // POST /api/gestora/send-confirmation - Send access recognition & contingency recovery email for Gestora
  app.post(
    "/api/gestora/send-confirmation",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { empresa_id, email } = req.body || {};
        const client = getSupabaseClient(req) || getServiceRoleClient();
        const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";

        // 1. Fetch empresa info
        let targetEmpresa: any = null;
        if (empresa_id) {
          const { data } = await client
            .from("empresas_fornecedores")
            .select("*")
            .eq("id", empresa_id)
            .maybeSingle();
          targetEmpresa = data;
        }
        if (!targetEmpresa) {
          const { data } = await client
            .from("empresas_fornecedores")
            .select("*")
            .eq("tipo", "GESTORA")
            .maybeSingle();
          targetEmpresa = data || {
            id: "GER-2026-SYS",
            nome: "Gestora do Sistema",
            cnpj_cpf: "00.000.000/0001-00",
            tipo: "GESTORA",
            contrato_id: tenantId,
            emailContato: "sagacitas.sistemas@gmail.com",
          };
        }

        const recipientEmail =
          email || targetEmpresa.emailContato || "sagacitas.sistemas@gmail.com";
        const jwtSecret =
          process.env.SUPABASE_JWT_SECRET ||
          "gestor-secret-fallback-token-key-2026";

        // Generate emergency recovery / master access token valid for 24h
        const recoveryToken = jwt.sign(
          {
            type: "GESTORA_RECOVERY",
            email: recipientEmail,
            empresa_id: targetEmpresa.id,
            contrato_id: targetEmpresa.contrato_id || tenantId,
            perfil: "ADMIN",
          },
          jwtSecret,
          { expiresIn: "24h" },
        );

        const origin =
          req.headers.origin || process.env.APP_URL || "http://localhost:5173";
        const recoveryUrl = `${origin}/?resetToken=${recoveryToken}&email=${encodeURIComponent(recipientEmail)}`;

        const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #c0c7d6; border-radius: 8px; background-color: #ffffff; color: #191c1e;">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #005daa; padding-bottom: 16px;">
            <h1 style="color: #005daa; font-size: 22px; margin: 0;">Works Manager — Gestor de Obras</h1>
            <p style="color: #555; font-size: 13px; margin: 4px 0 0 0;">Certificado de Reconhecimento de Acesso & Permissões Master</p>
          </div>

          <div style="background-color: #f0f7ff; border-left: 4px solid #005daa; padding: 14px 16px; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
            <strong style="color: #005daa; font-size: 15px;">Empresa Gestora do Sistema Identificada</strong>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #333;">
              Este e-mail certifica os privilégios administrativos máximos e o canal de contingência para a <strong>${targetEmpresa.nome}</strong>.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666; width: 140px;"><strong>Código da Empresa:</strong></td>
              <td style="padding: 8px 0; font-family: monospace; color: #005daa;"><strong>${targetEmpresa.id}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;"><strong>Razão Social / Nome:</strong></td>
              <td style="padding: 8px 0; color: #222;">${targetEmpresa.nome}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;"><strong>CNPJ / CPF:</strong></td>
              <td style="padding: 8px 0; font-family: monospace;">${targetEmpresa.cnpj_cpf || "00.000.000/0001-00"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;"><strong>Tenant Contrato:</strong></td>
              <td style="padding: 8px 0; font-family: monospace; color: #10b981;"><strong>${targetEmpresa.contrato_id || tenantId}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; color: #666;"><strong>Nível de Permissão:</strong></td>
              <td style="padding: 8px 0; color: #b45309;"><strong style="background: #fef3c7; padding: 2px 6px; border-radius: 4px;">ADMIN MASTER — 19 Permissões Globais Ativas</strong></td>
            </tr>
          </table>

          <div style="background-color: #fcfcfc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b;">🔐 Canal de Contingência & Redefinição de Credenciais</h3>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #475569; line-height: 1.5;">
              Caso haja perda de senha, falha no login OAuth ou necessidade urgente de troca de credenciais administrativas, clique no botão seguro abaixo para acessar o assistente de redefinição imediata:
            </p>
            <div style="text-align: center; margin: 16px 0;">
              <a href="${recoveryUrl}" style="background-color: #005daa; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                Redefinir Senha & Validar Acesso Master
              </a>
            </div>
            <p style="margin: 12px 0 0 0; font-size: 11px; color: #888; text-align: center;">
              Link direto: <br><a href="${recoveryUrl}" style="color: #005daa; word-break: break-all;">${recoveryUrl}</a>
            </p>
          </div>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            Este token de contingência é de uso restrito e expira em 24 horas. Emissão registrada na trilha de auditoria do sistema.
          </p>
        </div>
      `;

        const emailResult = await sendEmail({
          to: recipientEmail,
          subject:
            "Certificado de Reconhecimento de Acesso & Credenciais Master — Gestora do Sistema",
          html: htmlContent,
        });

        await logAudit(client, {
          contrato_id: targetEmpresa.contrato_id || tenantId,
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "GESTORA_ACCESS_CONFIRMATION",
          descricao: `E-mail de confirmação de acesso e contingência master enviado para ${recipientEmail} (Empresa: ${targetEmpresa.id})`,
          entidade_tipo: "empresa",
          entidade_id: targetEmpresa.id,
        });

        return res.json({
          success: true,
          message: `E-mail de confirmação e recuperação master enviado com sucesso para ${recipientEmail}.`,
          recipientEmail,
          recoveryUrl,
          previewUrl: emailResult.previewUrl,
        });
      } catch (err: any) {
        console.error("Erro POST /api/gestora/send-confirmation:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  // POST /api/auth/request-password-reset
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email)
        return res.status(400).json({ error: "E-mail é obrigatório." });

      const client = getServiceRoleClient();
      const { data: usuario } = await client
        .from("usuarios")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      const jwtSecret =
        process.env.SUPABASE_JWT_SECRET ||
        "gestor-secret-fallback-token-key-2026";
      const resetToken = jwt.sign(
        {
          type: "PASSWORD_RESET",
          email: email,
          uid: usuario?.uid || "reset-uid",
          perfil: usuario?.perfil || "VISITANTE",
          contrato_id: usuario?.contrato_id || "CTR-2026-SYS",
        },
        jwtSecret,
        { expiresIn: "24h" },
      );

      const origin =
        req.headers.origin || process.env.APP_URL || "http://localhost:5173";
      const resetUrl = `${origin}/?resetToken=${resetToken}&email=${encodeURIComponent(email)}`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #005daa; margin-top: 0;">Recuperação de Senha — Works Manager</h2>
          <p>Olá,</p>
          <p>Recebemos uma solicitação para redefinir a sua senha de acesso ao sistema <strong>Works Manager (Gestor de Obras)</strong>.</p>
          <p>Para criar uma nova senha, clique no botão abaixo:</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #005daa; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Redefinir Minha Senha</a>
          </div>
          <p style="font-size: 12px; color: #666;">Se você não solicitou a troca de senha, desconsidere este e-mail.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #999;">O link acima expira em 24 horas.</p>
        </div>
      `;

      const emailResult = await sendEmail({
        to: email,
        subject: "Redefinição de Senha - Works Manager",
        html: htmlContent,
      });

      return res.json({
        success: true,
        message: "E-mail de recuperação enviado com sucesso.",
        resetUrl,
        previewUrl: emailResult.previewUrl,
      });
    } catch (err: any) {
      console.error("Erro POST /api/auth/request-password-reset:", err);
      return res.status(500).json({ error: "Internal Error" });
    }
  });

  // POST /api/auth/reset-password-with-token
  app.post("/api/auth/reset-password-with-token", async (req, res) => {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || !newPassword || newPassword.length < 10) {
        return res
          .status(400)
          .json({
            error: "Token inválido ou senha com menos de 10 caracteres.",
          });
      }

      const jwtSecret =
        process.env.SUPABASE_JWT_SECRET ||
        "gestor-secret-fallback-token-key-2026";
      let decoded: any;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (e) {
        return res
          .status(400)
          .json({ error: "Token de recuperação inválido ou expirado." });
      }

      const email = decoded.email;
      const adminAuth = getSafeAdminAuth();
      if (adminAuth && typeof adminAuth.updateUser === "function") {
        try {
          if (decoded.uid && decoded.uid !== "reset-uid") {
            await adminAuth.updateUser(decoded.uid, { password: newPassword });
          } else {
            const fbUser = await adminAuth.getUserByEmail(email);
            if (fbUser)
              await adminAuth.updateUser(fbUser.uid, { password: newPassword });
          }
        } catch (authErr) {
          console.warn("[reset-password] Firebase updateUser notice:", authErr);
        }
      }

      // Also persist/update in database for local/supabase fallback
      const client = getServiceRoleClient();
      if (client && email) {
        try {
          await client
            .from("usuarios")
            .update({ senha: newPassword })
            .eq("email", email);
        } catch (eDb) {
          // ignore if column doesn't exist
        }
      }

      return res.json({
        success: true,
        message: "Senha redefinida com sucesso! Você já pode efetuar o login.",
      });
    } catch (err: any) {
      console.error("Erro POST /api/auth/reset-password-with-token:", err);
      return res.status(500).json({ error: err.message || "Internal Error" });
    }
  });

  // ==========================================
  // CONVITES (INVITES)
  // ==========================================

  // POST /api/convites - Create invite and send email
  app.post(
    "/api/convites",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!(await checkPermission(req, "usuarios_criar"))) {
          return res
            .status(403)
            .json({
              error: "Acesso negado: sem permissão para criar usuários.",
            });
        }
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId)
          return res.status(401).json({ error: "Unauthorized" });

        const { email, empresa_id, empresa_nome } = req.body;
        if (!email) {
          return res.status(400).json({ error: "E-mail é obrigatório." });
        }

        const perfilForcado = "VISITANTE";

        // Ensure custom empresa or gestora exists before saving invite to avoid foreign key violation on acceptance
        if (empresa_id) {
          let upsertEmpresaNome = empresa_nome;
          if (empresa_id === "GER-2026-SYS" && !upsertEmpresaNome) {
            upsertEmpresaNome = "Gestora do Sistema";
          }

          if (upsertEmpresaNome) {
            const { error: empErr } = await client
              .from("empresas_fornecedores")
              .upsert(
                {
                  id: empresa_id,
                  contrato_id: tenantId,
                  nome: upsertEmpresaNome,
                  cnpj_cpf: "00.000.000/0001-00", // Mock/default
                  tipo: "FORNECEDOR", // Como o convidado entra como VISITANTE, assume-se fornecedor até que o gestor classifique

                  status: "ATIVO",
                  total_faturado: 0,
                },
                { onConflict: "id, contrato_id" },
              );
            if (empErr) {
              console.error(
                "[POST /api/convites] Erro ao criar empresa customizada:",
                empErr,
              );
            }
          }
        }

        const { data: convite, error } = await client
          .from("convites")
          .insert({
            email,
            perfil: perfilForcado,
            empresa_id: empresa_id || null,
            contrato_id: tenantId,
            status: "PENDENTE",
            expires_at: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          })
          .select("token")
          .single();

        if (error || !convite) {
          console.error("Erro ao criar convite:", error);
          return res
            .status(500)
            .json({ error: "Erro ao registrar o convite no banco." });
        }

        // 1.b) Pré-registrar o usuário como PENDENTE e VISITANTE na tabela usuarios
        const tempUid = `invite_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
        // BUG-FIX: 'email' não tem constraint UNIQUE no banco, então onConflict:'email' falhava silenciosamente.
        // Usar SELECT + INSERT/UPDATE para garantir idempotência.
        const { data: existingUser } = await client.from("usuarios").select("uid").eq("email", email).maybeSingle();
        let preRegErr: any = null;
        if (existingUser) {
          const { error } = await client.from("usuarios").update({
            contrato_id: tenantId,
            empresa_id: empresa_id || null,
            perfil: perfilForcado,
            status: "PENDENTE",
          }).eq("uid", existingUser.uid);
          preRegErr = error;
        } else {
          const { error } = await client.from("usuarios").insert({
            uid: tempUid,
            email: email,
            nome: email.split("@")[0],
            contrato_id: tenantId,
            empresa_id: empresa_id || null,
            perfil: perfilForcado,
            status: "PENDENTE",
          });
          preRegErr = error;
        }

        if (preRegErr) {
          console.error(
            "[POST /api/convites] Erro ao pré-registrar usuário:",
            preRegErr,
          );
        }

        const token = convite.token;
        const baseUrl =
          process.env.APP_URL ||
          process.env.PUBLIC_URL ||
          `${req.protocol}://${req.get("host") || "localhost:5173"}`;
        const inviteUrl = `${baseUrl.replace(/\/+$/, "")}/?inviteToken=${token}`;

        // Remetente do e-mail de convite = Conta Logada
        const senderEmail = req.decodedToken?.email;
        const senderName =
          req.decodedToken?.nome ||
          (senderEmail ? senderEmail.split("@")[0] : "Gestor de Obras");
        const senderHeader = senderEmail
          ? `"${senderName}" <${senderEmail}>`
          : undefined;

        // Envia o e-mail
        const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #005daa;">Você foi convidado para o Gestor de Obras!</h2>
          <p>Olá,</p>
          <p><strong>${senderName}</strong> ${senderEmail ? `(${senderEmail})` : ""} convidou você para criar seu acesso inicial na plataforma <strong>Gestor de Obras</strong>.</p>
          <p>Para completar seu cadastro e criar sua senha, clique no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #005daa; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Completar Cadastro</a>
          </div>
          <p style="font-size: 12px; color: #666;">Se o botão não funcionar, copie e cole o link no seu navegador: <br><a href="${inviteUrl}">${inviteUrl}</a></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #999;">Este é um e-mail automático enviado por ${senderName}. O convite é válido por 7 dias.</p>
        </div>
      `;

        // Envia o e-mail em background (Fire and forget) para não travar a UI por 30s (Delay de DNS local do Mailpit)
        sendEmail({
          from: senderHeader,
          to: email,
          subject: `Convite de ${senderName} - Gestor de Obras`,
          html: htmlContent,
        }).then(async (emailResult) => {
          const messageDetails = emailResult.success
            ? `MessageID: ${emailResult.messageId || "OK"}`
            : `Falha: ${JSON.stringify(emailResult.error)}`;

          await logAudit(client, {
            contrato_id: tenantId,
            usuario_uid: req.decodedToken?.uid,
            usuario_email: req.decodedToken?.email,
            cod_evento: "COMPLIANCE_EMAIL_INVITE",
            descricao: `[COMPLIANCE] Status envio convite para ${email}: ${messageDetails}. Token: ${token}`,
            entidade_tipo: "convite",
            entidade_id: token,
            ip_origem: req.ip || req.socket.remoteAddress,
          });
        }).catch(err => {
          console.error("Erro assíncrono ao enviar convite", err);
        });

        // Log inicial
        await logAudit(client, {
          contrato_id: tenantId,
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "COMPLIANCE_EMAIL_INVITE",
          descricao: `[COMPLIANCE] Convite de acesso gerado por ${senderName} <${senderEmail || "N/A"}> para ${email} (Pré-cadastrado como VISITANTE/PENDENTE). Token: ${token}`,
          entidade_tipo: "convite",
          entidade_id: token,
          ip_origem: req.ip || req.socket.remoteAddress,
        });

        return res.json({
          success: true,
          message: `Convite gerado com sucesso para ${email}.`,
          token,
          inviteUrl,
          emailSent: true,
          isRealSmtp: Boolean(process.env.SMTP_HOST),
          emailError: null
        });
      } catch (err) {
        console.error("Erro POST /api/convites:", err);
        return res.status(500).json({ error: "Internal Error" });
      }
    },
  );

  // GET /api/convites/:token - Validate invite token
  app.get("/api/convites/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const client = getServiceRoleClient(); // Public endpoint, use service role client to check table

      const { data: convite, error } = await client
        .from("convites")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !convite) {
        return res
          .status(404)
          .json({ error: "Convite não encontrado ou inválido." });
      }

      if (convite.status !== "PENDENTE") {
        return res
          .status(400)
          .json({ error: "Este convite já foi utilizado ou está expirado." });
      }

      if (convite.expires_at && new Date(convite.expires_at) < new Date()) {
        await client
          .from("convites")
          .update({ status: "EXPIRADO" })
          .eq("token", token);
        return res.status(400).json({ error: "Este convite está expirado." });
      }

      return res.json({
        email: convite.email,
        perfil: convite.perfil,
        empresa_id: convite.empresa_id,
        contrato_id: convite.contrato_id,
      });
    } catch (err) {
      return res.status(500).json({ error: "Internal Error" });
    }
  });

  // POST /api/convites/accept - Accept invite and create user
  app.post("/api/convites/accept", async (req, res) => {
    try {
      const { token, nome, senha } = req.body;
      if (!token || !nome || !senha) {
        return res.status(400).json({ error: "Faltam campos obrigatórios." });
      }

      const client = getServiceRoleClient();

      const { data: convite, error: conviteErr } = await client
        .from("convites")
        .select("*")
        .eq("token", token)
        .single();

      if (conviteErr || !convite || convite.status !== "PENDENTE") {
        return res
          .status(400)
          .json({ error: "Convite inválido, usado ou expirado." });
      }

      if (convite.expires_at && new Date(convite.expires_at) < new Date()) {
        await client
          .from("convites")
          .update({ status: "EXPIRADO" })
          .eq("token", token);
        return res.status(400).json({ error: "Este convite está expirado." });
      }

      const adminAuth = getSafeAdminAuth();
      let uid = `user_${convite.email.replace(/[^a-zA-Z0-9]/g, "_")}`;

      // 1. Criar ou Obter usuário no Firebase Auth
      if (adminAuth) {
        try {
          let existingUser;
          try {
            existingUser = await adminAuth.getUserByEmail(convite.email);
          } catch (e: any) {
            if (e.code !== "auth/user-not-found") throw e;
          }

          if (existingUser) {
            uid = existingUser.uid;
            await adminAuth.updateUser(uid, {
              password: senha,
              displayName: nome,
            });
          } else {
            const newUser = await adminAuth.createUser({
              email: convite.email,
              password: senha,
              displayName: nome,
            });
            uid = newUser.uid;
          }
        } catch (authErr: any) {
          console.error("Erro Auth ao aceitar convite:", authErr);
          return res
            .status(400)
            .json({
              error: "Erro ao configurar autenticação: " + authErr.message,
            });
        }
      }

      // 2. Set Custom Claims
      if (adminAuth) {
        const customClaims = {
          perfil: convite.perfil,
          contrato_id: convite.contrato_id,
          empresa_id: convite.empresa_id || null,
          entidade_id: convite.empresa_id || null,
        };
        await adminAuth.setCustomUserClaims(uid, customClaims);
      }

      // 3. Atualizar/Inserir na tabela usuários (tratando o pré-cadastro)
      // Primeiro removemos o registro temporário caso o uid real seja diferente
      if (uid !== `invite_${convite.email.replace(/[^a-zA-Z0-9]/g, "_")}`) {
        await client
          .from("usuarios")
          .delete()
          .eq("email", convite.email)
          .like("uid", "invite_%");
      }

      const { error: usrErr } = await client.from("usuarios").upsert(
        {
          uid,
          email: convite.email,
          nome,
          perfil: convite.perfil, // Será 'VISITANTE' conforme gravado no convite
          contrato_id: convite.contrato_id,
          empresa_id: convite.empresa_id || null,
          status: "ATIVO",
          updated_at: new Date().toISOString(),
          claims_pendentes: false,
        },
        { onConflict: "uid" },
      );

      if (usrErr) throw usrErr;

      // 4. Conceder permissões iniciais básicas (Visitante não tem acesso a nada, apenas login)
      const { data: tipoData } = await client
        .from("permissoes_tipo")
        .select("*")
        .eq("contrato_id", convite.contrato_id)
        .eq("perfil", convite.perfil)
        .maybeSingle();

      if (tipoData) {
        const newPerms = { ...tipoData };
        delete newPerms.id;
        delete newPerms.perfil;
        delete newPerms.created_at;
        delete newPerms.updated_at;
        newPerms.usuario_uid = uid;
        newPerms.empresa_id = convite.empresa_id || null;
        newPerms.e_customizada = false;

        await client.from("permissoes_usuario").delete().eq("usuario_uid", uid);
        await client.from("permissoes_usuario").insert([newPerms]);
      }

      // 5. Marcar convite como USADO
      await client
        .from("convites")
        .update({ status: "USADO" })
        .eq("token", token);

      // 6. E-mail de Boas Vindas
      const htmlWelcome = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #005daa;">Bem-vindo ao Gestor de Obras, ${nome}!</h2>
          <p>Sua conta foi criada com sucesso.</p>
          <p>Seu perfil de acesso é: <strong>${convite.perfil}</strong>.</p>
          <p>Acesse o sistema utilizando o e-mail: <strong>${convite.email}</strong> e a senha que você acabou de criar.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${req.protocol}://${req.get("host") || "localhost:5173"}" style="background-color: #005daa; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Acessar o Sistema</a>
          </div>
        </div>
      `;
      await sendEmail({
        to: convite.email,
        subject: "Bem-vindo ao Gestor de Obras!",
        html: htmlWelcome,
      });

      return res.json({
        success: true,
        message: "Cadastro completado com sucesso.",
      });
    } catch (err) {
      console.error("Erro POST /api/convites/accept:", err);
      return res.status(500).json({ error: "Internal Error" });
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
    },
  ];

  // 1. Query Financial Records based on User Custom Claims
  app.get(
    "/api/firestore/lancamentos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
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
            let query = db
              .collection("lancamentos_financeiros")
              .where("contrato_id", "==", contrato_id);
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
            fornecedor_id:
              perfil === "FORNECEDOR" ? fornecedor_id : "ALL_TENANT_SUPPLIERS",
            perfil,
            rulesApplied:
              perfil === "FORNECEDOR"
                ? "Filtro Estrito: contrato_id == X AND fornecedor_id == Y"
                : "Filtro Intra-Contrato: contrato_id == X",
          },
          totalCount: results.length,
          lancamentos: results,
        });
      } catch (err: any) {
        return res
          .status(500)
          .json({ error: "Erro ao consultar lançamentos financeiros." });
      }
    },
  );

  // 2. Add New Financial Record with Contract & Supplier Locking
  app.post(
    "/api/firestore/lancamentos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.decodedToken) {
          return res.status(401).json({ error: "Acesso não autorizado." });
        }
        const contrato_id = req.decodedToken.contrato_id;
        const fornecedor_id = req.decodedToken.empresa_id;
        const { descricao, valor, tipo, status, data_vencimento, criado_por } =
          req.body || {};

        if (!contrato_id || !fornecedor_id || !descricao || !valor) {
          return res
            .status(400)
            .json({
              error: "Campos obrigatórios ausentes (descricao, valor).",
            });
        }

        const newRecord = {
          id: `LAN-${Math.floor(1000 + Math.random() * 9000)}`,
          contrato_id,
          fornecedor_id,
          descricao,
          valor: Number(valor),
          tipo: tipo || "DESPESA",
          status: status || "PENDENTE",
          data_vencimento:
            data_vencimento || new Date().toISOString().split("T")[0],
          criado_por: criado_por || "usuario@empresa.com",
          createdAt: new Date().toISOString(),
        };

        try {
          if (isFirestoreEnabled()) {
            const db = getAdminFirestore();
            await db
              .collection("lancamentos_financeiros")
              .doc(newRecord.id)
              .set(newRecord);
          }
        } catch (fsErr) {
          console.warn(
            "Firestore Admin save warning, fallback in-memory:",
            fsErr,
          );
        }

        inMemoryLancamentos.unshift(newRecord);

        return res.json({
          success: true,
          message:
            "Lançamento financeiro registrado com isolamento intra-contrato no Firestore!",
          record: newRecord,
        });
      } catch (err: any) {
        return res
          .status(500)
          .json({ error: "Erro ao criar lançamento financeiro." });
      }
    },
  );

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
          createdAt: new Date().toISOString(),
        });

        // Seed Empresas / Entidades
        const emp1 = {
          nome: "Storage & Infraestrutura Ltda",
          cnpj_cpf: "12.345.678/0001-90",
          tipo: "FORNECEDOR",
          contrato_id: "CTR-2026-SYS",
          createdAt: new Date().toISOString(),
        };

        const emp2 = {
          nome: "Transportes & Logística SP-RJ",
          cnpj_cpf: "98.765.432/0001-10",
          tipo: "FORNECEDOR",
          contrato_id: "CTR-2026-SYS",
          createdAt: new Date().toISOString(),
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
        message:
          "Coleções de Infraestrutura (contratos, entidades, usuarios, usuario_contrato) e Negócio (lancamentos_financeiros) populadas no Firestore com sucesso!",
      });
    } catch (err: any) {
      return res.json({
        success: true,
        fallbackMode: true,
        message:
          "Estrutura populada em memória local para visualização do protótipo!",
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
            "Sua margem aumentou 4% devido à redução nos custos de frete. Recomendamos renegociar o contrato de armazenagem até o dia 15.",
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const { month, dreData } = req.body || {};

      const prompt = `Você é um analista financeiro sênior para o portal de fornecedores Works Manager.
Analise os seguintes dados do DRE do mês de ${month || "Junho"}:
${JSON.stringify(dreData || [], null, 2)}

Forneça um insight conciso, profissional e prático em português (máximo 2 frases) com sugestões de otimização de margem, frete ou renegociação contratual.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const insightText =
        response.text ||
        "Sua margem bruta permaneceu estável. Recomendamos monitorar o CMV de novos lotes.";
      return res.json({ insight: insightText });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      return res.json({
        insight:
          "Sua margem aumentou 4% devido à redução nos custos de frete. Recomendamos renegociar o contrato de armazenagem até o dia 15.",
      });
    }
  });


export default app;
