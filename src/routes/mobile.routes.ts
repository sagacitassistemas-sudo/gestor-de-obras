import { Router } from "express";
import { getSupabaseClient, saveRecord } from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { mobileAuthMiddleware } from "../middleware/mobileAuth.middleware";
import { AuthenticatedRequest } from "../types/middleware.types";

const app = Router();

  // ==========================================
  // [RDO_WM BFF API] - Rotas exclusivas para o App Móvel
  // ==========================================

  // -------------------------------------------------------
  // GET /api/mobile/os/ativas
  // Retorna apenas as OS das equipes da empresa do funcionário autenticado
  // -------------------------------------------------------
  app.get("/api/mobile/os/ativas", verifyFirebaseJWT, mobileAuthMiddleware(getSupabaseClient), async (req: any, res) => {
    try {
      const client = getSupabaseClient(req);
      if (!client) return res.status(401).json({ error: "Unauthorized" });

      const { contrato_id: tenantId, funcionario_id, empresa_id, nome, cargo_nome } = req.userContext!;

      // 1. Validar que a empresa do funcionário existe no tenant
      const { data: empresaData, error: empError } = await client
        .from("empresas_fornecedores")
        .select("id, nome")
        .eq("id", empresa_id)
        .eq("contrato_id", tenantId)
        .maybeSingle();

      if (empError || !empresaData) {
        console.error("[BFF] Empresa do funcionário não encontrada:", empError);
        return res.status(403).json({
          error: "EmpresaNaoEncontrada",
          message: `A empresa vinculada ao seu cadastro (${empresa_id}) não foi encontrada neste contrato.`
        });
      }

      // 3. Buscar equipes em que o funcionário é MEMBRO DIRETO (via equipe_membros)
      const { data: membros, error: memError } = await client
        .from("equipe_membros")
        .select("equipe_id, equipes!inner(id, nome, empresa_id, tenant_id)")
        .eq("funcionario_id", funcionario_id);

      if (memError) {
        console.error("[BFF] Erro ao buscar alocações do funcionário:", memError);
        return res.status(500).json({ error: memError.message });
      }

      // Filtrar apenas equipes da empresa do funcionário dentro do tenant
      const equipeIds = (membros || [])
        .filter((m: any) => m.equipes?.empresa_id === empresa_id && m.equipes?.tenant_id === tenantId)
        .map((m: any) => m.equipe_id);

      if (equipeIds.length === 0) {
        return res.json({
          success: true,
          timestamp: new Date().toISOString(),
          funcionario: { id: funcionario_id, empresa_id, empresa_nome: empresaData.nome, nome, cargo_nome },
          serviceOrders: [],
          message: "Você ainda não está alocado em nenhuma equipe. Solicite ao gestor da obra."
        });
      }

      console.log(`[BFF] Funcionario ${funcionario_id} é membro de ${equipeIds.length} equipe(s): [${equipeIds.join(', ')}]`);

      // 4. Buscar OS ativas vinculadas às equipes do funcionário, dentro do tenant
      const { data, error } = await client
        .from("ordens_servico")
        .select("*, equipes(id, nome, empresa_id), itens_eap(descricao_servico)")
        .eq("tenant_id", tenantId)
        .in("equipe_id", equipeIds)
        .neq("status", "CANCELADO")
        .neq("status", "Cancelada")
        .neq("status", "CONCLUIDO")
        .neq("status", "Concluída")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[BFF] Erro ao buscar ordens de serviço:", error);
        return res.status(500).json({ error: error.message });
      }

      // 4. Mapear para a interface ServiceOrder que o mobile espera
      const serviceOrders = (data || []).map((os: any) => ({
        id: os.id,
        code: os.numero_os || `OS-${os.id.substring(0,6)}`,
        title: os.descricao || os.itens_eap?.descricao_servico || 'Ordem de Serviço',
        location: os.equipes?.nome || 'Equipe não informada',
        timeInfo: os.data_emissao ? `Emitida: ${new Date(os.data_emissao).toLocaleDateString('pt-BR')}` : '',
        startedTime: '07:00',
        status: os.status === 'Em Execução' || os.status === 'EM_EXECUCAO' ? 'in_progress'
              : os.status === 'Emitida' || os.status === 'EMITIDA' ? 'scheduled'
              : 'in_progress',
        sector: os.itens_eap?.descricao_servico || 'Serviço Geral',
        description: os.descricao || 'Sem descrição',
        projectId: os.projeto_id
      }));

      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        funcionario: { id: funcionario_id, empresa_id, empresa_nome: empresaData.nome, nome, cargo_nome },
        serviceOrders
      });
    } catch (err: any) {
      console.error("[BFF] Erro interno:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------
  // POST /api/mobile/rdo
  // Cria um RDO vinculado ao funcionário autenticado
  // -------------------------------------------------------
  app.post("/api/mobile/rdo", verifyFirebaseJWT, mobileAuthMiddleware(getSupabaseClient), async (req: any, res) => {
    try {
      const client = getSupabaseClient(req);
      if (!client) return res.status(401).json({ error: "Unauthorized" });

      const { contrato_id: tenantId, funcionario_id } = req.userContext!;

      const payload = req.body;
      const protocoloId = payload.protocoloId || payload.protocolo_id;

      // 2. Gerar número do RDO
      const { count: rdoCount } = await client
        .from("rdos")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const seq = ((rdoCount ?? 0) + 1).toString().padStart(3, "0");
      const ano = new Date().getFullYear().toString().slice(-2);
      const numero_rdo = `RDO-${seq}-${ano}`;

      // 3. Montar payload para inserção
      const rdoPayload = {
        tenant_id: tenantId,
        projeto_id: payload.projectId || payload.projeto_id || null,
        ordem_servico_id: payload.osId,
        numero_rdo: numero_rdo,
        data_rdo: payload.date || new Date().toISOString().split('T')[0],
        clima_manha: payload.weatherMorning,
        clima_tarde: payload.weatherAfternoon,
        responsavel_rdo_id: funcionario_id, // Vincula o autor (funcionário) ao RDO
        status: "Rascunho"
      };

      const { data, error } = await client
        .from("rdos")
        .insert(rdoPayload)
        .select("id")
        .single();

      if (error) {
        console.error("[BFF] Erro ao salvar RDO:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`[BFF] RDO ${numero_rdo} criado pelo funcionário ${funcionario_id}`);

      return res.status(201).json({
        success: true,
        synced: true,
        protocoloId,
        rdoId: data.id,
        rdoNumero: numero_rdo,
        funcionarioId: funcionario_id,
        message: `RDO ${numero_rdo} gravado com sucesso.`
      });
    } catch (err: any) {
      console.error("[BFF] Erro interno ao salvar RDO:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });


export default app;
