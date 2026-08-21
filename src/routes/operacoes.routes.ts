/**
 * operacoes.routes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rotas do módulo de Operações (Ordens de Serviço):
 *   GET    /api/ordens-servico
 *   POST   /api/ordens-servico
 *   PATCH  /api/ordens-servico/:id
 *   DELETE /api/ordens-servico/:id
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, checkPermission } from "../lib/server.lib";
import { logAudit } from "../services/logger.service";

const router = Router();

// ─── GET /api/ordens-servico ─────────────────────────────────────────────────
router.get("/ordens-servico", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { projeto_id } = req.query;
    let query = client
      .from("ordens_servico")
      .select("*, itens_eap(descricao_servico, unidade_medida, data_inicio, data_fim, duracao_dias), equipes(id, nome), responsavel_rdo:funcionarios!ordens_servico_responsavel_rdo_id_fkey(id, nome)");
    if (projeto_id) query = query.eq("projeto_id", projeto_id);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("[GET /api/ordens-servico] Supabase error:", error);
      return res.status(500).json({ error: error.message, details: error.details, hint: error.hint });
    }
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("[GET /api/ordens-servico] Catch error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/ordens-servico ────────────────────────────────────────────────
router.post("/ordens-servico", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const osData = req.body;
    const tenantId = req.decodedToken?.contrato_id;
    const projId = osData.projeto_id;
    const emissaoDate = osData.data_emissao ? new Date(osData.data_emissao) : new Date();
    const yearStr = emissaoDate.getFullYear().toString().slice(-2);

    const { data: projData } = await client.from("projetos").select("codigo_projeto").eq("id", projId).single();
    const projCode = projData?.codigo_projeto || "P-00";

    const { count: osCount } = await client.from("ordens_servico").select("id", { count: "exact", head: true }).eq("projeto_id", projId);

    const seq = (osCount !== null ? osCount : 0) + 1;
    const seqStr = seq.toString().padStart(3, "0");

    let shortProjCode = projCode.replace("P-", "").replace(`-${yearStr}`, "");
    if (!shortProjCode || shortProjCode.length < 2) shortProjCode = "01";

    const generatedNumeroOs = `OS-${seqStr}-P${shortProjCode}-${yearStr}`;

    const osPayload = {
      tenant_id: tenantId,
      projeto_id: projId,
      item_eap_id: osData.item_eap_id,
      equipe_id: osData.equipe_id || null,
      numero_os: generatedNumeroOs,
      descricao: osData.descricao,
      materiais: osData.materiais || null,
      valor_materiais: osData.valor_materiais ? Number(osData.valor_materiais) : 0,
      ferramentas: osData.ferramentas || null,
      valor_ferramentas: osData.valor_ferramentas ? Number(osData.valor_ferramentas) : 0,
      equipamentos: osData.equipamentos || null,
      valor_equipamentos: osData.valor_equipamentos ? Number(osData.valor_equipamentos) : 0,
      valor_mao_obra: osData.valor_mao_obra ? Number(osData.valor_mao_obra) : 0,
      responsavel_rdo_id: osData.responsavel_rdo_id || null,
      status: "Emitida",
      data_emissao: emissaoDate.toISOString(),
    };

    const { data, error } = await client
      .from("ordens_servico")
      .insert(osPayload)
      .select("*, itens_eap(descricao_servico, unidade_medida), equipes(id, nome), responsavel_rdo:funcionarios!ordens_servico_responsavel_rdo_id_fkey(id, nome)")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/ordens-servico/:id ───────────────────────────────────────────
router.patch("/ordens-servico/:id", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    if (!(await checkPermission(req, "os_editar"))) {
      return res.status(403).json({ error: "Acesso negado. Permissão de edição de OS necessária." });
    }

    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const tenantId = req.decodedToken?.contrato_id;
    const osId = req.params.id;
    const osData = req.body;

    const updatePayload = {
      item_eap_id: osData.item_eap_id,
      equipe_id: osData.equipe_id || null,
      descricao: osData.descricao,
      materiais: osData.materiais || null,
      valor_materiais: osData.valor_materiais !== undefined ? Number(osData.valor_materiais) : undefined,
      ferramentas: osData.ferramentas || null,
      valor_ferramentas: osData.valor_ferramentas !== undefined ? Number(osData.valor_ferramentas) : undefined,
      equipamentos: osData.equipamentos || null,
      valor_equipamentos: osData.valor_equipamentos !== undefined ? Number(osData.valor_equipamentos) : undefined,
      valor_mao_obra: osData.valor_mao_obra !== undefined ? Number(osData.valor_mao_obra) : undefined,
      responsavel_rdo_id: osData.responsavel_rdo_id || null,
      data_emissao: osData.data_emissao || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from("ordens_servico")
      .update(updatePayload)
      .eq("id", osId)
      .eq("tenant_id", tenantId)
      .select("*, itens_eap(descricao_servico, unidade_medida), equipes(id, nome), responsavel_rdo:funcionarios!ordens_servico_responsavel_rdo_id_fkey(id, nome)")
      .single();

    if (error) {
      console.error("[PATCH /api/ordens-servico/:id] Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    await logAudit(client, {
      contrato_id: tenantId,
      usuario_uid: req.decodedToken?.uid,
      usuario_email: req.decodedToken?.email,
      cod_evento: "OS_UPDATE",
      descricao: `A Ordem de Serviço ${osId} foi atualizada.`,
      entidade_tipo: "ordem_servico",
      entidade_id: osId,
    });

    return res.json({ success: true, message: "OS atualizada com sucesso.", data });
  } catch (err: any) {
    console.error("[PATCH /api/ordens-servico/:id] Exception:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ─── DELETE /api/ordens-servico/:id ──────────────────────────────────────────
router.delete("/ordens-servico/:id", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.decodedToken?.perfil;
    if (userRole !== "GESTOR" && userRole !== "ADMIN") {
      return res.status(403).json({ error: "Acesso negado. Apenas Gestores e Administradores podem excluir uma Ordem de Serviço." });
    }

    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const tenantId = req.decodedToken?.contrato_id;
    const osId = req.params.id;

    const { data: osData } = await client.from("ordens_servico").select("numero_os").eq("id", osId).eq("tenant_id", tenantId).single();

    const { error } = await client.from("ordens_servico").delete().eq("id", osId).eq("tenant_id", tenantId);

    if (error) {
      console.error("[DELETE /api/ordens-servico/:id] Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    await logAudit(client, {
      contrato_id: tenantId,
      usuario_uid: req.decodedToken?.uid,
      usuario_email: req.decodedToken?.email,
      cod_evento: "OS_DELETE",
      descricao: `Exclusão da Ordem de Serviço ${osData?.numero_os || osId}`,
      entidade_tipo: "ordens_servico",
      entidade_id: osId,
    });

    return res.json({ success: true, message: "OS excluída com sucesso." });
  } catch (err: any) {
    console.error("[DELETE /api/ordens-servico/:id] Exception:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

export default router;
