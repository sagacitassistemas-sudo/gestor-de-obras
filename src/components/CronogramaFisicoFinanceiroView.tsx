import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { AuthSession } from "../types";
import { compareEapCodes } from "../services/eapImporter.service";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Projeto {
  id: string;
  nome_projeto: string;
  data_inicio?: string;
  codigo_projeto?: string;
}

interface EapItem {
  id: string;
  eap_codigo: string;
  eap_pai_codigo: string | null;
  descricao_servico: string;
  e_analitico: boolean;
  valor_total_contratado: number;
  data_inicio_financeiro: string | null;
  data_fim_financeiro: string | null;
  data_inicio: string | null;
  data_fim: string | null;
}

interface WeekRow {
  id: string;
  item_eap_id: string;
  eap_codigo: string;
  semana_inicio: string;
  semana_fim: string;
  valor_planejado: number;
  valor_realizado: number;
}

interface CronogramaFisicoFinanceiroViewProps {
  authSession: AuthSession | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    val,
  );

const formatWeekLabel = (semanaInicio: string) => {
  const d = new Date(semanaInicio + "T12:00:00");
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export const CronogramaFisicoFinanceiroView: React.FC<
  CronogramaFisicoFinanceiroViewProps
> = ({ authSession }) => {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState("");
  const [eapItems, setEapItems] = useState<EapItem[]>([]);
  const [weekData, setWeekData] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasData, setHasData] = useState(false);

  // ── 1. Carregar projetos ────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token || authSession?.idToken;
        const res = await fetch("/api/projetos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const list: Projeto[] = json.projetos || json;
          if (Array.isArray(list) && list.length > 0) {
            setProjetos(list);
            setSelectedProjetoId(list[0].id);
          }
        }
      } catch {
        const { data } = await supabase
          .from("projetos")
          .select("*")
          .order("nome_projeto");
        if (data?.length) {
          setProjetos(data as Projeto[]);
          setSelectedProjetoId(data[0].id);
        }
      }
    };
    load();
  }, []);

  // ── 2. Carregar dados do cronograma financeiro ──────────────────────────────

  const fetchFinanceData = async (projetoId: string) => {
    if (!projetoId) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const res = await fetch(`/api/cronograma/financeiro/${projetoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const sortedEap = (json.eapItems || []).sort(
            (a: EapItem, b: EapItem) =>
              compareEapCodes(a.eap_codigo, b.eap_codigo),
          );
          setEapItems(sortedEap);
          setWeekData(json.weekData || []);
          setHasData((json.weekData || []).length > 0);
        }
      }
    } catch (err) {
      console.error(
        "[CronogramaFisicoFinanceiroView] fetchFinanceData error:",
        err,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjetoId) fetchFinanceData(selectedProjetoId);
  }, [selectedProjetoId]);

  // ── 3. Gerar Cronograma ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!selectedProjetoId) return;
    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const res = await fetch("/api/cronograma/financeiro/gerar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projeto_id: selectedProjetoId }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert(`✅ ${json.message}`);
        await fetchFinanceData(selectedProjetoId);
      } else {
        alert(
          `❌ Erro: ${json.error || "Falha ao gerar cronograma financeiro."}`,
        );
      }
    } catch (err: any) {
      alert(`❌ Erro inesperado: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── 4. Computar a Matriz Semanal ────────────────────────────────────────────

  const {
    weeks,
    matrix,
    weekTotals,
    grandTotal,
    accumulatedTotals,
    chartData,
  } = useMemo(() => {
    // Coletar todas as semanas únicas (ordenadas)
    const weekSet = new Set<string>();
    weekData.forEach((w) => weekSet.add(w.semana_inicio));
    const sortedWeeks = Array.from(weekSet).sort();

    // Construir mapa: eap_codigo -> { semana_inicio -> valor_planejado }
    const matrixMap: Record<string, Record<string, number>> = {};
    weekData.forEach((w) => {
      if (!matrixMap[w.eap_codigo]) matrixMap[w.eap_codigo] = {};
      matrixMap[w.eap_codigo][w.semana_inicio] =
        (matrixMap[w.eap_codigo][w.semana_inicio] || 0) + w.valor_planejado;
    });

    // Para itens sintéticos: somar valores dos filhos analíticos
    const sortedEap = [...eapItems].sort((a, b) =>
      compareEapCodes(a.eap_codigo, b.eap_codigo),
    );
    sortedEap.forEach((item) => {
      if (!item.e_analitico) {
        // Agrupar filhos
        const childRows = weekData.filter((w) => {
          const childItem = eapItems.find((e) => e.eap_codigo === w.eap_codigo);
          return (
            childItem &&
            childItem.e_analitico &&
            childItem.eap_codigo.startsWith(item.eap_codigo + ".")
          );
        });
        const aggMap: Record<string, number> = {};
        childRows.forEach((w) => {
          aggMap[w.semana_inicio] =
            (aggMap[w.semana_inicio] || 0) + w.valor_planejado;
        });
        matrixMap[item.eap_codigo] = aggMap;
      }
    });

    // Totais por semana (somente analíticos para não duplicar)
    const totals: Record<string, number> = {};
    sortedWeeks.forEach((w) => {
      totals[w] = 0;
      weekData.forEach((row) => {
        if (row.semana_inicio === w) totals[w] += row.valor_planejado;
      });
    });

    // Acumulados
    const accumulated: Record<string, number> = {};
    let runningTotal = 0;
    sortedWeeks.forEach((w) => {
      runningTotal += totals[w];
      accumulated[w] = runningTotal;
    });

    const chart = sortedWeeks.map((w) => ({
      name: formatWeekLabel(w),
      valorPorSemana: totals[w] || 0,
      valorAcumulado: accumulated[w] || 0,
    }));

    return {
      weeks: sortedWeeks,
      matrix: matrixMap,
      weekTotals: totals,
      grandTotal: runningTotal,
      accumulatedTotals: accumulated,
      chartData: chart,
    };
  }, [eapItems, weekData]);

  const selectedProj = projetos.find((p) => p.id === selectedProjetoId);
  const getDepth = (codigo: string) =>
    codigo ? codigo.split(".").length - 1 : 0;

  // ── 5. Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full -z-10" />
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-emerald-700 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px]">
                payments
              </span>
              Cronograma Físico-Financeiro
            </h2>
          </div>
          <p className="text-sm text-[#404753] mt-1 font-medium">
            Distribuição semanal de custos planejados por item da EAP com curva
            acumulada.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedProjetoId}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg shadow-md shadow-emerald-600/30 font-bold text-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              {generating ? "sync" : "auto_fix_high"}
            </span>
            {generating
              ? "Gerando..."
              : hasData
                ? "Regenerar Cronograma"
                : "Gerar Cronograma Financeiro"}
          </button>
        </div>
      </div>

      {/* ── Seletor de Projeto ── */}
      <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">
              architecture
            </span>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Projeto
            </label>
            <select
              value={selectedProjetoId}
              onChange={(e) => setSelectedProjetoId(e.target.value)}
              className="w-full max-w-md px-3.5 py-2 bg-white border border-[#c0c7d6] rounded-lg text-[#191c1e] font-bold text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-xs cursor-pointer"
            >
              {projetos.length === 0 && (
                <option value="">Nenhum projeto cadastrado</option>
              )}
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo_projeto ? `[${p.codigo_projeto}] ` : ""}
                  {p.nome_projeto}
                </option>
              ))}
            </select>
          </div>
          {selectedProj && (
            <div className="hidden md:flex items-center gap-3 text-xs text-[#707785]">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold">
                {eapItems.length} itens EAP
              </span>
              <span className="bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 rounded-full font-bold">
                {weeks.length} semanas
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <span className="ml-3 text-[#707785] font-medium">
            Carregando dados financeiros...
          </span>
        </div>
      )}

      {/* ── Estado Vazio ── */}
      {!loading && !hasData && selectedProjetoId && (
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-emerald-300 block mb-3">
            receipt_long
          </span>
          <h3 className="text-lg font-bold text-[#191c1e] mb-2">
            Cronograma Financeiro não gerado
          </h3>
          <p className="text-sm text-[#707785] max-w-md mx-auto mb-4">
            Clique em <strong>"Gerar Cronograma Financeiro"</strong> para
            distribuir os custos da EAP por semana. Certifique-se de que o
            projeto possui itens analíticos com valores cadastrados.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              auto_fix_high
            </span>
            Gerar Agora
          </button>
        </div>
      )}

      {/* ── Tabela Matricial ── */}
      {!loading && hasData && (
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden">
          <div className="p-4 border-b border-[#e1e2e8] bg-[#f7f9fb] flex justify-between items-center">
            <h3 className="font-bold text-[#191c1e] flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                table_chart
              </span>
              Matriz Semanal de Custos
            </h3>
            <span className="text-xs font-mono font-bold text-[#707785] bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              {formatCurrency(grandTotal)} total planejado
            </span>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-340px)] overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-20 bg-[#f2f4f6]">
                <tr className="text-[10px] uppercase tracking-wider font-bold text-[#404753]">
                  <th className="px-3 py-3 border-b border-r border-[#c0c7d6] w-20 sticky left-0 bg-[#f2f4f6] z-30">
                    EAP
                  </th>
                  <th className="px-3 py-3 border-b border-r border-[#c0c7d6] min-w-[180px] sticky left-[80px] bg-[#f2f4f6] z-30">
                    Serviço
                  </th>
                  <th className="px-3 py-3 border-b border-r border-[#c0c7d6] w-28 text-right">
                    V. Contratado
                  </th>
                  {weeks.map((w, i) => (
                    <th
                      key={w}
                      className="px-2 py-3 border-b border-r border-[#c0c7d6] w-24 text-center"
                    >
                      <div className="text-[9px] text-[#707785]">S{i + 1}</div>
                      <div className="text-[10px] font-bold">
                        {formatWeekLabel(w)}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 border-b border-[#c0c7d6] w-28 text-right bg-emerald-50">
                    Total Linha
                  </th>
                </tr>
              </thead>
              <tbody className="text-[11px]">
                {eapItems.map((item) => {
                  const depth = getDepth(item.eap_codigo);
                  const isSintetico = !item.e_analitico;
                  const rowValues = matrix[item.eap_codigo] || {};
                  const rowTotal = Object.values(rowValues).reduce(
                    (s: number, v: number) => s + v,
                    0,
                  ) as number;

                  // Pular itens sem dados e sem filhos com dados
                  if (isSintetico && rowTotal === 0) return null;

                  return (
                    <tr
                      key={item.eap_codigo}
                      className={`border-b border-[#e1e2e8] hover:bg-[#f7f9fb] transition-colors ${isSintetico ? "bg-[#f7f9fb]" : ""}`}
                    >
                      <td
                        className={`px-3 py-2.5 border-r border-[#e1e2e8] sticky left-0 z-10 font-mono ${isSintetico ? "font-bold text-[#191c1e] bg-[#f7f9fb]" : "bg-white text-[#707785]"}`}
                      >
                        {item.eap_codigo}
                      </td>
                      <td
                        className={`px-3 py-2.5 border-r border-[#e1e2e8] sticky left-[80px] z-10 ${isSintetico ? "font-bold text-[#191c1e] bg-[#f7f9fb]" : "bg-white text-[#404753]"}`}
                        style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
                      >
                        {item.descricao_servico}
                      </td>
                      <td
                        className={`px-3 py-2.5 border-r border-[#e1e2e8] text-right font-mono ${isSintetico ? "font-bold text-emerald-700" : "text-[#191c1e]"}`}
                      >
                        {formatCurrency(item.valor_total_contratado || 0)}
                      </td>
                      {weeks.map((w) => {
                        const val = rowValues[w] || 0;
                        return (
                          <td
                            key={w}
                            className={`px-2 py-2.5 border-r border-[#e1e2e8] text-right font-mono ${val > 0 ? (isSintetico ? "font-bold text-emerald-700 bg-emerald-50/50" : "text-[#191c1e] bg-sky-50/30") : "text-[#c0c7d6]"}`}
                          >
                            {val > 0 ? formatCurrency(val) : "-"}
                          </td>
                        );
                      })}
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-bold bg-emerald-50 ${isSintetico ? "text-emerald-800" : "text-emerald-700"}`}
                      >
                        {formatCurrency(rowTotal)}
                      </td>
                    </tr>
                  );
                })}

                {/* ── Linha Totalizadora Semanal ── */}
                <tr className="bg-slate-800 text-white font-bold sticky bottom-8">
                  <td
                    className="px-3 py-3 border-r border-slate-600 sticky left-0 z-10 text-[10px] uppercase tracking-wider bg-slate-800"
                    colSpan={2}
                  >
                    Total por Semana
                  </td>
                  <td className="px-3 py-3 border-r border-slate-600 text-right font-mono text-emerald-300">
                    {formatCurrency(grandTotal)}
                  </td>
                  {weeks.map((w) => (
                    <td
                      key={w}
                      className="px-2 py-3 border-r border-slate-600 text-right font-mono text-emerald-300"
                    >
                      {formatCurrency(weekTotals[w] || 0)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-mono text-emerald-300 bg-slate-900">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>

                {/* ── Linha Acumulada (Curva S) ── */}
                <tr className="bg-emerald-700 text-white font-bold sticky bottom-0">
                  <td
                    className="px-3 py-3 border-r border-emerald-600 sticky left-0 z-10 text-[10px] uppercase tracking-wider bg-emerald-700"
                    colSpan={2}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">
                        show_chart
                      </span>
                      Acumulado (Curva S)
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-emerald-600 text-right font-mono">
                    —
                  </td>
                  {weeks.map((w) => (
                    <td
                      key={w}
                      className="px-2 py-3 border-r border-emerald-600 text-right font-mono text-emerald-100"
                    >
                      {formatCurrency(accumulatedTotals[w] || 0)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-mono bg-emerald-800 text-emerald-100">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Gráfico Físico-Financeiro ── */}
      {!loading && hasData && (
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] p-6 mt-6">
          <h3 className="font-bold text-[#191c1e] mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">
              insights
            </span>
            Evolução Físico-Financeira
          </h3>
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid
                  stroke="#f5f5f5"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  scale="band"
                  tick={{ fontSize: 12, fill: "#707785" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e1e2e8" }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(value) =>
                    value > 1000
                      ? `R$ ${(value / 1000).toFixed(0)}k`
                      : `R$ ${value}`
                  }
                  tick={{ fontSize: 12, fill: "#707785" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e1e2e8" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) =>
                    value > 1000
                      ? `R$ ${(value / 1000).toFixed(0)}k`
                      : `R$ ${value}`
                  }
                  tick={{ fontSize: 12, fill: "#707785" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e1e2e8" }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "valorPorSemana"
                      ? "Valor no Período"
                      : "Acumulado",
                  ]}
                  labelStyle={{ fontWeight: "bold", color: "#191c1e" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "13px", paddingTop: "20px" }}
                  iconType="circle"
                />
                <Bar
                  yAxisId="left"
                  dataKey="valorPorSemana"
                  name="Valor no Período"
                  barSize={32}
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="valorAcumulado"
                  name="Acumulado (Curva S)"
                  stroke="#047857"
                  strokeWidth={4}
                  dot={{
                    r: 4,
                    fill: "#047857",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
