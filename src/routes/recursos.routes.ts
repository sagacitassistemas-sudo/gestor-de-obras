/**
 * recursos.routes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rotas do módulo de Recursos Humanos:
 *   - Especialidades
 *   - Calendários e Exceções
 *   - Funcionários
 *   - Equipes e Composição
 *   - Cessões de Pessoal
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, saveRecord } from "../lib/server.lib";

const router = Router();

// ==========================================
// ESPECIALIDADES
// ==========================================
router.get("/especialidades", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await client
      .from("especialidades")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("nome", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/especialidades", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id, nome, descricao, cor, icone, status, valor_hora } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

    const payload: any = {
      tenant_id: tenantId,
      nome: nome.trim(),
      descricao: descricao || null,
      cor: cor || "#005daa",
      icone: icone || "engineering",
      status: status || "ATIVO",
      valor_hora: valor_hora ? parseFloat(valor_hora) : 0,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      result = await client.from("especialidades").update(payload).eq("id", id).select().single();
    } else {
      result = await client.from("especialidades").insert([payload]).select().single();
    }

    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json({ success: true, data: result.data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/especialidades", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID é obrigatório." });

    const { error } = await client.from("especialidades").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CALENDÁRIOS API
// ==========================================
router.get("/calendarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await client
      .from("calendarios")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/calendarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id;
    if (!client || !tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { id, nome, carga_dom, carga_seg, carga_ter, carga_qua, carga_qui, carga_sex, carga_sab } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });

    const upsertData: any = {
      tenant_id: tenantId,
      nome,
      carga_dom: carga_dom || 0,
      carga_seg: carga_seg !== undefined ? carga_seg : 8,
      carga_ter: carga_ter !== undefined ? carga_ter : 8,
      carga_qua: carga_qua !== undefined ? carga_qua : 8,
      carga_qui: carga_qui !== undefined ? carga_qui : 8,
      carga_sex: carga_sex !== undefined ? carga_sex : 8,
      carga_sab: carga_sab || 0,
      updated_at: new Date().toISOString()
    };
    if (id) upsertData.id = id;

    const { data, error } = await saveRecord(client, "calendarios", upsertData);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/calendarios/:id/excecoes", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { data, error } = await client
      .from("calendario_excecoes")
      .select("*")
      .eq("calendario_id", id)
      .order("data_excecao", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/calendarios/:id/excecoes", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { id: excecao_id, data_excecao, descricao, tipo, carga_horaria } = req.body;
    
    if (!data_excecao || !descricao) return res.status(400).json({ error: "Data e descrição são obrigatórios." });

    const upsertData: any = {
      calendario_id: id,
      data_excecao,
      descricao,
      tipo: tipo || "FERIADO",
      carga_horaria: carga_horaria || 0
    };
    if (excecao_id) upsertData.id = excecao_id;

    const { data, error } = await saveRecord(client, "calendario_excecoes", upsertData);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/calendarios/excecoes", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID é obrigatório." });

    const { error } = await client.from("calendario_excecoes").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FUNCIONÁRIOS
// ==========================================
router.get("/funcionarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { empresa_id } = req.query;
    let query = client
      .from("funcionarios")
      .select("*, especialidades(id, nome, cor, icone), empresas_fornecedores!fk_func_empresa(nome)")
      .eq("tenant_id", tenantId);

    if (empresa_id) {
      query = query.eq("empresa_id", empresa_id);
    }

    const { data, error } = await query.order("nome", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const funcIds = (data || []).map((f) => f.id);
    let teamMap: Record<string, Array<{ equipe_id: string; equipe_nome: string; funcao_na_equipe: string; }>> = {};

    if (funcIds.length > 0) {
      const { data: mData } = await client
        .from("equipe_membros")
        .select("funcionario_id, funcao_na_equipe, equipes(id, nome)")
        .in("funcionario_id", funcIds);

      if (mData) {
        mData.forEach((m: any) => {
          if (!teamMap[m.funcionario_id]) teamMap[m.funcionario_id] = [];
          teamMap[m.funcionario_id].push({
            equipe_id: m.equipes?.id,
            equipe_nome: m.equipes?.nome || "Equipe",
            funcao_na_equipe: m.funcao_na_equipe,
          });
        });
      }

      const { data: lData } = await client
        .from("equipes")
        .select("id, nome, lider_id")
        .in("lider_id", funcIds)
        .eq("tenant_id", tenantId);

      if (lData) {
        lData.forEach((eq: any) => {
          if (!teamMap[eq.lider_id]) teamMap[eq.lider_id] = [];
          if (!teamMap[eq.lider_id].some(t => t.equipe_id === eq.id)) {
            teamMap[eq.lider_id].push({
              equipe_id: eq.id,
              equipe_nome: eq.nome,
              funcao_na_equipe: "Líder",
            });
          } else {
             const existing = teamMap[eq.lider_id].find(t => t.equipe_id === eq.id);
             if (existing) existing.funcao_na_equipe = "Líder";
          }
        });
      }
    }

    const enriched = (data || []).map((f) => ({
      ...f,
      empresa_nome: f.empresas_fornecedores?.nome || f.empresa_id,
      especialidade_nome: f.especialidades?.nome || "Sem Especialidade",
      especialidade_cor: f.especialidades?.cor || "#005daa",
      especialidade_icone: f.especialidades?.icone || "engineering",
      equipes: teamMap[f.id] || [],
    }));

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/funcionarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id, empresa_id, nome, cpf, cargo, telefone, email, especialidade_id, data_admissao, status } = req.body;
    if (!nome || !empresa_id) {
      return res.status(400).json({ error: "Nome e Empresa Fornecedora são obrigatórios." });
    }

    const payload: any = {
      tenant_id: tenantId,
      empresa_id,
      contrato_id: tenantId,
      nome: nome.trim(),
      cpf: cpf || null,
      cargo: cargo || null,
      telefone: telefone || null,
      email: email || null,
      especialidade_id: especialidade_id || null,
      data_admissao: data_admissao || null,
      status: status || "ATIVO",
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      result = await client.from("funcionarios").update(payload).eq("id", id).select("*, especialidades(id, nome, cor, icone)").single();
    } else {
      result = await client.from("funcionarios").insert([payload]).select("*, especialidades(id, nome, cor, icone)").single();
    }

    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json({ success: true, data: result.data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/funcionarios", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID é obrigatório." });

    const { error } = await client.from("funcionarios").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// EQUIPES E COMPOSIÇÃO
// ==========================================
router.get("/equipes", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { empresa_id } = req.query;
    let query = client
      .from("equipes")
      .select("*, empresas_fornecedores!fk_equipe_empresa(nome), funcionarios!equipes_lider_id_fkey(id, nome), ordens_servico(id, numero_os, descricao, materiais, ferramentas, equipamentos, responsavel_rdo_id, status, itens_eap(descricao_servico))")
      .eq("tenant_id", tenantId);

    if (empresa_id) {
      query = query.eq("empresa_id", empresa_id);
    }

    const { data, error } = await query.order("nome", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const equipeIds = (data || []).map((e) => e.id);
    let membersMap: Record<string, any[]> = {};

    if (equipeIds.length > 0) {
      const { data: mData } = await client
        .from("equipe_membros")
        .select("id, equipe_id, funcionario_id, funcao_na_equipe, adicionado_em, funcionarios(id, nome, cargo, especialidade_id, especialidades(id, nome, cor, icone))")
        .in("equipe_id", equipeIds);

      if (mData) {
        mData.forEach((m: any) => {
          if (!membersMap[m.equipe_id]) membersMap[m.equipe_id] = [];
          membersMap[m.equipe_id].push({
            id: m.id,
            funcionario_id: m.funcionario_id,
            funcao_na_equipe: m.funcao_na_equipe,
            adicionado_em: m.adicionado_em,
            nome: m.funcionarios?.nome || "Funcionário",
            cargo: m.funcionarios?.cargo || "",
            especialidade_nome: m.funcionarios?.especialidades?.nome || "Sem Especialidade",
            especialidade_cor: m.funcionarios?.especialidades?.cor || "#005daa",
            especialidade_icone: m.funcionarios?.especialidades?.icone || "engineering",
          });
        });
      }
    }

    const enriched = (data || []).map((e) => ({
      ...e,
      empresa_nome: e.empresas_fornecedores?.nome || e.empresa_id,
      lider_nome: e.funcionarios?.nome || null,
      membros: membersMap[e.id] || [],
    }));

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/equipes", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id, empresa_id, nome, descricao, lider_id, status, membros } = req.body;
    if (!nome || !empresa_id) {
      return res.status(400).json({ error: "Nome da Equipe e Empresa Fornecedora são obrigatórios." });
    }

    const payload: any = {
      tenant_id: tenantId,
      empresa_id,
      contrato_id: tenantId,
      nome: nome.trim(),
      descricao: descricao || null,
      lider_id: lider_id || null,
      status: status || "ATIVA",
      updated_at: new Date().toISOString(),
    };

    let equipeId = id;
    if (equipeId) {
      const { error: upErr } = await client.from("equipes").update(payload).eq("id", equipeId);
      if (upErr) return res.status(500).json({ error: upErr.message });
    } else {
      const { data: newEq, error: insErr } = await client.from("equipes").insert([payload]).select("id").single();
      if (insErr) return res.status(500).json({ error: insErr.message });
      equipeId = newEq.id;
    }

    if (Array.isArray(membros)) {
      await client.from("equipe_membros").delete().eq("equipe_id", equipeId);

      if (membros.length > 0) {
        const memberPayloads = membros.map((m: any) => ({
          equipe_id: equipeId,
          funcionario_id: typeof m === "string" ? m : m.funcionario_id,
          funcao_na_equipe: typeof m === "object" && m.funcao_na_equipe ? m.funcao_na_equipe : "MEMBRO",
        }));

        const { error: memErr } = await client.from("equipe_membros").insert(memberPayloads);
        if (memErr) console.error("[POST /api/equipes] Erro ao atualizar membros:", memErr);
      }
    }

    const { data: updatedTeam } = await client
      .from("equipes")
      .select("*, empresas_fornecedores!fk_equipe_empresa(nome)")
      .eq("id", equipeId)
      .single();

    return res.json({ success: true, data: { ...updatedTeam, id: equipeId } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/equipe-composicao", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { equipe_id } = req.query;
    if (!equipe_id) return res.status(400).json({ error: "equipe_id is required" });

    const { data, error } = await client
      .from("equipe_composicao_especialidades")
      .select("*, especialidades(nome, valor_hora)")
      .eq("equipe_id", equipe_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/equipe-composicao", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id;
    if (!client || !tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { equipe_id, composicao } = req.body;
    if (!equipe_id || !Array.isArray(composicao)) {
      return res.status(400).json({ error: "equipe_id and composicao array are required" });
    }

    await client.from("equipe_composicao_especialidades").delete().eq("equipe_id", equipe_id);

    if (composicao.length > 0) {
      const payload = composicao.map((item: any) => ({
        tenant_id: tenantId,
        equipe_id,
        especialidade_id: item.especialidade_id,
        quantidade: item.quantidade,
        valor_hora_projetado: item.valor_hora_projetado || 0
      }));

      const { error: insErr } = await client.from("equipe_composicao_especialidades").insert(payload);
      if (insErr) return res.status(500).json({ error: insErr.message });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/equipes", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID é obrigatório." });

    const { error } = await client.from("equipes").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CESSÕES DE PESSOAL
// ==========================================
router.get("/cessoes-pessoal", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { equipe_id, status } = req.query;

    let query = client.from("cessoes_pessoal").select(`
      *,
      funcionarios:funcionario_id(id, nome, cargo),
      equipe_origem:equipes!cessoes_pessoal_equipe_origem_id_fkey(id, nome),
      equipe_destino:equipes!cessoes_pessoal_equipe_destino_id_fkey(id, nome),
      ordens_servico(id, numero_os, descricao),
      autorizador:auth.users!cessoes_pessoal_autorizado_por_fkey(id, email)
    `);

    if (status) query = query.eq("status", status);
    if (equipe_id) {
      query = query.or(`equipe_origem_id.eq.${equipe_id},equipe_destino_id.eq.${equipe_id}`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/cessoes-pessoal", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";
    const userUid = req.decodedToken?.uid;

    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { funcionario_id, equipe_origem_id, equipe_destino_id, os_destino_id, data_inicio, data_fim, motivo } = req.body;

    if (!funcionario_id || !equipe_origem_id || !equipe_destino_id) {
      return res.status(400).json({ error: "Funcionário, Equipe de Origem e Destino são obrigatórios." });
    }

    if (equipe_origem_id === equipe_destino_id) {
      return res.status(400).json({ error: "Equipe de origem e destino não podem ser a mesma." });
    }

    const { data: memData } = await client.from("equipe_membros").select("id").eq("equipe_id", equipe_origem_id).eq("funcionario_id", funcionario_id).single();

    if (!memData) {
      return res.status(400).json({ error: "O funcionário não pertence à equipe de origem selecionada." });
    }

    const payload = {
      tenant_id: tenantId,
      funcionario_id,
      equipe_origem_id,
      equipe_destino_id,
      os_destino_id: os_destino_id || null,
      data_inicio: data_inicio || new Date().toISOString(),
      data_fim: data_fim || null,
      motivo,
      status: "ATIVA",
      autorizado_por: userUid,
    };

    const { data, error } = await client.from("cessoes_pessoal").insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await client.from("audit_log").insert({
      contrato_id: tenantId,
      usuario_uid: userUid,
      cod_evento: "CESSAO_CREATE",
      descricao: `Cessão do funcionário ${funcionario_id} da equipe ${equipe_origem_id} para ${equipe_destino_id}`,
      entidade_tipo: "cessoes_pessoal",
      entidade_id: data.id,
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/cessoes-pessoal/:id/encerrar", verifyFirebaseJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const client = getSupabaseClient(req);
    const userUid = req.decodedToken?.uid;
    const tenantId = req.decodedToken?.contrato_id || "CTR-2026-SYS";

    if (!client) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { data_fim } = req.body;

    const { data, error } = await client
      .from("cessoes_pessoal")
      .update({
        status: "ENCERRADA",
        data_fim: data_fim || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await client.from("audit_log").insert({
      contrato_id: tenantId,
      usuario_uid: userUid,
      cod_evento: "CESSAO_ENCERRAR",
      descricao: `Cessão ${id} encerrada.`,
      entidade_tipo: "cessoes_pessoal",
      entidade_id: id,
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
