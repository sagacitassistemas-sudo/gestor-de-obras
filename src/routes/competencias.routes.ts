import { Router } from "express";
import { getSupabaseClient, saveRecord } from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { logAudit } from "../services/logger.service";
import { AuthenticatedRequest } from "../types/middleware.types";

const app = Router();

  // ==========================================
  // MÓDULO: MATRIZ DE COMPETÊNCIAS E SSMA
  // ==========================================

  // 1. Obter catálogo de competências para uma especialidade
  app.get(
    "/api/competencias/especialidade/:especialidade_id",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });
        const { data, error } = await client
          .from("competencias_catalogo")
          .select("*")
          .eq("especialidade_id", req.params.especialidade_id)
          .order("eixo", { ascending: true });
        if (error) throw error;
        return res.json({ success: true, competencias: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 1b. Salvar (criar ou atualizar) competência no catálogo
  app.post(
    "/api/competencias",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId)
          return res.status(401).json({ error: "Unauthorized" });

        const {
          id,
          especialidade_id,
          eixo,
          descricao,
          peso_esperado,
          treinamento_obrigatorio,
        } = req.body;

        const payload: any = {
          tenant_id: tenantId,
          especialidade_id,
          eixo,
          descricao,
          peso_esperado: Number(peso_esperado),
          treinamento_obrigatorio: treinamento_obrigatorio || null,
        };

        if (id) {
          payload.id = id;
        }

        const { data, error } = await saveRecord(
          client,
          "competencias_catalogo",
          payload,
          { idField: "id" },
        );
        if (error) throw error;

        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 1c. Excluir competência do catálogo
  app.delete(
    "/api/competencias/:id",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId)
          return res.status(401).json({ error: "Unauthorized" });

        const { error } = await client
          .from("competencias_catalogo")
          .delete()
          .eq("id", req.params.id)
          .eq("tenant_id", tenantId);

        if (error) throw error;
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 2. Registrar Avaliação de Desempenho
  app.post(
    "/api/avaliacoes",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        const avaliadorUid = req.decodedToken?.uid;
        if (!client || !tenantId || !avaliadorUid)
          return res.status(401).json({ error: "Unauthorized" });

        const { funcionario_id, status, observacao_geral, itens } = req.body;
        if (!funcionario_id || !itens || !itens.length) {
          return res
            .status(400)
            .json({ error: "Faltam parâmetros de avaliação." });
        }

        // a) Criar cabeçalho
        const { data: avaliacao, error: avalErr } = await client
          .from("avaliacoes_desempenho")
          .insert({
            tenant_id: tenantId,
            funcionario_id,
            avaliador_uid: avaliadorUid,
            status: status || "Rascunho",
            observacao_geral,
          })
          .select("id")
          .single();

        if (avalErr || !avaliacao) throw avalErr;

        // b) Inserir notas
        const insertItens = itens.map((i: any) => ({
          avaliacao_id: avaliacao.id,
          competencia_id: i.competencia_id,
          nota_alcancada: i.nota_alcancada,
          observacao: i.observacao,
        }));

        const { error: itensErr } = await client
          .from("avaliacao_itens")
          .insert(insertItens);
        if (itensErr) throw itensErr;

        await logAudit(client, {
          contrato_id: tenantId,
          usuario_uid: avaliadorUid,
          usuario_email: req.decodedToken?.email,
          cod_evento: "AVALIACAO_CRIADA",
          descricao: `Avaliação de desempenho criada para o funcionário ${funcionario_id}. Status: ${status}`,
          entidade_tipo: "avaliacao",
          entidade_id: avaliacao.id,
        });

        return res.json({ success: true, avaliacao_id: avaliacao.id });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 3. Simulação Dinâmica de Mão de Obra
  app.get(
    "/api/custos/simulacao-mao-obra",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { projeto_id, os_id, equipe_id } = req.query;
        if (!projeto_id) return res.status(400).json({ error: "projeto_id is required" });

        // 1. Fetch the project and its calendar
        // Since we might not have a direct link to calendario yet, we use a fallback to the default calendar.
        let horas_mes = 220; // Default fallback if no calendar
        const { data: calendario } = await client
          .from("calendarios")
          .select("*")
          .eq("is_default", true)
          .single();
        
        if (calendario && calendario.horas_dia && calendario.dias_trabalho_semana) {
           // estimate month hours: (horas_dia * dias_semana) * 4.33 weeks
           horas_mes = Math.round((calendario.horas_dia * calendario.dias_trabalho_semana.length) * 4.33);
        }
        // 2. Determine equipe(s)
        let equipesToFetch: string[] = [];
        if (equipe_id) {
          equipesToFetch = [equipe_id as string];
        } else if (os_id) {
          const { data: osData } = await client.from("ordens_servico").select("equipe_id").eq("id", os_id).single();
          if (osData?.equipe_id) equipesToFetch = [osData.equipe_id];
        } else if (projeto_id) {
          const { data: osList } = await client.from("ordens_servico").select("equipe_id").eq("projeto_id", projeto_id);
          if (osList) {
             const uniqueEquipes = new Set(osList.map(os => os.equipe_id).filter(Boolean));
             equipesToFetch = Array.from(uniqueEquipes);
          }
        }

        let totalAdmissionCosts = 0;
        let totalDismissalCosts = 0;
        let totalHourlyCosts = 0;
        const pendencias: string[] = [];

        if (horas_mes === 220 && !calendario) {
          pendencias.push("Calendário padrão não encontrado. Usando fallback de 220h/mês.");
        }

        if (equipesToFetch.length > 0) {
          const { data: equipeMembros, error: equipeErr } = await client.from("equipe_membros").select(`
              id, adicionado_em,
              funcionarios!inner(id, cargo)
            `).in("equipe_id", equipesToFetch);
          
          if (equipeErr) throw new Error(equipeErr.message);

          // 3. Fetch costs references
          const { data: refGerais } = await client.from("ref_encargos_complementares").select("*");
          const { data: cargosSalariosTenant } = await client.from("tenant_cargos_salarios").select("*");
          const { data: cargosSalariosRef } = await client.from("ref_cargos_salarios").select("*");
          const cargosSalarios = (cargosSalariosTenant && cargosSalariosTenant.length > 0) ? cargosSalariosTenant : (cargosSalariosRef || []);

          if (equipeMembros && equipeMembros.length > 0) {
             const pcmsoAdmissional = (refGerais || []).find((r: any) => r.categoria === 'Exames (PCMSO)');
             const rescisaoDemissional = (refGerais || []).find((r: any) => r.categoria === 'Rescisão');

             const pcmsoValue = pcmsoAdmissional ? Number(pcmsoAdmissional.custo_mensalista_ref || 0) : 0;
             const demissaoValue = rescisaoDemissional ? Number(rescisaoDemissional.custo_mensalista_ref || 0) : 0;

             if (pcmsoValue === 0) {
               pendencias.push("Custo Admissional (Exames PCMSO) não configurado ou zerado nas referências gerais.");
             }
             if (demissaoValue === 0) {
               pendencias.push("Custo Demissional (Rescisão) não configurado ou zerado nas referências gerais.");
             }

             for (const membro of equipeMembros) {
                totalAdmissionCosts += pcmsoValue;
                totalDismissalCosts += demissaoValue;
                
                const cargoStr = (membro.funcionarios as any).cargo;
                if (!cargoStr) {
                  pendencias.push(`Membro da equipe (ID: ${membro.id}) não possui cargo definido.`);
                  continue;
                }

                const cargo = cargosSalarios.find((c: any) => c.nome_cargo === cargoStr);
                const salarioBaseMensal = cargo ? Number(cargo.salario_base_adotado || cargo.salario_medio || 0) : 0;
                
                if (salarioBaseMensal === 0) {
                  pendencias.push(`Salário base não encontrado ou zerado para o cargo: ${cargoStr}`);
                }

                const encargosPerc = cargo && cargo.encargos_sociais_perc ? Number(cargo.encargos_sociais_perc) : 85.0;
                
                const salarioHora = salarioBaseMensal / horas_mes;
                const encargosSociaisHora = salarioHora * (encargosPerc / 100);
                
                const geraisHora = (refGerais || [])
                  .filter((r: any) => r.categoria !== 'Exames (PCMSO)' && r.categoria !== 'Rescisão')
                  .reduce((acc: number, curr: any) => acc + Number(curr.custo_horista_ref || 0), 0);
                
                totalHourlyCosts += (salarioHora + encargosSociaisHora + geraisHora);
             }
          } else {
             pendencias.push("A equipe designada não possui membros cadastrados (histograma vazio).");
          }
        } else {
           pendencias.push("Nenhuma equipe executora mapeada para esta OS ou Projeto.");
        }

        return res.json({ 
          success: true, 
          calculo: {
            horas_mes_adotadas: horas_mes,
            total_admission_costs: totalAdmissionCosts,
            total_dismissal_costs: totalDismissalCosts,
            total_hourly_rate: totalHourlyCosts,
            pendencias
          }
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // 3. Checar Elegibilidade RDO
  app.get(
    "/api/funcionarios/:id/rdo-eligibility",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        // Chama a função RPC criada na migration
        const { data, error } = await client.rpc(
          "check_funcionario_rdo_eligibility",
          {
            p_funcionario_id: req.params.id,
          },
        );

        if (error) throw error;
        return res.json({ success: true, eligibility: data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // 4. Checar Status de Treinamentos vs Exigências SSMA
  app.get(
    "/api/funcionarios/:id/treinamentos-status",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });
        const funcionarioId = req.params.id;

        // Pegamos os treinamentos realizados
        const { data: treinosFeitos, error: tErr } = await client
          .from("funcionario_treinamentos")
          .select("*")
          .eq("funcionario_id", funcionarioId);
        if (tErr) throw tErr;

        // Pegamos a especialidade do funcionario para saber o que é exigido
        const { data: func, error: fErr } = await client
          .from("funcionarios")
          .select("especialidade_id")
          .eq("id", funcionarioId)
          .single();
        if (fErr) throw fErr;

        if (!func.especialidade_id) {
          return res.json({
            success: true,
            treinamentos: treinosFeitos,
            exigencias: [],
          });
        }

        // Pegamos as exigências
        const { data: compSsma, error: cErr } = await client
          .from("competencias_catalogo")
          .select("treinamento_obrigatorio")
          .eq("especialidade_id", func.especialidade_id)
          .eq("eixo", "SSMA")
          .not("treinamento_obrigatorio", "is", null);
        if (cErr) throw cErr;

        return res.json({
          success: true,
          treinamentos: treinosFeitos,
          exigidos: compSsma,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );


export default app;
