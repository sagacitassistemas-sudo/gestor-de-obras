import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthSession } from '../types';
import { Gantt, ITask, ILink, IApi } from '@svar-ui/react-gantt';
import { CadastroEtapaModal } from './CadastroEtapaModal';
import '@svar-ui/react-gantt/all.css';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Projeto {
  id: string;
  nome_projeto: string;
  tenant_id: string;
  codigo_contrato?: string;
  data_inicio?: string;
}

interface ItemEap {
  id: string;
  item_eap_id?: string;
  eap_codigo: string;
  descricao_servico: string;
  data_execucao: string | null;
  duracao_dias: number;
  e_analitico: boolean;
  predecessores?: string[];
  data_inicio?: string | null;
  data_fim?: string | null;
  percentual_executado_financeiro?: number;
}

interface CronogramaExecutivoViewProps {
  authSession: AuthSession | null;
}

// ─── Helpers de data (sem problemas de fuso horário) ─────────────────────────

/**
 * Converte qualquer valor para Date usando as partes locais da data (YYYY-MM-DD).
 * Evita o shift de fuso horário do `new Date("2026-08-01")` que converte para UTC+0
 * e retorna o dia anterior em fusos negativos (ex: America/Sao_Paulo UTC-3).
 */
function parseSafeDate(dateVal: any, fallback: Date): Date {
  if (!dateVal) return fallback;
  const dateStr = String(dateVal).trim().split('T')[0];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d, 12, 0, 0);
  }
  const dt = new Date(dateVal);
  if (isNaN(dt.getTime())) return fallback;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0);
}

/**
 * Converte um Date ou string para "YYYY-MM-DD" de forma imune a deslocamentos de fuso horário.
 */
