import { Router } from "express";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import { getSupabaseClient, checkPermission, saveRecord } from "../lib/server.lib";

const router = Router();

  // GET /api/contratos-obra - List all contracts for the current tenant
  router.get(
    "/api/contratos-obra",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res
            .status(401)
            .json({ error: "Missing Supabase client / token" });
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
    },
  );

  // POST /api/contratos-obra - Create or update a contract
  router.post(
    "/api/contratos-obra",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId) {
          return res
            .status(401)
            .json({ error: "Missing Supabase client / token" });
        }

        const payload = req.body;
        const {
          id,
          fornecedor_id,
          projeto_id,
          numero_contrato,
          objeto,
          valor_global,
          data_assinatura,
          data_vigencia,
          status,
        } = payload;

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
          status: status || "VIGENTE",
          updated_at: new Date().toISOString(),
        };

        if (id) {
          upsertData.id = id;
        }

        const { data, error } = await saveRecord(
          client,
          "contratos_obra",
          upsertData,
        );

        if (error) {
          console.error("POST /api/contratos-obra Supabase error:", error);
          return res.status(500).json({ error: error.message });
        }
        return res.json({ contrato: data });
      } catch (err) {
        console.error("POST /api/contratos-obra unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  // DELETE /api/contratos-obra - Delete a contract
  router.delete(
    "/api/contratos-obra",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) {
          return res
            .status(401)
            .json({ error: "Missing Supabase client / token" });
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
    },
  );

/* -------------------------------------------------------------------------- */
/*                       ORÇAMENTAÇÃO E CUB                                   */
/* -------------------------------------------------------------------------- */

  // GET /api/cub/bases ...
  // POST /api/cub/scrape ...
  // POST /api/cub/import-pdf ...
  // POST /api/cub/save ...
  // Movidos para src/routes/cub.routes.ts

  // GET /api/projetos - List all projects (now scoped by tenant)
  router.get(
    "/api/projetos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 100;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error } = await client
          .from("projetos")
          .select(
            "*, empresas_fornecedores!projetos_empresa_id_tenant_id_fkey(nome), calendarios(nome)",
          )
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) {
          console.warn(
            "GET /api/projetos join failed, falling back to simple query:",
            error.message,
          );
          const { data: fallbackData, error: fallbackErr } = await client
            .from("projetos")
            .select("*")
            .order("created_at", { ascending: false })
            .range(from, to);
          if (fallbackErr)
            return res.status(500).json({ error: fallbackErr.message });
          return res.json({ projetos: fallbackData || [] });
        }

        // Flatten the empresa_nome from the join
        const enriched = (data || []).map((p: any) => ({
          ...p,
          empresa_nome: p.empresas_fornecedores?.nome || null,
          empresas_fornecedores: undefined,
        }));

        return res.json({ projetos: enriched });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    },
  );


  // GET /api/simulacoes
  router.get(
    "/api/simulacoes",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const tenantId = req.decodedToken?.contrato_id;
        const { data, error } = await client
          .from("simulacoes_projetos")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("updated_at", { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // POST /api/simulacoes
  router.post(
    "/api/simulacoes",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const tenantId = req.decodedToken?.contrato_id;
        const { id, nome, dados_json, status } = req.body;

        if (id) {
          // Update
          const { data, error } = await client
            .from("simulacoes_projetos")
            .update({
              nome,
              dados_json,
              status: status || 'RASCUNHO',
              updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .select()
            .single();

          if (error) return res.status(500).json({ error: error.message });
          return res.json({ success: true, data });
        } else {
          // Insert
          const { data, error } = await client
            .from("simulacoes_projetos")
            .insert({
              tenant_id: tenantId,
              nome: nome || "Nova Simulação",
              dados_json,
              status: status || 'RASCUNHO'
            })
            .select()
            .single();

          if (error) return res.status(500).json({ error: error.message });
          return res.json({ success: true, data });
        }
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // DELETE /api/simulacoes/:id
  router.delete(
    "/api/simulacoes/:id",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const tenantId = req.decodedToken?.contrato_id;
        const simId = req.params.id;

        const { error } = await client
          .from("simulacoes_projetos")
          .delete()
          .eq("id", simId)
          .eq("tenant_id", tenantId);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // POST /api/projetos/from-simulacao - Create project from Orcamentacao simulation
  router.post(
    "/api/projetos/from-simulacao",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId) return res.status(401).json({ error: "Unauthorized" });

        const { nome_projeto, data_inicio, orcamento_base, area_total, etapas, empresa_id: reqEmpresaId } = req.body;
        if (!nome_projeto || !data_inicio || !etapas || !Array.isArray(etapas)) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        let empresa_id = reqEmpresaId || null;
        if (req.decodedToken?.perfil === "FORNECEDOR") {
          empresa_id = req.decodedToken?.empresa_id || null;
        }

        // Lógica de Duração Global (Macro) baseada na Área (m2)
        const area = Number(area_total) || 1000;
        let duracaoGlobalDias = 360; // Default: Médio
        if (area <= 120) duracaoGlobalDias = 240; // 8 meses
        else if (area <= 300) duracaoGlobalDias = 360; // 12 meses
        else if (area <= 600) duracaoGlobalDias = 480; // 16 meses
        else duracaoGlobalDias = 660; // 22 meses

        const addDays = (baseDateStr: string, days: number) => {
          const d = new Date(baseDateStr);
          d.setDate(d.getDate() + days);
          return d.toISOString().split('T')[0];
        };

        const dataFimGlobal = addDays(data_inicio, duracaoGlobalDias);

        // Auto-generate project code: P-[SEQUENCIAL]-[ANO]
        const yearStr = new Date(data_inicio).getFullYear().toString().slice(-2);
        const { count: projCount } = await client
          .from("projetos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId);
        const seq = (projCount !== null ? projCount : 0) + 1;
        const codigo_projeto = `P-${seq.toString().padStart(2, "0")}-${yearStr}`;

        // 1. Criar o Projeto
        const { data: projData, error: projError } = await saveRecord(client, "projetos", {
          tenant_id: tenantId,
          nome_projeto,
          data_inicio,
          empresa_id,
          codigo_projeto,
          updated_at: new Date().toISOString(),
        });

        if (projError || !projData?.id) {
          throw new Error("Erro ao criar projeto: " + (projError?.message || "ID não retornado"));
        }

        const projetoId = projData.id;

        // 2. Criar a EAP com base nas etapas simuladas e no algoritmo de evolução temporal
        const eapRows = [];
        
        // Nó Raiz
        eapRows.push({
          projeto_id: projetoId,
          eap_codigo: "1",
          descricao_servico: "1 - " + nome_projeto,
          e_analitico: false,
          unidade_medida: null,
          data_inicio: data_inicio,
          data_fim: dataFimGlobal,
          duracao_dias: duracaoGlobalDias,
          ordem: 1,
          valor_total_contratado: orcamento_base
        });

        // Mapeamento percentual de início/fim sobre a duração global para os 12 IDs base do sistema
        const scheduleMap: Record<string, { start: number, end: number }> = {
          '1': { start: 0.00, end: 0.05 }, // Projetos e Licenc.
          '2': { start: 0.00, end: 0.05 }, // Serv. Preliminares
          '3': { start: 0.05, end: 0.15 }, // Fundações
          '4': { start: 0.60, end: 0.75 }, // Contrapiso
          '5': { start: 0.40, end: 0.55 }, // Impermeabilização
          '6': { start: 0.15, end: 0.45 }, // Estrutura (sobreposição com Fechamentos)
          '7': { start: 0.30, end: 0.50 }, // Fechamentos
          '8': { start: 0.50, end: 0.60 }, // Cobertura
          '9': { start: 0.35, end: 0.65 }, // Instalações Hidráulicas (começa junto com estrutura/fechamento)
          '10':{ start: 0.40, end: 0.70 }, // Instalações Elétricas
          '11':{ start: 0.65, end: 0.95 }, // Revestimentos, Acabamentos e Pintura
          '12':{ start: 0.95, end: 1.00 }, // Limpeza e Entregas
        };

        // Nós Filhos (As 12 etapas)
        let ordem = 2;
        for (const etapa of etapas) {
          const mapping = scheduleMap[etapa.id.toString()] || { start: 0, end: 1 };
          
          const startDaysOffset = Math.round(duracaoGlobalDias * mapping.start);
          const endDaysOffset = Math.round(duracaoGlobalDias * mapping.end);
          const duracaoEtapa = Math.max(1, endDaysOffset - startDaysOffset);

          const etapaDataInicio = addDays(data_inicio, startDaysOffset);
          const etapaDataFim = addDays(data_inicio, endDaysOffset);

          eapRows.push({
            projeto_id: projetoId,
            eap_codigo: `1.${ordem - 1}`,
            eap_pai_codigo: "1",
            descricao_servico: etapa.nome,
            e_analitico: true,
            unidade_medida: "un",
            valor_total_contratado: etapa.valorCalculado || 0,
            quantidade_contratada: 1,
            preco_unitario: etapa.valorCalculado || 0,
            data_inicio: etapaDataInicio,
            data_fim: etapaDataFim,
            duracao_dias: duracaoEtapa,
            ordem: ordem
          });
          ordem++;
        }

        const { error: eapError, data: insertedEaps } = await client.from("itens_eap").insert(eapRows).select();
        if (eapError) {
          console.error("[POST /api/projetos/from-simulacao] Erro EAP:", eapError);
          // Fallback silencioso
        }

        // 3. Dimensionamento de Equipes e Ordens de Serviço
        if (insertedEaps && insertedEaps.length > 0) {
          const dimensionamentoRules: Record<string, { hh: number, specs: { nome: string, min: number, max: number }[] }> = {
            '1': { hh: 0.5, specs: [{ nome: 'Coordenador de Campo', min: 1, max: 2 }] },
            '2': { hh: 0.8, specs: [{ nome: 'Carpinteiro', min: 1, max: 1 }, { nome: 'Servente', min: 1, max: 2 }] },
            '3': { hh: 2.5, specs: [{ nome: 'Armador', min: 1, max: 2 }, { nome: 'Pedreiro', min: 1, max: 2 }, { nome: 'Servente', min: 2, max: 2 }] },
            '4': { hh: 0.8, specs: [{ nome: 'Pedreiro', min: 1, max: 2 }, { nome: 'Servente', min: 1, max: 1 }] },
            '5': { hh: 0.6, specs: [{ nome: 'Pedreiro', min: 1, max: 1 }, { nome: 'Servente', min: 1, max: 1 }] },
            '6': { hh: 8.0, specs: [{ nome: 'Carpinteiro', min: 2, max: 3 }, { nome: 'Armador', min: 2, max: 3 }, { nome: 'Pedreiro', min: 2, max: 3 }, { nome: 'Servente', min: 2, max: 3 }] },
            '7': { hh: 3.5, specs: [{ nome: 'Pedreiro', min: 2, max: 3 }, { nome: 'Servente', min: 2, max: 3 }] },
            '8': { hh: 1.2, specs: [{ nome: 'Carpinteiro', min: 1, max: 2 }, { nome: 'Servente', min: 1, max: 2 }] },
            '9': { hh: 2.2, specs: [{ nome: 'Encanador', min: 1, max: 2 }, { nome: 'Servente', min: 1, max: 2 }] },
            '10':{ hh: 1.8, specs: [{ nome: 'Eletricista', min: 1, max: 2 }, { nome: 'Servente', min: 1, max: 1 }] },
            '11':{ hh: 6.5, specs: [{ nome: 'Pintor', min: 2, max: 3 }, { nome: 'Pedreiro', min: 2, max: 3 }, { nome: 'Servente', min: 2, max: 4 }] },
            '12':{ hh: 0.6, specs: [{ nome: 'Servente', min: 1, max: 2 }] },
          };

          // Fetch all existing especialidades for this tenant
          const { data: dbEspecialidades } = await client.from("especialidades").select("id, nome, valor_hora").eq("tenant_id", tenantId);
          const espMap = new Map();
          if (dbEspecialidades) {
            dbEspecialidades.forEach((e: any) => espMap.set(e.nome, { id: e.id, valor_hora: e.valor_hora || 0 }));
          }

          const shortProjCode = codigo_projeto.replace("P-", "").replace(`-${yearStr}`, "") || "01";
          const osRows = [];
          const equipesToInsert = [];

          // Pre-generate equipes for the 12 steps
          for (const etapa of etapas) {
            const rule = dimensionamentoRules[etapa.id.toString()];
            if (!rule) continue;

            const nomeEquipe = `Equipe - ${etapa.nome}`;
            equipesToInsert.push({
              tenant_id: tenantId,
              empresa_id: empresa_id || tenantId, // fallback to tenantId if no vendor
              contrato_id: tenantId,
              nome: nomeEquipe,
              descricao: `Equipe automatizada para etapa de ${etapa.nome}`,
              status: "ATIVA",
              updated_at: new Date().toISOString()
            });
          }

          if (equipesToInsert.length > 0) {
            const { data: insertedEquipes } = await client.from("equipes").insert(equipesToInsert).select();
            
            // Generate OSs and Composição
            if (insertedEquipes) {
              let osSeq = 1;
              const composicaoRows = [];

              for (const etapa of etapas) {
                const rule = dimensionamentoRules[etapa.id.toString()];
                if (!rule) continue;

                const eapItem = insertedEaps.find(e => e.descricao_servico === etapa.nome && e.e_analitico === true);
                const equipeItem = insertedEquipes.find(eq => eq.nome === `Equipe - ${etapa.nome}`);

                if (eapItem && equipeItem) {
                  // Build composition DB rows and description text
                  let compText = '';
                  let totalMin = 0;
                  let totalMax = 0;

                  rule.specs.forEach(spec => {
                    const espInfo = espMap.get(spec.nome);
                    if (espInfo) {
                      composicaoRows.push({
                        tenant_id: tenantId,
                        equipe_id: equipeItem.id,
                        especialidade_id: espInfo.id,
                        quantidade: spec.max,
                        valor_hora_projetado: espInfo.valor_hora
                      });
                      compText += `\n- ${spec.max}x ${spec.nome}`;
                      totalMin += spec.min;
                      totalMax += spec.max;
                    }
                  });

                  if (compText === '') {
                    compText = '\n- (Especialidades não localizadas no banco)';
                  }

                  const horasTotal = Math.round(area * rule.hh);
                  const descricaoRica = `Execução da etapa ${etapa.nome}.\nEsforço estimado: ${horasTotal} H/H para ${area}m².\nComposição Sugerida da Equipe (${totalMin} a ${totalMax} profissionais):${compText}`;
                  
                  const seqStr = osSeq.toString().padStart(3, "0");
                  const generatedNumeroOs = `OS-${seqStr}-P${shortProjCode}-${yearStr}`;

                  // Calcular fatias (MO, MAT, EQP, FERR) baseado no valorCalculado da etapa
                  const vCalc = etapa.valorCalculado || 0;
                  const moPerc = etapa.decomposicao?.mo || 0;
                  const matPerc = etapa.decomposicao?.mat || 0;
                  const eqpPerc = etapa.decomposicao?.eqp || 0;
                  const ferrPerc = etapa.decomposicao?.ferr || 0;

                  osRows.push({
                    tenant_id: tenantId,
                    projeto_id: projetoId,
                    item_eap_id: eapItem.id,
                    equipe_id: equipeItem.id,
                    numero_os: generatedNumeroOs,
                    descricao: descricaoRica,
                    status: "Emitida",
                    data_emissao: data_inicio,
                    valor_mao_obra: vCalc * (moPerc / 100),
                    valor_materiais: vCalc * (matPerc / 100),
                    valor_equipamentos: vCalc * (eqpPerc / 100),
                    valor_ferramentas: vCalc * (ferrPerc / 100)
                  });
                  osSeq++;
                }
              }

              if (composicaoRows.length > 0) {
                await client.from("equipe_composicao_especialidades").insert(composicaoRows);
              }

              if (osRows.length > 0) {
                await client.from("ordens_servico").insert(osRows);
              }
            }
          }
        }

        return res.json({ success: true, projeto: projData });
      } catch (err: any) {
        console.error("[POST /api/projetos/from-simulacao] Erro:", err);
      }
    }
  );

  // GET /api/projetos/:id/histograma-recursos - Obter dados de recursos planejados no tempo
  router.get(
    "/api/projetos/:id/histograma-recursos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const projetoId = req.params.id;

        // Buscar todas as OSs do projeto que possuem EAP e Equipe
        const { data: oss, error: osError } = await client
          .from("ordens_servico")
          .select(`
            id,
            numero_os,
            itens_eap ( data_inicio, data_fim, duracao_dias ),
            equipe_id
          `)
          .eq("projeto_id", projetoId)
          .not("equipe_id", "is", null)
          .not("item_eap_id", "is", null);

        if (osError) return res.status(500).json({ error: osError.message });
        if (!oss || oss.length === 0) return res.json({ success: true, data: [] });

        // Coletar todos os equipe_id únicos
        const equipeIds = Array.from(new Set(oss.map(os => os.equipe_id)));

        // Buscar composições das equipes
        const { data: comps, error: compError } = await client
          .from("equipe_composicao_especialidades")
          .select(`
            equipe_id,
            quantidade,
            especialidades ( nome )
          `)
          .in("equipe_id", equipeIds);

        if (compError) return res.status(500).json({ error: compError.message });

        // Montar a resposta mesclando os dados
        const result = oss.map(os => {
          const eap = Array.isArray(os.itens_eap) ? os.itens_eap[0] : os.itens_eap;
          const osComps = (comps || []).filter(c => c.equipe_id === os.equipe_id);
          
          return {
            os_id: os.id,
            numero_os: os.numero_os,
            data_inicio: eap?.data_inicio,
            data_fim: eap?.data_fim,
            duracao_dias: eap?.duracao_dias,
            composicao: osComps.map(c => ({
              especialidade: (c.especialidades as any)?.nome || 'Desconhecida',
              quantidade: c.quantidade || 0
            }))
          };
        }).filter(item => item.data_inicio && item.data_fim); // Apenas OSs com datas válidas

        return res.json({ success: true, data: result });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // GET /api/projetos/:id/calendario/horas
  router.get(
    "/api/projetos/:id/calendario/horas",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.params;
        const { inicio, fim } = req.query;

        if (!inicio || !fim) return res.status(400).json({ error: "inicio and fim are required" });

        // Fetch projeto to get calendario_id
        const { data: proj, error: projErr } = await client.from("projetos").select("calendario_id").eq("id", id).single();
        if (projErr) return res.status(500).json({ error: projErr.message });

        const calendario_id = proj?.calendario_id;
        if (!calendario_id) {
          return res.json({ success: true, data: { horas: 0, dias: 0, has_calendar: false } });
        }

        // Call the RPC function fn_calcular_horas_periodo
        const { data: horas, error: horasErr } = await client.rpc('fn_calcular_horas_periodo', {
          p_calendario_id: calendario_id,
          p_data_inicio: inicio,
          p_data_fim: fim
        });

        if (horasErr) return res.status(500).json({ error: horasErr.message });

        return res.json({ success: true, data: { horas: Number(horas || 0), has_calendar: true } });

      } catch (error: any) {
        console.error("Erro GET /api/projetos/:id/calendario/horas:", error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // POST /api/projetos - Create or update a project
  router.post(
    "/api/projetos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        const tenantId = req.decodedToken?.contrato_id;
        if (!client || !tenantId)
          return res.status(401).json({ error: "Unauthorized" });

        const { id, nome_projeto, data_inicio, calendario_id } = req.body;
        let { empresa_id } = req.body;
        if (!nome_projeto || !data_inicio) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const perfil = req.decodedToken?.perfil;
        if (perfil === "FORNECEDOR") {
          empresa_id = req.decodedToken?.empresa_id || null;
        }

        let codigo_projeto = req.body.codigo_projeto;
        if (!id && !codigo_projeto) {
          // Auto-generate project code: P-[SEQUENCIAL]-[ANO]
          const yearStr = new Date(data_inicio)
            .getFullYear()
            .toString()
            .slice(-2);
          const { count: projCount } = await client
            .from("projetos")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId);
          const seq = (projCount !== null ? projCount : 0) + 1;
          codigo_projeto = `P-${seq.toString().padStart(2, "0")}-${yearStr}`;
        }

        const upsertData: any = {
          tenant_id: tenantId,
          nome_projeto,
          data_inicio,
          empresa_id: empresa_id || null,
          calendario_id: calendario_id || null,
          updated_at: new Date().toISOString(),
        };
        if (codigo_projeto) upsertData.codigo_projeto = codigo_projeto;
        if (id) upsertData.id = id;

        const { data, error } = await saveRecord(
          client,
          "projetos",
          upsertData,
        );

        if (error) {
          console.error("[POST /api/projetos] Error saving projeto:", error);
          return res.status(500).json({ error: error.message });
        }

        // Automatically create a root EAP item and an analytic leaf if it's a new project
        if (!id && data && data.id) {
          try {
            await client.from("itens_eap").insert([
              {
                projeto_id: data.id,
                eap_codigo: "1",
                descricao_servico: "1 - " + data.nome_projeto,
                e_analitico: false,
                unidade_medida: null,
                data_inicio: data.data_inicio,
                data_fim: data.data_inicio,
                duracao_dias: 1,
                ordem: 1,
              },
              {
                projeto_id: data.id,
                eap_codigo: "1.1",
                eap_pai_codigo: "1",
                descricao_servico: "Etapa Inicial",
                e_analitico: true,
                unidade_medida: "un",
                valor_total_contratado: 0,
                data_inicio: data.data_inicio,
                data_fim: data.data_inicio,
                duracao_dias: 1,
                ordem: 2,
              },
            ]);
          } catch (eapErr) {
            console.error(
              "[POST /api/projetos] Error creating default EAP items:",
              eapErr,
            );
          }
        }

        return res.json({ projeto: data });
      } catch (err) {
        return res.status(500).json({ error: "Internal Error" });
      }
    },
  );

  // DELETE /api/projetos
  router.delete(
    "/api/projetos",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
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
    },
  );


export default router;
