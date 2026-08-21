/**
 * financeiro.routes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rotas do módulo Financeiro / Custos de Mão de Obra:
 *   GET/POST/DELETE  /api/ref-encargos
 *   GET              /api/ref-encargos-complementares
 *   GET              /api/ref-encargos-especificos
 *   GET              /api/ref-cargos-salarios
 *   GET/POST         /api/tenant-parametros-mao-obra/:obra_id
 *   GET              /api/custo-hora-real/:obra_id
 *   GET/POST         /api/tenant-cargos
 *   GET              /api/tenant-bdi
 *   POST             /api/bdi-calcular
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, checkPermission } from "../lib/server.lib";

const router = Router();

// ─── GET /api/ref-cargos-salarios ────────────────────────────────────────────
router.get("/ref-cargos-salarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_ler"))) return res.status(403).json({ error: "Acesso negado." });

  const uf = (req.query.uf as string) || "ES";
  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { data, error } = await client.from("ref_cargos_salarios").select("*").eq("uf", uf).order("nome_cargo");
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /api/ref-cargos-salarios error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/ref-encargos ───────────────────────────────────────────────────
router.get("/ref-encargos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_ler"))) return res.status(403).json({ error: "Acesso negado." });

  const uf = (req.query.uf as string) || "ES";
  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { data, error } = await client.from("ref_matriz_encargos").select("*").eq("uf", uf).order("codigo_item");
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /api/ref-encargos error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/ref-encargos ──────────────────────────────────────────────────
router.post("/ref-encargos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_criar")) && !(await checkPermission(req, "financeiro_editar"))) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  try {
    const payload = req.body;
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");

    let result;
    if (payload.id) {
      result = await client.from("ref_matriz_encargos").update(payload).eq("id", payload.id).select().single();
    } else {
      delete payload.id;
      result = await client.from("ref_matriz_encargos").insert(payload).select().single();
    }

    if (result.error) throw result.error;
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("POST /api/ref-encargos error:", err);
    return res.status(500).json({ error: "Erro interno ao salvar encargo", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── DELETE /api/ref-encargos/:id ────────────────────────────────────────────
router.delete("/ref-encargos/:id", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_excluir"))) return res.status(403).json({ error: "Acesso negado." });

  const id = req.params.id;
  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { error } = await client.from("ref_matriz_encargos").delete().eq("id", id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/ref-encargos error:", err);
    return res.status(500).json({ error: "Erro interno ao excluir encargo", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/ref-encargos-complementares ────────────────────────────────────
router.get("/ref-encargos-complementares", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_ler"))) return res.status(403).json({ error: "Acesso negado." });

  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { data, error } = await client.from("ref_encargos_complementares").select("*").order("categoria");
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /api/ref-encargos-complementares error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/ref-encargos-especificos ───────────────────────────────────────
router.get("/ref-encargos-especificos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_ler"))) return res.status(403).json({ error: "Acesso negado." });

  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { data, error } = await client.from("ref_encargos_especificos_funcao").select("*").order("nome_funcao");
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /api/ref-encargos-especificos error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/tenant-parametros-mao-obra/:obra_id ────────────────────────────
router.get("/tenant-parametros-mao-obra/:obra_id", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_ler"))) return res.status(403).json({ error: "Acesso negado." });

  const obraId = req.params.obra_id;
  const tenantId = req.decodedToken.contrato_id;
  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    let query = client.from("tenant_parametros_mao_obra").select("*").eq("tenant_id", tenantId);
    if (obraId === "default") {
      query = query.is("obra_id", null);
    } else {
      query = query.eq("obra_id", obraId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return res.json({ success: true, data: null });
    return res.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/tenant-parametros-mao-obra error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/tenant-parametros-mao-obra ────────────────────────────────────
router.post("/tenant-parametros-mao-obra", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_criar"))) return res.status(403).json({ error: "Acesso negado." });

  try {
    const { obra_id, horas_mes, pct_encargos_sociais } = req.body;
    const tenant_id = req.decodedToken.contrato_id;
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");

    const dbObraId = obra_id === "default" ? null : obra_id;

    let existing;
    if (dbObraId === null) {
      const { data } = await client.from("tenant_parametros_mao_obra").select("id").eq("tenant_id", tenant_id).is("obra_id", null).maybeSingle();
      existing = data;
    } else {
      const { data } = await client.from("tenant_parametros_mao_obra").select("id").eq("tenant_id", tenant_id).eq("obra_id", dbObraId).maybeSingle();
      existing = data;
    }

    let result;
    if (existing) {
      result = await client.from("tenant_parametros_mao_obra").update({ horas_mes, pct_encargos_sociais, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single();
    } else {
      result = await client.from("tenant_parametros_mao_obra").insert({ tenant_id, obra_id: dbObraId, horas_mes, pct_encargos_sociais, updated_at: new Date().toISOString() }).select().single();
    }

    if (result.error) throw result.error;
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("POST /api/tenant-parametros-mao-obra error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/custo-hora-real/:obra_id ───────────────────────────────────────
router.get("/custo-hora-real/:obra_id", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });

  const obraId = req.params.obra_id;
  const tenantId = req.decodedToken.contrato_id;
  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { data, error } = await client.from("v_custo_hora_real_mao_obra").select("*").eq("tenant_id", tenantId).eq("obra_id", obraId);
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /api/custo-hora-real error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/tenant-cargos ──────────────────────────────────────────────────
router.get("/tenant-cargos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_ler"))) return res.status(403).json({ error: "Acesso negado." });

  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { data, error } = await client.from("tenant_cargos_salarios").select("*").order("nome_cargo");
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /api/tenant-cargos error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/tenant-cargos ─────────────────────────────────────────────────
router.post("/tenant-cargos", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_criar"))) return res.status(403).json({ error: "Acesso negado." });

  try {
    const payload = req.body;
    const tenant_id = req.decodedToken.contrato_id;
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");

    const upsertData = { ...payload, tenant_id };

    // BUG-FIX: upsert sem onConflict duplica quando id é undefined → SELECT+INSERT/UPDATE.
    let result;
    if (upsertData.id) {
      result = await client.from("tenant_cargos_salarios").update(upsertData).eq("id", upsertData.id).select().single();
    } else {
      delete upsertData.id;
      result = await client.from("tenant_cargos_salarios").insert(upsertData).select().single();
    }
    if (result.error) throw result.error;
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("POST /api/tenant-cargos error:", err);
    return res.status(500).json({ error: "Erro ao salvar", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /api/tenant-bdi ─────────────────────────────────────────────────────
router.get("/tenant-bdi", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_ler"))) return res.status(403).json({ error: "Acesso negado." });

  try {
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");
    const { data, error } = await client.from("tenant_bdi_configuracao").select("*").order("tipo_composicao");
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("GET /api/tenant-bdi error:", err);
    return res.status(500).json({ error: "Erro interno", details: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/bdi-calcular ──────────────────────────────────────────────────
router.post("/bdi-calcular", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.decodedToken) return res.status(401).json({ error: "Acesso não autorizado." });
  if (!(await checkPermission(req, "financeiro_criar"))) return res.status(403).json({ error: "Acesso negado." });

  try {
    const { AC, SG, R, DF, L, ISS, PIS, COFINS, CPRB, tipo_composicao, id } = req.body;

    // BDI = (((1+AC+SG+R) * (1+DF) * (1+L)) / (1 - (ISS+PIS+COFINS+CPRB))) - 1
    const numerador = (1 + AC + SG + R) * (1 + DF) * (1 + L);
    const denominador = 1 - (ISS + PIS + COFINS + CPRB);

    if (denominador <= 0) {
      return res.status(400).json({ error: "Denominador do BDI <= 0 (Soma de Tributos >= 100%)" });
    }

    const bdiCalculado = numerador / denominador - 1;
    const tenant_id = req.decodedToken.contrato_id;
    const client = getSupabaseClient(req);
    if (!client) throw new Error("No client");

    const upsertData: any = {
      id: id || undefined,
      tenant_id,
      tipo_composicao: tipo_composicao || "SERVICO",
      taxa_administracao_central: AC,
      taxa_seguro_garantia: SG,
      taxa_risco: R,
      taxa_despesas_financeiras: DF,
      taxa_lucro: L,
      tributo_iss: ISS,
      tributo_pis: PIS,
      tributo_cofins: COFINS,
      tributo_cprb: CPRB,
      bdi_calculado: bdiCalculado,
    };

    // BUG-FIX: upsert sem onConflict duplica quando id é undefined.
    let result;
    if (upsertData.id) {
      result = await client.from("tenant_bdi_configuracao").update(upsertData).eq("id", upsertData.id).select().single();
    } else {
      delete upsertData.id;
      result = await client.from("tenant_bdi_configuracao").insert(upsertData).select().single();
    }
    if (result.error) throw result.error;

    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("POST /api/bdi-calcular error:", err);
    return res.status(500).json({ error: "Erro ao calcular BDI", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
