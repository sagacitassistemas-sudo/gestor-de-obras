import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, checkPermission, saveRecord, ensureUserExists, getSafeAdminAuth } from "../lib/server.lib";
import { logAudit } from "../services/logger.service";

const router = Router();

  // GET /api/usuarios
  router.get(
    "/api/usuarios",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!(await checkPermission(req, "usuarios_ler"))) {
          return res
            .status(403)
            .json({ error: "Acesso negado: sem permissão para ler usuários." });
        }
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken) {
          await ensureUserExists(client, {
            uid: req.decodedToken.uid,
            email: req.decodedToken.email,
            nome: req.decodedToken.nome,
            photoURL: req.decodedToken.photoURL,
          });
        }

        const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 100;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const empresaId = req.decodedToken?.empresa_id;

        let query = client
          .from("usuarios")
          .select(
            "*, empresas_fornecedores!usuarios_empresa_id_contrato_id_fkey(nome)",
          )
          .eq("contrato_id", tenantId)
          .range(from, to);

        if (empresaId) {
          query = query.eq("empresa_id", empresaId);
        }

        const { data, error } = await query;

        if (error) {
          // Fallback: if the join fails (e.g. FK not yet established), query without join
          console.warn(
            "GET /api/usuarios join failed, falling back to simple query:",
            error.message,
          );
          let fallbackQuery = client
            .from("usuarios")
            .select("*")
            .eq("contrato_id", tenantId);

          if (empresaId) {
            fallbackQuery = fallbackQuery.eq("empresa_id", empresaId);
          }

          const { data: fallbackData, error: fallbackErr } = await fallbackQuery;
          if (fallbackErr)
            return res.status(500).json({ error: fallbackErr.message });
          return res.json({ usuarios: fallbackData || [] });
        }

        // Flatten the empresa_nome from the join
        const enriched = (data || []).map((u: any) => ({
          ...u,
          empresa_nome: u.empresas_fornecedores?.nome || null,
          empresas_fornecedores: undefined,
        }));

        return res.json({ usuarios: enriched });
      } catch (err) {
        console.error("GET /api/usuarios erro:", err);
        return res
          .status(500)
          .json({
            error: err instanceof Error ? err.message : "Internal Error",
          });
      }
    },
  );

  // POST /api/usuarios
  router.post(
    "/api/usuarios",
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

        let {
          uid,
          email,
          nome,
          perfil,
          status,
          empresa_id,
          empresa_nome,
          senha,
        } = req.body;
        if (!email || !nome) {
          return res
            .status(400)
            .json({ error: "Missing required fields: email, nome" });
        }

        // If no uid is provided, it's a new user creation
        if (!uid) {
          if (!senha) {
            return res
              .status(400)
              .json({ error: "Senha é obrigatória para novos usuários" });
          }
          uid = `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
          const adminAuth = getSafeAdminAuth();
          if (adminAuth) {
            try {
              // Check if user already exists in Firebase Auth to prevent 'email-already-exists' crash
              let existingUser;
              try {
                existingUser = await adminAuth.getUserByEmail(email);
              } catch (e: any) {
                if (e.code !== "auth/user-not-found") throw e;
              }

              if (existingUser) {
                uid = existingUser.uid;
              } else {
                const newUser = await adminAuth.createUser({
                  email: email,
                  password: senha,
                  displayName: nome,
                });
                uid = newUser.uid;
              }
            } catch (firebaseErr: any) {
              console.error(
                "Erro ao criar usuário no Firebase Auth:",
                firebaseErr,
              );
              return res
                .status(500)
                .json({
                  error:
                    "Erro ao criar credencial de login: " + firebaseErr.message,
                });
            }
          }
        }

        // Ensure custom empresa or gestora exists before saving user to avoid foreign key violation
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
                  tipo: perfil === "ADMIN" ? "CONTRATANTE" : "FORNECEDOR",
                  status: "ATIVO",
                  total_faturado: 0,
                },
                { onConflict: "id, contrato_id" },
              );
            if (empErr) {
              console.error(
                "[POST /api/usuarios] Erro ao criar empresa customizada:",
                empErr,
              );
            }
          }
        }

        const upsertData = {
          uid,
          email,
          nome,
          contrato_id: tenantId,
          perfil: perfil || "FORNECEDOR",
          status: status || "ATIVO",
          empresa_id: empresa_id || null,
          updated_at: new Date().toISOString(),
          claims_pendentes: true, // Invalidates Firebase token — will re-sync on next login
        };

        const { data, error } = await saveRecord(
          client,
          "usuarios",
          upsertData,
          { idField: "uid", onConflict: "uid" },
        );
        if (error) return res.status(500).json({ error: error.message });

        // Check if user has special custom permissions (e_customizada = true)
        const { data: userPermRecord } = await client
          .from("permissoes_usuario")
          .select("e_customizada")
          .eq("usuario_uid", uid)
          .maybeSingle();

        const isCustomized = userPermRecord?.e_customizada === true;
        const userPerfil = perfil || "FORNECEDOR";

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
            await client
              .from("permissoes_usuario")
              .delete()
              .eq("usuario_uid", uid);
            await client.from("permissoes_usuario").insert([newPerms]);
          }
        } else {
          console.log(
            `[POST /api/usuarios] Permissões customizadas priorizadas para o usuário ${uid}. Atualizando apenas a empresa associada.`,
          );
          await client
            .from("permissoes_usuario")
            .update({
              empresa_id: empresa_id || null,
              updated_at: new Date().toISOString(),
            })
            .eq("usuario_uid", uid);
        }

        // Sync custom claims in Firebase Admin SDK if available
        try {
          const adminAuth = getSafeAdminAuth();
          if (
            adminAuth &&
            typeof adminAuth.setCustomUserClaims === "function"
          ) {
            await adminAuth.setCustomUserClaims(uid, {
              perfil: userPerfil,
              contrato_id: tenantId,
              empresa_id: empresa_id || null,
              entidade_id: empresa_id || null,
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
          entidade_id: uid,
        });

        return res.json({ usuario: data });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    },
  );

  // DELETE /api/usuarios
  router.delete(
    "/api/usuarios",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
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
          entidade_id: uid,
        });

        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    },
  );

  // ==========================================
  // DISPOSITIVOS MOBILE API (ZERO TRUST)
  // ==========================================

  // GET /api/dispositivos
  router.get(
    "/api/dispositivos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!(await checkPermission(req, "usuarios_ler"))) {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const tenantId = req.decodedToken?.contrato_id;

        const { data, error } = await client
          .from("dispositivos_mobile")
          .select("*, funcionarios(nome, cargo, cpf, empresas_fornecedores(nome, id))")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[GET /api/dispositivos] Erro:", error);
          return res.status(500).json({ error: error.message });
        }

        // Formatar para a interface
        const formatted = (data || []).map((d: any) => ({
          ...d,
          funcionario_nome: d.funcionarios?.nome,
          funcionario_cargo: d.funcionarios?.cargo,
          funcionario_cpf: d.funcionarios?.cpf,
          empresa_id: d.funcionarios?.empresas_fornecedores?.id,
          empresa_nome: d.funcionarios?.empresas_fornecedores?.nome
        }));

        return res.json({ success: true, data: formatted });
      } catch (err: any) {
        console.error("[GET /api/dispositivos] Exception:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );

  // PATCH /api/dispositivos/:id/status
  router.patch(
    "/api/dispositivos/:id/status",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!(await checkPermission(req, "usuarios_editar"))) {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const tenantId = req.decodedToken?.contrato_id;
        const deviceId = req.params.id;
        const { status } = req.body;

        if (!["APROVADO", "BLOQUEADO", "PENDENTE"].includes(status)) {
          return res.status(400).json({ error: "Status inválido." });
        }

        const { error } = await client
          .from("dispositivos_mobile")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", deviceId)
          .eq("tenant_id", tenantId);

        if (error) {
          console.error("[PATCH /api/dispositivos/status] Erro:", error);
          return res.status(500).json({ error: error.message });
        }

        await logAudit(client, {
          contrato_id: tenantId,
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "DEVICE_UPDATE",
          descricao: `Dispositivo mobile ${deviceId} alterado para status ${status}`,
          entidade_tipo: "dispositivo_mobile",
          entidade_id: deviceId,
        });

        return res.json({ success: true });
      } catch (err: any) {
        console.error("[PATCH /api/dispositivos/status] Exception:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );

  // DELETE /api/dispositivos/:id
  router.delete(
    "/api/dispositivos/:id",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!(await checkPermission(req, "usuarios_editar"))) {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const tenantId = req.decodedToken?.contrato_id;
        const deviceId = req.params.id;

        const { error } = await client
          .from("dispositivos_mobile")
          .delete()
          .eq("id", deviceId)
          .eq("tenant_id", tenantId);

        if (error) {
          console.error("[DELETE /api/dispositivos/:id] Erro:", error);
          return res.status(500).json({ error: error.message });
        }

        await logAudit(client, {
          contrato_id: tenantId,
          usuario_uid: req.decodedToken?.uid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "DEVICE_DELETE",
          descricao: `Dispositivo mobile ${deviceId} excluído do registro.`,
          entidade_tipo: "dispositivo_mobile",
          entidade_id: deviceId,
        });

        return res.json({ success: true });
      } catch (err: any) {
        console.error("[DELETE /api/dispositivos/:id] Exception:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );



  // GET /api/ordens-servico
  // POST /api/ordens-servico
  // PATCH /api/ordens-servico/:id
  // DELETE /api/ordens-servico/:id
  // Movidos para src/routes/operacoes.routes.ts

  // ===================================================================
  // MÓDULO: ESPECIALIDADES, FUNCIONÁRIOS E EQUIPES
  // MÓDULO: CESSÕES DE PESSOAL
  // ===================================================================
  // Movidos para src/routes/recursos.routes.ts

  // GET /api/rdos
  // POST /api/rdos
  // Movidos para src/routes/rdo.routes.ts

  // ==========================================
  // MÓDULO: MATRIZ DE COMPETÊNCIAS E SSMA
  // ==========================================
  // Movidos para src/routes/competencias.routes.ts

  // ==========================================
  // [RDO_WM BFF API] - Rotas exclusivas para o App Móvel
  // ==========================================
  // Movidos para src/routes/mobile.routes.ts


export default router;
