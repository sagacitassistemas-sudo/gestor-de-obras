import { Router } from "express";
import { getSupabaseClient, saveRecord } from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { checkPermission } from "../lib/server.lib";
import { AuthenticatedRequest } from "../types/middleware.types";

const app = Router();

  // GET /api/audit-log
  app.get(
    "/api/audit-log",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (
          !(await checkPermission(req, "usuarios_ler")) ||
          req.decodedToken?.perfil !== "ADMIN"
        ) {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const { data, error } = await client
          .from("audit_log")
          .select(
            `
          *,
          sistema_eventos_catalogo (
            descricao,
            categoria
          )
        `,
          )
          .order("criado_em", { ascending: false })
          .limit(100);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, logs: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // GET /api/system-errors
  app.get(
    "/api/system-errors",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken?.perfil !== "ADMIN") {
          return res.status(403).json({ error: "Acesso negado." });
        }

        const { data, error } = await client
          .from("system_error_log")
          .select(
            `
          *,
          sistema_eventos_catalogo (
            descricao,
            categoria
          )
        `,
          )
          .order("criado_em", { ascending: false })
          .limit(100);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, errors: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // ==========================================
  // VALIDAÇÕES DO DESENVOLVEDOR (AUDITORIA)
  // ==========================================

  // GET /api/validacoes
  app.get(
    "/api/validacoes",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken?.perfil !== "ADMIN") {
          return res
            .status(403)
            .json({ error: "Acesso negado. Apenas ADMIN." });
        }

        const { data, error } = await client
          .from("validacoes_desenvolvedor")
          .select("*")
          .order("criado_em", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, validacoes: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // POST /api/validacoes (Criar pendência pelo agente/IA)
  app.post(
    "/api/validacoes",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken?.perfil !== "ADMIN") {
          return res
            .status(403)
            .json({ error: "Acesso negado. Apenas ADMIN." });
        }

        const { titulo, descricao, agente, link_referencia } = req.body;
        if (!titulo)
          return res.status(400).json({ error: "titulo obrigatório" });

        const { data, error } = await client
          .from("validacoes_desenvolvedor")
          .insert([
            {
              titulo,
              descricao,
              agente: agente || "Antigravity",
              link_referencia,
            },
          ])
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, validacao: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // PUT /api/validacoes/:id (Validar ou Falhar)
  app.put(
    "/api/validacoes/:id",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken?.perfil !== "ADMIN") {
          return res
            .status(403)
            .json({ error: "Acesso negado. Apenas ADMIN." });
        }

        const { id } = req.params;
        const { status, notas_validacao } = req.body;

        if (!["VALIDADO", "FALHOU", "PENDENTE"].includes(status)) {
          return res.status(400).json({ error: "Status inválido" });
        }

        const uid = req.decodedToken.uid;

        const { data, error } = await client
          .from("validacoes_desenvolvedor")
          .update({
            status,
            notas_validacao,
            validado_em:
              status !== "PENDENTE" ? new Date().toISOString() : null,
            responsavel_uid: uid,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, validacao: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // POST /api/diagnostic/persistence
  app.post(
    "/api/diagnostic/persistence",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        if (req.decodedToken?.perfil !== "ADMIN") {
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
          status: "ATIVO",
        };
        const { error: err1 } = await saveRecord(
          client,
          "empresas_fornecedores",
          empData,
          { idField: "id", onConflict: "id, contrato_id" },
        );
        if (err1)
          throw new Error(`Falha no INSERT da empresa: ${err1.message}`);
        logs.push("INSERT empresa: OK");

        // 2. Read Company
        logs.push(
          "Testando SELECT na empresa recém-criada (Verificação de RLS)...",
        );
        const { data: fetchEmp, error: err2 } = await client
          .from("empresas_fornecedores")
          .select("*")
          .eq("id", testId)
          .single();
        if (err2 || !fetchEmp)
          throw new Error(
            `Falha no SELECT da empresa: ${err2?.message || "Registro não encontrado (Falha Silenciosa de RLS)"}`,
          );
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
          status: "ATIVO",
        };
        const { error: err3 } = await saveRecord(client, "usuarios", usrData, {
          idField: "uid",
          onConflict: "uid",
        });
        if (err3)
          throw new Error(`Falha no INSERT do usuario: ${err3.message}`);
        logs.push("INSERT usuario (com empresa_id): OK");

        // 4. Clean up
        logs.push("Limpando dados de teste (DELETE)...");
        await client.from("usuarios").delete().eq("uid", testId);
        await client
          .from("empresas_fornecedores")
          .delete()
          .eq("id", testId)
          .eq("contrato_id", tenantId);
        logs.push("Limpeza: OK");

        logs.push(
          "SUCESSO: A persistência e o vínculo de chaves estrangeiras estão funcionais sob as políticas atuais.",
        );
        return res.json({ success: true, logs });
      } catch (err: any) {
        console.error("Diagnostic failed:", err);
        return res.json({ success: false, error: err.message });
      }
    },
  );


export default app;
