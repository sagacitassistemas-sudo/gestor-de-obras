import { Router } from "express";
import { getSupabaseClient, saveRecord } from "../lib/server.lib";
import { verifyFirebaseJWT } from "../middleware/verifyFirebaseJWT";
import { AuthenticatedRequest } from "../types/middleware.types";
import {
  parseEapMarkdown,
  simulateEapTestEnvironment,
  executeEapImport,
  compareEapCodes,
} from "../services/eapImporter.service";
import multer from "multer";

const app = Router();

// Configure multer for EAP import parsing
const upload = multer({ storage: multer.memoryStorage() });

  // GET /api/itens-eap - List EAP items for a project
  app.get(
    "/api/itens-eap",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const projeto_id = req.query.projeto_id as string;
        if (!projeto_id) {
          return res
            .status(400)
            .json({ error: "Parâmetro 'projeto_id' é obrigatório." });
        }

        const { data: viewData, error: viewErr } = await client
          .from("v_resumo_eap_medicao")
          .select("*")
          .eq("projeto_id", projeto_id);

        const { data: rawData, error: rawErr } = await client
          .from("itens_eap")
          .select("*")
          .eq("projeto_id", projeto_id);

        if (viewErr && rawErr) {
          console.error(
            "[GET /api/itens-eap] Error fetching items:",
            viewErr || rawErr,
          );
          return res.status(500).json({ error: (viewErr || rawErr)?.message });
        }

        const itemsList = (
          viewData && viewData.length > 0 ? viewData : rawData || []
        ).sort((a: any, b: any) => compareEapCodes(a.eap_codigo, b.eap_codigo));

        const rawItemsList = (rawData || []).sort((a: any, b: any) =>
          compareEapCodes(a.eap_codigo, b.eap_codigo),
        );

        return res.json({
          success: true,
          items: itemsList,
          rawItems: rawItemsList,
        });
      } catch (err: any) {
        console.error("[GET /api/itens-eap] Unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  // POST /api/itens-eap - Create or update EAP item
  app.post(
    "/api/itens-eap",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const {
          id,
          projeto_id,
          eap_codigo,
          eap_pai_codigo,
          descricao_servico,
          unidade_medida,
          preco_unitario,
          quantidade_contratada,
          valor_desembolsado,
          e_analitico,
          ordem,
          data_execucao,
          duracao_dias,
          predecessores,
          data_inicio,
          data_fim,
          percentual_executado_financeiro,
          data_inicio_financeiro,
          data_fim_financeiro,
        } = req.body;
        if (!projeto_id || !eap_codigo || !descricao_servico) {
          return res
            .status(400)
            .json({
              error:
                "Campos projeto_id, eap_codigo e descricao_servico são obrigatórios.",
            });
        }

        const isAnalytic = !!e_analitico;
        const cleanCode = String(eap_codigo).trim();

        let cleanUnidade: string | null = null;
        if (isAnalytic) {
          cleanUnidade =
            unidade_medida &&
            String(unidade_medida).trim() !== "" &&
            String(unidade_medida).toLowerCase() !== "nan"
              ? String(unidade_medida).trim()
              : "un";
        }

        let cleanPai: string | null = null;
        if (
          eap_pai_codigo &&
          String(eap_pai_codigo).trim() !== "" &&
          String(eap_pai_codigo).toLowerCase() !== "nan" &&
          String(eap_pai_codigo).toLowerCase() !== "null"
        ) {
          cleanPai = String(eap_pai_codigo).trim();
        }

        const precoNum = isNaN(Number(preco_unitario))
          ? 0
          : Number(preco_unitario || 0);
        const qtdNum = isNaN(Number(quantidade_contratada))
          ? 0
          : Number(quantidade_contratada || 0);
        const desembolsadoNum = isNaN(Number(valor_desembolsado))
          ? 0
          : Number(valor_desembolsado || 0);
        const valTotal = isAnalytic
          ? Math.round(precoNum * qtdNum * 100) / 100
          : 0;
        const pctExecNum = isNaN(Number(percentual_executado_financeiro))
          ? 0
          : Number(percentual_executado_financeiro || 0);

        const upsertData: any = {
          projeto_id,
          eap_codigo: cleanCode,
          eap_pai_codigo: cleanPai,
          descricao_servico: String(descricao_servico).trim(),
          unidade_medida: cleanUnidade,
          preco_unitario: precoNum,
          quantidade_contratada: qtdNum,
          valor_total_contratado: valTotal,
          valor_desembolsado: desembolsadoNum,
          e_analitico: isAnalytic,
          ordem: isNaN(Number(ordem)) ? 0 : Number(ordem || 0),
          data_execucao:
            data_execucao && String(data_execucao).trim() !== ""
              ? String(data_execucao).trim()
              : null,
          duracao_dias: isNaN(Number(duracao_dias))
            ? 1
            : Number(duracao_dias || 1),
          data_inicio:
            data_inicio && String(data_inicio).trim() !== ""
              ? String(data_inicio).trim()
              : null,
          data_fim:
            data_fim && String(data_fim).trim() !== ""
              ? String(data_fim).trim()
              : null,
          data_inicio_financeiro:
            data_inicio_financeiro &&
            String(data_inicio_financeiro).trim() !== ""
              ? String(data_inicio_financeiro).trim()
              : null,
          data_fim_financeiro:
            data_fim_financeiro && String(data_fim_financeiro).trim() !== ""
              ? String(data_fim_financeiro).trim()
              : null,
          percentual_executado_financeiro: pctExecNum,
        };

        if (predecessores !== undefined) {
          upsertData.predecessores = Array.isArray(predecessores)
            ? predecessores
            : [];
        }

        // Resolve existing ID if not passed to prevent duplicate errors
        let targetId = id;
        if (!targetId) {
          const { data: existing } = await client
            .from("itens_eap")
            .select("id")
            .eq("projeto_id", projeto_id)
            .eq("eap_codigo", cleanCode)
            .maybeSingle();
          if (existing?.id) {
            targetId = existing.id;
          }
        }

        if (targetId) {
          upsertData.id = targetId;
        }

        const { data, error } = await saveRecord(
          client,
          "itens_eap",
          upsertData,
          { single: false },
        );

        if (error) {
          console.error("[POST /api/itens-eap] Error saving item:", error);
          return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true, item: data?.[0] || upsertData });
      } catch (err: any) {
        console.error("[POST /api/itens-eap] Unexpected error:", err);
        return res
          .status(500)
          .json({ error: err.message || "Internal Server Error" });
      }
    },
  );

  // DELETE /api/itens-eap
  app.delete(
    "/api/itens-eap",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Missing ID" });

        const { error } = await client.from("itens_eap").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  // ==========================================
  // CRONOGRAMA FÍSICO-FINANCEIRO
  // ==========================================

  /**
   * Helper function to generate or re-generate the financial schedule.
   * If onlyIfExisting is true, it will abort if there are no existing records (useful for auto-updates).
   */
  async function autoRegerarCronogramaFinanceiro(client: any, projeto_id: string, onlyIfExisting: boolean = false) {
    if (onlyIfExisting) {
      const { data: existing } = await client.from("cronograma_financeiro_semanas").select("id").eq("projeto_id", projeto_id).limit(1);
      if (!existing || existing.length === 0) return { success: false, reason: "NOT_GENERATED_YET" };
    }

    const { data: projeto } = await client.from("projetos").select("*").eq("id", projeto_id).maybeSingle();
    if (!projeto) throw new Error("Projeto não encontrado.");

    const projStart = projeto.data_inicio || new Date().toISOString().split("T")[0];

    const { data: items, error: itemsErr } = await client.from("itens_eap").select("*").eq("projeto_id", projeto_id);
    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) throw new Error("Nenhum item EAP cadastrado neste projeto.");

    const analyticItems = items.filter((i: any) => i.e_analitico);
    if (analyticItems.length === 0) throw new Error("Nenhum item analítico na EAP para gerar cronograma financeiro.");

    const getMonday = (d: Date): Date => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.getFullYear(), d.getMonth(), diff);
    };

    const addDays = (d: Date, n: number): Date => {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    };

    const fmt = (d: Date): string => d.toISOString().split("T")[0];

    const allWeekRows: any[] = [];

    for (const item of analyticItems) {
      const startStr = item.data_inicio_financeiro || item.data_inicio || item.data_execucao || projStart;
      const duracaoDias = Math.max(1, item.duracao_dias || 1);
      const endStr = item.data_fim_financeiro || item.data_fim || fmt(addDays(new Date(startStr), duracaoDias - 1));

      if (!item.data_inicio_financeiro || !item.data_fim_financeiro) {
        await client.from("itens_eap").update({
          data_inicio_financeiro: startStr,
          data_fim_financeiro: endStr,
        }).eq("id", item.id);
      }

      const valorTotal = Number(item.valor_total_contratado || 0);
      if (valorTotal <= 0) continue;

      const start = new Date(startStr);
      const end = new Date(endStr);
      let weekStart = getMonday(start);
      const weeks: { semana_inicio: string; semana_fim: string }[] = [];
      
      while (weekStart <= end) {
        const weekEnd = addDays(weekStart, 6);
        weeks.push({ semana_inicio: fmt(weekStart), semana_fim: fmt(weekEnd) });
        weekStart = addDays(weekStart, 7);
      }

      if (weeks.length === 0) {
        weeks.push({ semana_inicio: fmt(getMonday(start)), semana_fim: fmt(addDays(getMonday(start), 6)) });
      }

      const weeksCount = weeks.length;
      let acumuladoAnterior = 0;

      for (let i = 0; i < weeksCount; i++) {
        // Usa a Curva S (Beta): S(t) = 3t^2 - 2t^3
        // 't' é a fração do tempo decorrido, onde 0 <= t <= 1
        const t = (i + 1) / weeksCount;
        const s_t = (3 * Math.pow(t, 2)) - (2 * Math.pow(t, 3));
        
        const valorAcumuladoAtual = s_t * valorTotal;
        let val = Math.round((valorAcumuladoAtual - acumuladoAnterior) * 100) / 100;
        
        if (i === weeksCount - 1) {
          // Ajusta a última semana para garantir o fechamento exato do valor total
          const somaAnteriores = allWeekRows
            .filter((r) => r.item_eap_id === item.id)
            .reduce((acc, curr) => acc + curr.valor_planejado, 0);
          val = Math.round((valorTotal - somaAnteriores) * 100) / 100;
        }

        allWeekRows.push({
          projeto_id,
          item_eap_id: item.id,
          eap_codigo: item.eap_codigo,
          semana_inicio: weeks[i].semana_inicio,
          semana_fim: weeks[i].semana_fim,
          valor_planejado: val,
          valor_realizado: 0,
          updated_at: new Date().toISOString(),
        });

        acumuladoAnterior = valorAcumuladoAtual;
      }
    }

    await client.from("cronograma_financeiro_semanas").delete().eq("projeto_id", projeto_id);

    if (allWeekRows.length === 0) {
      throw new Error("Nenhum item analítico possui 'Valor Total Contratado' maior que zero. Adicione valores aos itens para gerar o cronograma financeiro.");
    }

    const { error: insertErr } = await client.from("cronograma_financeiro_semanas").insert(allWeekRows);
    if (insertErr) throw insertErr;

    return {
      success: true,
      message: `Cronograma Físico-Financeiro gerado com ${allWeekRows.length} registros semanais.`,
      totalRegistros: allWeekRows.length,
      totalItensAnaliticos: analyticItems.length,
    };
  }

  /**
   * POST /api/cronograma/financeiro/gerar
   * Lê todos os itens analíticos da EAP do projeto e distribui linearmente
   * o valor_total_contratado de cada item pelas semanas de sua duração.
   */
  app.post(
    "/api/cronograma/financeiro/gerar",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { projeto_id } = req.body;
        if (!projeto_id) return res.status(400).json({ error: "projeto_id é obrigatório." });

        const result = await autoRegerarCronogramaFinanceiro(client, projeto_id, false);
        return res.json(result);
      } catch (err: any) {
        console.error("[POST /api/cronograma/financeiro/gerar] Error:", err);
        return res.status(err.message?.includes("Nenhum item") ? 400 : 500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  /**
   * GET /api/cronograma/financeiro/:projeto_id
   * Retorna os dados semanais do cronograma financeiro para exibição na matriz.
   */
  app.get(
    "/api/cronograma/financeiro/:projeto_id",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const projetoId = req.params.projeto_id;

        // Buscar itens EAP para context (todos, incluindo sintéticos)
        const { data: eapItems } = await client
          .from("itens_eap")
          .select(
            "id, eap_codigo, eap_pai_codigo, descricao_servico, e_analitico, valor_total_contratado, data_inicio_financeiro, data_fim_financeiro, data_inicio, data_fim",
          )
          .eq("projeto_id", projetoId);

        // Buscar dados semanais
        const { data: weekData, error: weekErr } = await client
          .from("cronograma_financeiro_semanas")
          .select("*")
          .eq("projeto_id", projetoId)
          .order("semana_inicio", { ascending: true });

        if (weekErr) return res.status(500).json({ error: weekErr.message });

        return res.json({
          success: true,
          eapItems: eapItems || [],
          weekData: weekData || [],
        });
      } catch (err: any) {
        console.error("[GET /api/cronograma/financeiro] Error:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  /**
   * POST /api/cronograma/financeiro/salvar
   * Persiste edições manuais feitas pelo usuário em uma célula (semana x EAP).
   */
  app.post(
    "/api/cronograma/financeiro/salvar",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { updates } = req.body;
        if (!updates || !Array.isArray(updates)) {
          return res
            .status(400)
            .json({ error: "Campo 'updates' (array) é obrigatório." });
        }

        for (const upd of updates) {
          if (upd.id) {
            await client
              .from("cronograma_financeiro_semanas")
              .update({
                valor_planejado: upd.valor_planejado ?? undefined,
                valor_realizado: upd.valor_realizado ?? undefined,
                updated_at: new Date().toISOString(),
              })
              .eq("id", upd.id);
          }
        }

        return res.json({
          success: true,
          message: `${updates.length} registros atualizados.`,
        });
      } catch (err: any) {
        console.error("[POST /api/cronograma/financeiro/salvar] Error:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  // POST /api/eap/import/analyze - Pipeline Etapas 1, 2, 3 e 4 (Leitura, Alinhamento de BD em memória, Testes e Modelo Interpretado)

  app.post(
    "/api/eap/import/analyze",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { projeto_id, md_content } = req.body;
        if (!projeto_id || !md_content) {
          return res
            .status(400)
            .json({
              error: "Parâmetros 'projeto_id' e 'md_content' são obrigatórios.",
            });
        }

        // 1. Etapa 1: Leitura (.md)
        const { items: parsedItems, rawHeaders } = parseEapMarkdown(md_content);

        // Busca itens existentes no banco de dados para o projeto (se houver)
        const { data: dbItems } = await client
          .from("itens_eap")
          .select("*")
          .eq("projeto_id", projeto_id);

        // 2. Etapa 2, 3 e 4: Alinhamento BD em Memória, Simulação em Ambiente de Teste e Geração do Modelo Interpretado
        const simulationResult = simulateEapTestEnvironment(
          projeto_id,
          parsedItems,
          rawHeaders,
          dbItems || [],
        );

        return res.json({
          success: true,
          simulation: simulationResult,
        });
      } catch (err: any) {
        console.error("[POST /api/eap/import/analyze] Error:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  // POST /api/eap/import/analyze-items - Pipeline Etapas 2, 3 e 4 para itens XML pré-parseados
  app.post(
    "/api/eap/import/analyze-items",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { projeto_id, items } = req.body;
        if (!projeto_id || !items || !Array.isArray(items)) {
          return res
            .status(400)
            .json({
              error: "Parâmetros 'projeto_id' e 'items' são obrigatórios.",
            });
        }

        // Se projeto_id for "new", dbItems é vazio. Senão, busca no banco.
        let dbItems: any[] = [];
        if (projeto_id !== "new") {
          const { data } = await client
            .from("itens_eap")
            .select("*")
            .eq("projeto_id", projeto_id);
          dbItems = data || [];
        }

        const rawHeaders = [
          "codigo",
          "descricao",
          "inicio",
          "fim",
          "duracao",
          "predecessores",
          "unidade",
          "preco",
          "quantidade",
        ];

        const simulationResult = simulateEapTestEnvironment(
          projeto_id,
          items,
          rawHeaders,
          dbItems,
        );

        return res.json({
          success: true,
          simulation: simulationResult,
        });
      } catch (err: any) {
        console.error("[POST /api/eap/import/analyze-items] Error:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  // POST /api/eap/import/execute - Pipeline Etapa 5 (Importação Persistente após Aprovação)
  app.post(
    "/api/eap/import/execute",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });

        const { projeto_id, items } = req.body;
        if (!projeto_id || !Array.isArray(items) || items.length === 0) {
          return res
            .status(400)
            .json({
              error:
                "Parâmetros 'projeto_id' e lista 'items' válidos são obrigatórios.",
            });
        }

        // Etapa 5: Importação transacional no BD
        const result = await executeEapImport(
          client,
          saveRecord,
          projeto_id,
          items,
        );

        if (!result.success) {
          return res.status(500).json({
            success: false,
            error: "Falha durante a importação no banco de dados.",
            details: result.errors,
          });
        }

        return res.json({
          success: true,
          importedCount: result.importedCount,
          message: `${result.importedCount} etapas da EAP foram importadas com sucesso!`,
        });
      } catch (err: any) {
        console.error("[POST /api/eap/import/execute] Error:", err);
        return res.status(500).json({ error: err.message || "Internal Error" });
      }
    },
  );

  // GET /api/cronograma/:projeto_id/export
  app.get(
    "/api/cronograma/:projeto_id/export",
    verifyFirebaseJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const client = getSupabaseClient(req);
        if (!client) return res.status(401).json({ error: "Unauthorized" });
        const { projeto_id } = req.params;
        const { format } = req.query; // 'xlsx' | 'xml'

        const { data: items } = await client
          .from("v_resumo_eap_medicao")
          .select("*")
          .eq("projeto_id", projeto_id)
          .order("ordem", { ascending: true });
        if (!items) return res.status(404).json({ error: "No items found" });

        if (format === "xlsx") {
          const { generateXlsxBuffer } =
            await import("../utils/cronogramaExport.js");
          const buffer = await generateXlsxBuffer(
            items,
            `Projeto-${projeto_id}`,
          );
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="cronograma-${projeto_id}.xlsx"`,
          );
          return res.send(Buffer.from(buffer));
        } else if (format === "xml") {
          const { generateMppXml } =
            await import("../utils/cronogramaExport.js");
          const xml = generateMppXml(items, `Projeto-${projeto_id}`);
          res.setHeader("Content-Type", "application/xml");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="cronograma-${projeto_id}.xml"`,
          );
          return res.send(xml);
        }

        return res
          .status(400)
          .json({ error: "Formato inválido. Use format=xlsx ou format=xml" });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    },
  );


export default app;
