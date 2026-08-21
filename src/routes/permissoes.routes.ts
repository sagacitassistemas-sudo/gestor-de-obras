import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, checkPermission, saveRecord, ensureUserExists } from "../lib/server.lib";

const router = Router();

  // 1. Contratante (Admin configs)
  router.get(
    "/api/permissoes/contratante",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

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
    },
  );

  router.post(
    "/api/permissoes/contratante",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const payload = {
          ...req.body,
          contrato_id: req.decodedToken.contrato_id,
        };
        delete payload.id;

        const { data, error } = await saveRecord(
          client,
          "permissoes_contratante",
          payload,
          { onConflict: "contrato_id", single: false },
        );

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 1.5 Tipo de Perfil (Role)
  router.get(
    "/api/permissoes/tipo",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const { data, error } = await client
          .from("permissoes_tipo")
          .select("*");

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  router.post(
    "/api/permissoes/tipo",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const payload = {
          ...req.body,
          contrato_id: req.decodedToken.contrato_id,
        };
        delete payload.id; // avoid id conflict

        const { data, error } = await saveRecord(
          client,
          "permissoes_tipo",
          payload,
          { onConflict: "contrato_id, perfil", single: false },
        );

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 2. Empresas
  router.get(
    "/api/permissoes/empresa",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const { data, error } = await client
          .from("permissoes_empresa")
          .select("*")
          .eq("contrato_id", req.decodedToken.contrato_id);

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  router.post(
    "/api/permissoes/empresa",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const payload = {
          ...req.body,
          contrato_id: req.decodedToken.contrato_id,
        };
        delete payload.id;

        const { data, error } = await saveRecord(
          client,
          "permissoes_empresa",
          payload,
          { onConflict: "empresa_id, contrato_id", single: false },
        );

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 3. Usuários
  router.get(
    "/api/permissoes/usuario",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        let query = client
          .from("permissoes_usuario")
          .select("*")
          .eq("contrato_id", req.decodedToken.contrato_id);

        // Se for fornecedor, só vê permissões da própria empresa
        if (
          req.decodedToken.perfil === "FORNECEDOR" &&
          req.decodedToken.empresa_id
        ) {
          query = query.eq("empresa_id", req.decodedToken.empresa_id);
        }

        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  router.post(
    "/api/permissoes/usuario",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const payload = {
          ...req.body,
          contrato_id: req.decodedToken.contrato_id,
          updated_at: new Date().toISOString(),
        };
        delete payload.id;
        delete payload.e_customizada; // Ensure it's not passed from req.body either

        const { data, error } = await saveRecord(
          client,
          "permissoes_usuario",
          payload,
          { onConflict: "usuario_uid, contrato_id", single: false },
        );

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ success: true, data: data?.[0] });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 4. Permissões Efetivas
  router.get(
    "/api/permissoes/efetivas/:uid",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      if (!req.decodedToken)
        return res.status(401).json({ error: "Acesso não autorizado." });
      try {
        const client = getSupabaseClient(req);
        if (!client)
          return res.status(500).json({ error: "Supabase não configurado." });

        const uid = req.params.uid;

        // Auto-ensure requesting user exists in DB
        await ensureUserExists(client, {
          uid: req.decodedToken.uid,
          email: req.decodedToken.email,
          nome: req.decodedToken.nome,
          photoURL: req.decodedToken.photoURL,
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
    },
  );

  // Health check endpoint
  // ==========================================
  // CONTRATOS DE OBRA
  // ==========================================


export default router;