function toYMD(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') {
    const clean = d.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(ymd: string, days: number): string {
  const dt = parseSafeDate(ymd, new Date());
  dt.setDate(dt.getDate() + days);
  return toYMD(dt);
}

function diffDays(ymd1: string, ymd2: string): number {
  const d1 = parseSafeDate(ymd1, new Date());
  const d2 = parseSafeDate(ymd2, new Date());
  return Math.round((d1.getTime() - d2.getTime()) / 86400000);
}

// ─── Parser de predecessor (ex: "1.1.1FS+2" → { code, type, lag }) ───────────

function parsePredecessor(predStr: string): { code: string; type: string; lag: number } {
  const match = predStr.match(/^([A-Za-z0-9.]+?)(?:(FS|SS|FF|SF))?(?:([+-]\d+))?$/);
  if (!match) return { code: predStr, type: 'FS', lag: 0 };
  return {
    code: match[1],
    type: match[2] || 'FS',
    lag: parseInt(match[3] || '0', 10),
  };
}

const PM_TO_SVAR: Record<string, string> = { FS: 'e2s', SS: 's2s', FF: 'e2e', SF: 's2e' };
const SVAR_TO_PM: Record<string, string> = { e2s: 'FS', s2s: 'SS', e2e: 'FF', s2e: 'SF' };

// ─── Componente Principal ─────────────────────────────────────────────────────

export const CronogramaExecutivoView: React.FC<CronogramaExecutivoViewProps> = ({ authSession }) => {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('');
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [links, setLinks] = useState<ILink[]>([]);
  const [rawItems, setRawItems] = useState<ItemEap[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCadastroEtapaOpen, setIsCadastroEtapaOpen] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refs para acesso sem stale closures dentro dos handlers do Gantt
  const rawItemsRef = useRef<ItemEap[]>([]);
  const selectedProjRef = useRef<Projeto | null>(null);
  const pendingItemsRef = useRef<Map<string, ItemEap>>(new Map<string, ItemEap>());

  useEffect(() => { rawItemsRef.current = rawItems; }, [rawItems]);

  const selectedProj = projetos.find(p => p.id === selectedProjetoId) ?? null;
  useEffect(() => { selectedProjRef.current = selectedProj; }, [selectedProj]);

  // ── 1. Carregar projetos ────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token || authSession?.idToken;
        const res = await fetch('/api/projetos', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const json = await res.json();
          const list: Projeto[] = json.projetos || json;
          if (Array.isArray(list) && list.length > 0) {
            setProjetos(list);
            setSelectedProjetoId(id => id || list[0].id);
          }
        }
      } catch {
        const { data } = await supabase.from('projetos').select('*').order('nome_projeto');
        if (data?.length) {
          setProjetos(data);
          setSelectedProjetoId(id => id || data[0].id);
        }
      }
    };
    load();
  }, []);

  // ── 2. Carregar itens EAP e construir Gantt ─────────────────────────────────

  const buildGanttData = (items: ItemEap[], projStart?: string): { ganttTasks: ITask[]; ganttLinks: ILink[] } => {
    const fallback = parseSafeDate(projStart, new Date());
    const validCodes = new Set(items.map(i => i.eap_codigo));

    // Determina o pai hierárquico pelo código (ex: "1.2.3" → "1.2")
    const getParentCode = (code: string): string | undefined => {
      const parts = code.split('.');
      while (parts.length > 1) {
        parts.pop();
        const candidate = parts.join('.');
        if (validCodes.has(candidate)) return candidate;
      }
      return undefined;
    };

    const parentMap = new Map<string, string | undefined>();
    const childCount = new Map<string, number>();
    items.forEach(item => {
      const p = getParentCode(item.eap_codigo);
      parentMap.set(item.eap_codigo, p);
      if (p) childCount.set(p, (childCount.get(p) ?? 0) + 1);
    });

    // Mapa de dados calculados por tarefa
    type TData = { start: Date; end: Date; dur: number; isSummary: boolean; pCode?: string };
    const tmap = new Map<string, TData>();

    items.forEach(item => {
      const pCode = parentMap.get(item.eap_codigo);
      const isSummary = (childCount.get(item.eap_codigo) ?? 0) > 0;
      const start = parseSafeDate(item.data_inicio ?? item.data_execucao, fallback);
      const dur = Math.max(1, item.duracao_dias || 1);
      const end = item.data_fim
        ? parseSafeDate(item.data_fim, new Date(start.getTime() + (dur - 1) * 86400000))
        : new Date(start.getTime() + (dur - 1) * 86400000);
      tmap.set(item.eap_codigo, { start, end, dur, isSummary, pCode });
    });

    // Rollup bottom-up: summary tasks absorvem o span dos seus filhos
    const byDepthDesc = [...items].sort((a, b) => b.eap_codigo.split('.').length - a.eap_codigo.split('.').length);

    // Reset summary dates so they will be recalculated from children
    byDepthDesc.forEach(item => {
      const t = tmap.get(item.eap_codigo)!;
      if (t.isSummary) {
        t.start = new Date(8640000000000000);
        t.end = new Date(-8640000000000000);
      }
    });

    byDepthDesc.forEach(item => {
      const pCode = parentMap.get(item.eap_codigo);
      if (!pCode) return;
      const child = tmap.get(item.eap_codigo)!;
      const parent = tmap.get(pCode);
      if (!parent) return;
      // Usa datas da criança apenas se ela não estiver no reset state
      if (child.start.getTime() < 8640000000000000) {
        if (child.start < parent.start) parent.start = new Date(child.start);
        if (child.end > parent.end) parent.end = new Date(child.end);
      }
    });

    // Finaliza duração dos summary tasks; fallback se não tiver filhos
    items.forEach(item => {
      const t = tmap.get(item.eap_codigo)!;
      if (t.isSummary) {
        if (t.start.getTime() > 8000000000000000) {
          t.start = parseSafeDate(item.data_inicio ?? item.data_execucao, fallback);
          t.end = item.data_fim ? parseSafeDate(item.data_fim, t.start) : t.start;
        }
        t.dur = Math.max(1, Math.round((t.end.getTime() - t.start.getTime()) / 86400000) + 1);
      }
    });

    // Monta array ITask para o SVAR Gantt
    // IMPORTANTE: não passar `end` — o SVAR calcula a partir de start+duration.
    // Passar `end` junto com `duration` causa conflito interno e barras de largura zero.
    const ganttTasks: ITask[] = items.map(item => {
      const t = tmap.get(item.eap_codigo)!;
      const task: ITask = {
        id: item.eap_codigo,
        text: item.descricao_servico,
        start: t.start,
        duration: t.dur,
        type: t.isSummary ? 'summary' : 'task',
        parent: t.pCode ?? 0,  // SVAR requer 0 (não undefined) para tarefas raiz
        open: t.isSummary ? true : undefined,
        progress: item.percentual_executado_financeiro ?? 0,
        rollup: t.isSummary ? true : undefined,
      };
      return task;
    });

    // Monta links a partir do array de predecessores (suporta "1.1.1FS+2")
    const validIds = new Set(ganttTasks.map(t => String(t.id)));
    const ganttLinks: ILink[] = [];
    items.forEach(item => {
      (item.predecessores ?? []).forEach((predRaw, idx) => {
        const { code: src, type: ptype, lag } = parsePredecessor(String(predRaw).trim());
        const tgt = String(item.eap_codigo);
        if (validIds.has(src) && validIds.has(tgt) && src !== tgt) {
          ganttLinks.push({
            id: `lnk_${src}_${tgt}_${idx}`,  // underscores em vez de hífens para robustez
            source: src,
            target: tgt,
            type: (PM_TO_SVAR[ptype] as any) ?? 'e2s',
            lag,
          });
        }
      });
    });

    return { ganttTasks, ganttLinks };
  };

  const fetchEapItems = async (projetoId: string) => {
    setLoading(true);
    pendingItemsRef.current = new Map();
    setHasPendingChanges(false);
    try {
      const { data } = await supabase
        .from('v_resumo_eap_medicao')
        .select('*')
        .eq('projeto_id', projetoId)
        .order('eap_codigo');

      if (data?.length) {
        const items: ItemEap[] = data.map((r: any) => ({
          id: String(r.eap_codigo),
          item_eap_id: r.item_eap_id,
          eap_codigo: String(r.eap_codigo),
          descricao_servico: String(r.descricao_servico || ''),
          data_execucao: r.data_execucao || null,
          duracao_dias: Math.max(1, Number(r.duracao_dias || 1)),
          e_analitico: !!r.e_analitico,
          predecessores: Array.isArray(r.predecessores) ? r.predecessores : [],
          data_inicio: r.data_inicio || null,
          data_fim: r.data_fim || null,
          percentual_executado_financeiro: Number(r.percentual_executado_financeiro || 0),
        }));

        const proj = projetos.find(p => p.id === projetoId);
        const { ganttTasks, ganttLinks } = buildGanttData(items, proj?.data_inicio);
        setRawItems(items);
        setTasks(ganttTasks);
        setLinks(ganttLinks);
      } else {
        setTasks([]);
        setLinks([]);
        setRawItems([]);
      }
    } catch (err) {
      console.error('[CronogramaExecutivoView] fetchEapItems error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedProjetoId) { setTasks([]); setLinks([]); return; }
    fetchEapItems(selectedProjetoId);
  }, [selectedProjetoId]);

  // ── 3. Lógica de propagação de dependências (no cliente, optimistic UI) ─────

  /**
   * Recalcula datas de todos os itens no map levando em conta os predecessores
   * com suporte completo a FS / SS / FF / SF e Lags.
   * Retorna true se algum item foi modificado (para convergência do loop).
   */
  const propagateDeps = (itemsMap: Map<string, ItemEap>, projStart: string): boolean => {
    let changed = false;
    let iterations = 0;
    let anyChange = true;
    while (anyChange && iterations < 100) {
      anyChange = false;
      iterations++;

      // Atualiza datas das tarefas agrupadoras antes de checar dependências
      rollupSummaries(itemsMap, projStart);

      itemsMap.forEach(item => {
        if (!item.predecessores?.length) return;
        let maxReqStart: string | null = null;
        item.predecessores.forEach(predRaw => {
          const { code, type, lag } = parsePredecessor(predRaw);
          const pred = itemsMap.get(code);
          if (!pred) return;
          const predStart = pred.data_inicio ?? pred.data_execucao ?? projStart;
          const predEnd = addDays(predStart, Math.max(1, pred.duracao_dias) - 1);
          const itemDur = Math.max(1, item.duracao_dias);
          let reqStart: string;
          if (type === 'FS') reqStart = addDays(predEnd, 1 + lag);
          else if (type === 'SS') reqStart = addDays(predStart, lag);
          else if (type === 'FF') reqStart = addDays(predEnd, lag - itemDur + 1);
          else /* SF */ reqStart = addDays(predStart, lag - itemDur + 1);
          if (!maxReqStart || reqStart > maxReqStart) maxReqStart = reqStart;
        });
        if (maxReqStart) {
          const curr = item.data_inicio ?? item.data_execucao ?? projStart;
          if (curr < maxReqStart) {
            item.data_inicio = maxReqStart;
            item.data_execucao = maxReqStart;
            anyChange = true;
            changed = true;
          }
        }
      });
    }

    rollupSummaries(itemsMap, projStart);
    return changed;
  };

  /**
   * Rollup bottom-up: summary tasks herdam min(start) e max(end) dos filhos.
   */
  const rollupSummaries = (itemsMap: Map<string, ItemEap>, projStart: string) => {
    const validCodes = new Set(itemsMap.keys());
    const getParentCode = (code: string): string | undefined => {
      const parts = code.split('.');
      while (parts.length > 1) {
        parts.pop();
        const c = parts.join('.');
        if (validCodes.has(c)) return c;
      }
    };

    // Agrupar filhos por pai
    const childrenOf = new Map<string, ItemEap[]>();
    itemsMap.forEach((item, code) => {
      const p = getParentCode(code);
      if (p) {
        if (!childrenOf.has(p)) childrenOf.set(p, []);
        childrenOf.get(p)!.push(item);
      }
    });

    // Processar dos mais profundos para raiz
    const byDepthDesc = Array.from(itemsMap.values()).sort(
      (a, b) => b.eap_codigo.split('.').length - a.eap_codigo.split('.').length
    );

    byDepthDesc.forEach(item => {
      const children = childrenOf.get(item.eap_codigo);
      if (!children?.length) return;
      let minStart: string | null = null;
      let maxEnd: string | null = null;
      children.forEach(c => {
        const s = c.data_inicio ?? c.data_execucao ?? projStart;
        const e = addDays(s, Math.max(1, c.duracao_dias) - 1);
        if (!minStart || s < minStart) minStart = s;
        if (!maxEnd || e > maxEnd) maxEnd = e;
      });
      if (minStart && maxEnd) {
        item.data_inicio = minStart;
        item.data_execucao = minStart;
        item.duracao_dias = Math.max(1, diffDays(maxEnd, minStart) + 1);
      }
    });
  };

  // ── 4. Handler do evento update-task do SVAR Gantt ──────────────────────────

  /**
   * Chamado pelo SVAR após qualquer mudança de data/duração em uma tarefa.
   */
  const handleTaskUpdate = (id: string, updatedTask: Partial<ITask>) => {
    const currentItems = rawItemsRef.current;
    const currentProj = selectedProjRef.current;
    const projStart = currentProj?.data_inicio ?? toYMD(new Date());

    const itemsMap = new Map<string, ItemEap>(
      currentItems.map(i => [i.eap_codigo, { ...i }])
    );
    const item = itemsMap.get(id);
    if (!item) return;

    const oldStart = item.data_inicio ?? item.data_execucao ?? projStart;

    // Aplicar a nova start/duration vindas do SVAR ao item
    if (updatedTask.start) {
      const newStart = toYMD(updatedTask.start);
      item.data_inicio = newStart;
      item.data_execucao = newStart;

      // Se for uma tarefa agrupadora/sintética, desloca todos os filhos proporcionalmente!
      if (!item.e_analitico) {
        const deltaDays = diffDays(newStart, oldStart);
        if (deltaDays !== 0) {
          itemsMap.forEach(child => {
            if (child.eap_codigo.startsWith(id + '.')) {
              const childStart = child.data_inicio ?? child.data_execucao ?? projStart;
              const shifted = addDays(childStart, deltaDays);
              child.data_inicio = shifted;
              child.data_execucao = shifted;
            }
          });
        }
      }
    }

    if (updatedTask.duration != null) {
      item.duracao_dias = Math.max(1, updatedTask.duration);
    } else if (updatedTask.start && updatedTask.end) {
      const s = toYMD(updatedTask.start);
      const e = toYMD(updatedTask.end);
      item.duracao_dias = Math.max(1, diffDays(e, s) + 1);
    }

    // Rollup das tarefas sintéticas primeiro
    rollupSummaries(itemsMap, projStart);

    // Propagar dependências para os sucessores
    propagateDeps(itemsMap, projStart);

    const updatedList = Array.from(itemsMap.values());

    // Registrar alteração pendente (por ID do item_eap no banco)
    itemsMap.forEach(it => {
      if (it.item_eap_id) {
        pendingItemsRef.current.set(it.item_eap_id, it);
      }
    });

    // Atualização otimista na UI
    const proj = selectedProjRef.current;
    const { ganttTasks, ganttLinks } = buildGanttData(updatedList, proj?.data_inicio);
    setRawItems(updatedList);
    setTasks(ganttTasks);
    setLinks(ganttLinks);
    setHasPendingChanges(true);
  };

  // ── 5. Salvar / Descartar alterações pendentes ──────────────────────────────

  const savePendingChanges = async () => {
    if (!hasPendingChanges || saving) return;
    setSaving(true);
    try {
      const updates = Array.from(pendingItemsRef.current.values()) as ItemEap[];

      // Ordena para salvar itens mais profundos (analíticos) primeiro, depois agrupadores
      const sortedUpdates = [...updates].sort((a, b) => {
        const depthA = a.eap_codigo.split('.').length;
        const depthB = b.eap_codigo.split('.').length;
        if (depthA !== depthB) return depthB - depthA;
        return a.eap_codigo.localeCompare(b.eap_codigo);
      });

      for (const item of sortedUpdates) {
        if (!item.item_eap_id) continue;
        await supabase.from('itens_eap').update({
          data_inicio: item.data_inicio ?? item.data_execucao,
          data_execucao: item.data_execucao ?? item.data_inicio,
          duracao_dias: item.duracao_dias,
        }).eq('id', item.item_eap_id);
      }
      pendingItemsRef.current = new Map();
      setHasPendingChanges(false);
      alert('Cronograma salvo com sucesso!');
      fetchEapItems(selectedProjetoId);
    } catch (err) {
      console.error('[CronogramaExecutivoView] save error:', err);
      alert('Erro ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const discardPendingChanges = () => {
    if (!hasPendingChanges) return;
    if (!confirm('Descartar todas as alterações não salvas?')) return;
    pendingItemsRef.current = new Map();
    fetchEapItems(selectedProjetoId);
  };

  // ── 6. Atualização de data de início do projeto ─────────────────────────────

  const updateProjetoDataInicio = async (newDate: string) => {
    try {
      await supabase.from('projetos').update({ data_inicio: newDate }).eq('id', selectedProjetoId);
      setProjetos(prev => prev.map(p => p.id === selectedProjetoId ? { ...p, data_inicio: newDate } : p));
      fetchEapItems(selectedProjetoId);
    } catch {
      alert('Erro ao salvar data de início do projeto');
    }
  };

  // ── 7. Exportação ───────────────────────────────────────────────────────────

  const handleExport = async (format: 'xlsx' | 'xml') => {
    if (!selectedProjetoId) return;
    try {
      const token = authSession?.idToken;
      const res = await fetch(`/api/cronograma/${selectedProjetoId}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `cronograma_${selectedProjetoId}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Falha ao exportar o arquivo.');
    }
  };

  // ── 8. Inicialização da API do SVAR Gantt ───────────────────────────────────

  /**
   * `init` é chamado uma única vez pelo SVAR Gantt ao montar o componente,
   * passando o objeto `api`. Aqui registramos TODOS os listeners de eventos.
   *
   * Usando `api.on` para reação pós-processamento e `api.intercept` para
   * poder cancelar ou transformar ações antes que o SVAR as execute.
   */
  const handleGanttInit = (api: IApi) => {
    // ── Atualização de tarefa (arrastar, redimensionar, editar inline) ─────────
    // O SVAR dispara: { id: TID, task: Partial<ITask>, inProgress?: boolean }
    // `inProgress: true` → durante o arrastar (intermediário), `false` → solto
    api.on('update-task', (ev: any) => {
      // Ignorar eventos intermediários durante o arrastar para não sobrecarregar
      if (ev.inProgress) return;
      const { id, task } = ev;
      if (!id || !task) return;
      handleTaskUpdate(String(id), task);
    });

    // ── Adição de link de dependência ─────────────────────────────────────────
    // O SVAR dispara: { link: Partial<ILink> }
    api.on('add-link', async (ev: any) => {
      const link: Partial<ILink> = ev.link ?? ev;
      if (!link.source || !link.target) return;

      const items = rawItemsRef.current;
      const targetItem = items.find(i => i.eap_codigo === String(link.target));
      if (!targetItem?.item_eap_id) return;

      const pmType = SVAR_TO_PM[String(link.type)] ?? 'FS';
      const lag = link.lag ?? 0;
      const lagStr = lag > 0 ? `+${lag}` : lag < 0 ? String(lag) : '';
      // Para FS sem lag, omitir o tipo (retrocompatível com o banco)
      const predStr = pmType === 'FS' && !lag
        ? String(link.source)
        : `${link.source}${pmType}${lagStr}`;

      const currentPreds = new Set(targetItem.predecessores ?? []);
      currentPreds.add(predStr);
      try {
        await supabase.from('itens_eap')
          .update({ predecessores: Array.from(currentPreds) })
          .eq('id', targetItem.item_eap_id);
        fetchEapItems(selectedProjetoId);
      } catch (err) {
        console.error('[CronogramaExecutivoView] add-link error:', err);
      }
    });

    // ── Remoção de link de dependência ────────────────────────────────────────
    // O SVAR dispara: { id: TID } onde id é o id do link
    // O formato dos nossos link ids: "lnk_{source}_{target}_{idx}" (underscores)
    api.on('delete-link', async (ev: any) => {
      const linkId = String(ev.id ?? '');
      if (!linkId.startsWith('lnk_')) return;
      // Extrai source e target com split em _ (máximo 4 partes: lnk, src, tgt, idx)
      const withoutPrefix = linkId.slice(4); // remove 'lnk_'
      // O formato é src_tgt_idx, onde src e tgt podem conter '.' mas nunca '_'
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      const srcTgt = withoutPrefix.slice(0, lastUnderscore);  // "src_tgt"
      const midUnderscore = srcTgt.indexOf('_');
      const src = srcTgt.slice(0, midUnderscore);
      const tgt = srcTgt.slice(midUnderscore + 1);
      if (!src || !tgt) return;
      const items = rawItemsRef.current;
      const targetItem = items.find(i => i.eap_codigo === tgt);
      if (!targetItem?.item_eap_id) return;
      const updatedPreds = (targetItem.predecessores ?? []).filter(
        p => parsePredecessor(p).code !== src
      );
      try {
        await supabase.from('itens_eap')
          .update({ predecessores: updatedPreds })
          .eq('id', targetItem.item_eap_id);
        fetchEapItems(selectedProjetoId);
      } catch (err) {
        console.error('[CronogramaExecutivoView] delete-link error:', err);
      }
    });

    // ── Exclusão de tarefa ────────────────────────────────────────────────────
    // O SVAR dispara: { id: TID }
    api.on('delete-task', async (ev: any) => {
      const taskId = String(ev.id ?? '');
      const items = rawItemsRef.current;
      const item = items.find(i => i.eap_codigo === taskId);
      if (!item?.item_eap_id) return;
      try {
        await supabase.from('itens_eap').delete().eq('id', item.item_eap_id);
        fetchEapItems(selectedProjetoId);
      } catch (err) {
        console.error('[CronogramaExecutivoView] delete-task error:', err);
      }
    });
  };

  // ── 9. Configuração das colunas do grid ─────────────────────────────────────

  // Colunas do grid
  // O id 'id' corresponde ao eap_codigo do banco, garantindo que a EAP seja a primeira coluna.
  // O id 'text' é o campo nativo do SVAR (ITask.text) para o nome da tarefa.
  const columns = [
    { id: 'id',       header: 'EAP',            width: 80,  resize: true },
    { id: 'text',     header: 'Nome da Tarefa', width: 260, resize: true },
    { id: 'start',    header: 'Início',         width: 100, align: 'center' as const },
    { id: 'duration', header: 'Duração (d)',    width: 85,  align: 'center' as const },
    { id: 'progress', header: '% Exec.',        width: 70,  align: 'center' as const },
  ];

  // ── 10. Marcador de "hoje" ───────────────────────────────────────────────────

  const todayMarker = [{ start: new Date(), text: 'Hoje', css: 'gantt-today-marker' }];

  // ── 11. Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#005daa]/10 to-transparent rounded-bl-full -z-10" />
        <div>
          <h2 className="text-2xl font-bold text-[#005daa] tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px]">calendar_month</span>
            Cronograma Executivo
          </h2>
          <p className="text-sm text-[#404753] mt-1 font-medium">
            Visualização interativa e gestão de prazos com Gráfico de Gantt (SVAR).
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {hasPendingChanges && (
            <>
              <button
                onClick={discardPendingChanges}
                disabled={saving}
                className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-3.5 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                Descartar
              </button>
              <button
                onClick={savePendingChanges}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-md shadow-emerald-600/30 font-bold text-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">{saving ? 'sync' : 'save'}</span>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
                <span className="bg-emerald-800/60 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  Pendente
                </span>
              </button>
            </>
          )}

          {selectedProjetoId && (
            <button
              onClick={() => setIsCadastroEtapaOpen(true)}
              className="flex items-center gap-2 bg-[#005daa] text-white px-4 py-2 rounded-lg shadow-md shadow-[#005daa]/20 hover:bg-[#004a88] transition-colors font-bold text-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Nova Etapa
            </button>
          )}

          <div className="relative group">
            <button className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-md hover:bg-slate-900 transition-colors font-bold text-sm cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Exportar
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#c0c7d6] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f2f4f6] text-[#191c1e] font-medium border-b border-[#f2f4f6]">
                Excel (.xlsx)
              </button>
              <button onClick={() => handleExport('xml')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f2f4f6] text-[#191c1e] font-medium">
                MS Project (.xml)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner de alterações pendentes ── */}
      {hasPendingChanges && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-[24px]">warning</span>
            <div>
              <p className="text-sm font-bold text-amber-900">Alterações pendentes no cronograma!</p>
              <p className="text-xs text-amber-700 font-medium">
                Clique em "Salvar Alterações" para gravar no banco de dados.
              </p>
            </div>
          </div>
          <button
            onClick={savePendingChanges}
            disabled={saving}
            className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-md shadow-xs cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">{saving ? 'sync' : 'save'}</span>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      {/* ── Seletor de projeto e data de início ── */}
      <div className="flex flex-wrap gap-4 bg-white p-5 rounded-xl shadow-xs border border-[#e1e2e8]">
        <div className="flex-1 min-w-[300px]">
          <label className="block text-sm font-bold text-[#191c1e] mb-2 uppercase tracking-wide">
            Projeto Selecionado
          </label>
          <select
            value={selectedProjetoId}
            onChange={e => setSelectedProjetoId(e.target.value)}
            className="w-full bg-[#f8fafc] border border-[#c0c7d6] text-[#191c1e] font-bold text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none transition-all cursor-pointer"
          >
            {projetos.length === 0 && <option value="">Nenhum projeto encontrado</option>}
            {projetos.map(p => (
              <option key={p.id} value={p.id}>
                {p.codigo_contrato || p.tenant_id} – {p.nome_projeto}
              </option>
            ))}
          </select>
        </div>

        {selectedProj && (
          <div className="w-[200px]">
            <label className="block text-sm font-bold text-[#191c1e] mb-2 uppercase tracking-wide">
              Início do Projeto
            </label>
            <input
              type="date"
              value={selectedProj.data_inicio || ''}
              onChange={e => updateProjetoDataInicio(e.target.value)}
              className="w-full bg-white border border-[#c0c7d6] text-[#191c1e] text-sm font-medium rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#005daa]/20 outline-none transition-all"
            />
          </div>
        )}
      </div>

      {/* ── Área do SVAR Gantt ── */}
      <div className="bg-white rounded-xl shadow-xs border border-[#e1e2e8] overflow-hidden min-h-[650px] w-full">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <span className="material-symbols-outlined animate-spin text-3xl mb-2 block">autorenew</span>
            <p className="font-medium">Carregando cronograma...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[48px] text-slate-300">event_busy</span>
            <p className="text-slate-600 font-medium">Nenhuma etapa cadastrada neste projeto.</p>
            {selectedProjetoId && (
              <button
                onClick={() => setIsCadastroEtapaOpen(true)}
                className="mt-2 flex items-center gap-2 bg-[#005daa] text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-[#004a88] transition-colors font-bold text-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Cadastrar Primeira Etapa
              </button>
            )}
          </div>
        ) : (
          <div className="wx-willow-theme w-full h-[680px]">
            <Gantt
              tasks={tasks}
              links={links}
              columns={columns as any}
              init={handleGanttInit}
              /* ── Flags nativas do SVAR Gantt ── */
              undo={true}            // Ctrl+Z / Ctrl+Y nativos
              zoom={true}            // Ctrl+scroll para zoom
              rollups={true}         // Marcos dos filhos aparecem na barra do pai colapsado
              wbs={false}            // Usando coluna id customizada na primeira posição
              criticalPath={{ type: 'flexible' }}   // Destaca caminho crítico
              markers={todayMarker}  // Linha vertical "Hoje"
              /* ── Hierarquia / collapse automático ── */
              summary={{ autoProgress: true, autoConvert: true }}
              /* ── Unidade de duração e escala ── */
              lengthUnit="day"
              durationUnit="day"
              /* ── Escalas de tempo ── */
              scales={[
                { unit: 'month', step: 1, format: '%F %Y' },
                { unit: 'week',  step: 1, format: 'S%W' },
                { unit: 'day',   step: 1, format: '%d' },
              ]}
              /* ── Largura da célula e altura de linha ── */
              cellWidth={38}
              cellHeight={34}
              /* ── Modo de exibição (grid + chart) ── */
              displayMode="all"
            />
          </div>
        )}
      </div>

      {/* ── Modal de cadastramento de etapa ── */}
      {selectedProjetoId && (
        <CadastroEtapaModal
          isOpen={isCadastroEtapaOpen}
          onClose={() => setIsCadastroEtapaOpen(false)}
          projetoId={selectedProjetoId}
          projetoDataInicio={selectedProj?.data_inicio}
          existingItems={rawItems.map(i => ({
            id: i.item_eap_id || i.id,
            eap_codigo: i.eap_codigo,
            descricao_servico: i.descricao_servico,
            e_analitico: i.e_analitico,
            duracao_dias: i.duracao_dias,
            predecessores: i.predecessores,
            data_execucao: i.data_execucao ?? i.data_inicio ?? undefined,
          }))}
          authSession={authSession}
          onSuccess={() => fetchEapItems(selectedProjetoId)}
        />
      )}
    </div>
  );
};
