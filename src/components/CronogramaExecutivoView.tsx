import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthSession } from '../types';
import { Gantt, ITask, ILink, IApi } from '@svar-ui/react-gantt';
import { CadastroEtapaModal, type EapItemOption } from './CadastroEtapaModal';
import {
  EapEngineItem,
  processUserInteraction,
  InteractionType,
  executeSummaryRollup,
  propagateAutoScheduling,
  calculateLeafFinishDate,
  computeFullSchedule,
  addEngineDays,
  diffEngineDays,
  parsePredecessorString,
  GanttTask,
  GanttLink,
  formatEngineYMD
} from '../utils/cronogramaEngine';
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
  unidade_medida?: string;
  valor_total_contratado?: number;
  valor_desembolsado?: number;
  quantidade_contratada?: number;
  preco_unitario?: number;
  data_inicio_financeiro?: string;
  data_fim_financeiro?: string;
}

interface CronogramaExecutivoViewProps {
  authSession: AuthSession | null;
}

// ─── React Error Boundary para o Componente Gantt ────────────────────────────

interface GanttErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface GanttErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GanttErrorBoundary extends React.Component<GanttErrorBoundaryProps, GanttErrorBoundaryState> {
  constructor(props: GanttErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GanttErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GanttErrorBoundary] erro no Gantt:', error, errorInfo);
  }

  render() {
    const state = (this as any).state as GanttErrorBoundaryState;
    const props = (this as any).props as GanttErrorBoundaryProps;

    if (state?.hasError) {
      return (
        <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-xl space-y-4 m-4">
          <span className="material-symbols-outlined text-[48px] text-rose-500">warning</span>
          <h3 className="text-lg font-bold text-rose-900">Falha ao carregar visualização do Gantt</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto font-mono bg-rose-100 p-3 rounded border border-rose-200 text-left overflow-x-auto">
            {state.error?.message || 'Erro desconhecido'}
          </p>
          <button
            onClick={() => {
              (this as any).setState({ hasError: false, error: null });
              if (props.onReset) props.onReset();
            }}
            className="px-4 py-2 bg-[#005daa] hover:bg-[#004a88] text-white font-bold text-sm rounded-lg shadow-md transition-colors cursor-pointer"
          >
            Recarregar Cronograma
          </button>
        </div>
      );
    }
    return props.children;
  }
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export const CronogramaExecutivoView: React.FC<CronogramaExecutivoViewProps> = ({ authSession }) => {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('');
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [links, setLinks] = useState<GanttLink[]>([]);
  const [rawItems, setRawItems] = useState<ItemEap[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCadastroEtapaOpen, setIsCadastroEtapaOpen] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<EapItemOption | null>(null);
  const [timeScale, setTimeScale] = useState<'month' | 'week' | 'day'>('day');

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

  const buildGanttData = (items: ItemEap[], projStart?: string): { ganttTasks: GanttTask[]; ganttLinks: GanttLink[] } => {
    // Convert to EapEngineItem format
    const engineItems = items.map(i => ({
      id: i.id,
      item_eap_id: i.item_eap_id,
      eap_codigo: i.eap_codigo,
      descricao_servico: i.descricao_servico,
      data_inicio: i.data_inicio || i.data_execucao || projStart || '',
      data_fim: i.data_fim || '',
      duracao_dias: Math.max(1, i.duracao_dias || 1),
      e_analitico: !!i.e_analitico,
      predecessores: i.predecessores || [],
      percentual_executado_financeiro: i.percentual_executado_financeiro || 0
    }));

    const result = computeFullSchedule(engineItems, projStart || formatEngineYMD(new Date()));
    return { ganttTasks: result.ganttTasks, ganttLinks: result.ganttLinks };
  };

  const fetchEapItems = async (projetoId: string) => {
    setLoading(true);
    pendingItemsRef.current = new Map();
    setHasPendingChanges(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || authSession?.idToken;

      const res = await fetch(`/api/itens-eap?projeto_id=${projetoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar itens da EAP.');
      }

      const json = await res.json();
      // Usar preferencialmente rawItems, que possui todos os campos nativos do banco de dados (data_inicio, data_fim, etc)
      const data = json.rawItems && json.rawItems.length > 0 ? json.rawItems : json.items;

      if (data?.length) {
        const items: ItemEap[] = data.map((r: any) => ({
          id: r.id || String(r.eap_codigo), // Use real DB id if available
          item_eap_id: r.id, // Ensure item_eap_id is set to the real row ID
          eap_codigo: String(r.eap_codigo),
          descricao_servico: String(r.descricao_servico || ''),
          data_execucao: r.data_execucao || null,
          duracao_dias: Math.max(1, Number(r.duracao_dias || 1)),
          e_analitico: !!r.e_analitico,
          predecessores: Array.isArray(r.predecessores) ? r.predecessores : [],
          data_inicio: r.data_inicio || null,
          data_fim: r.data_fim || null,
          percentual_executado_financeiro: Number(r.percentual_executado_financeiro || 0),
          unidade_medida: r.unidade_medida,
          valor_total_contratado: r.valor_total_contratado,
          valor_desembolsado: r.valor_desembolsado,
          quantidade_contratada: r.quantidade_contratada,
          preco_unitario: r.preco_unitario,
          data_inicio_financeiro: r.data_inicio_financeiro,
          data_fim_financeiro: r.data_fim_financeiro,
        }));

        const proj = projetos.find(p => p.id === projetoId);
        const projStart = proj?.data_inicio ?? formatEngineYMD(new Date());

        const engineItems = items.map(i => ({
          id: i.id,
          item_eap_id: i.item_eap_id,
          eap_codigo: i.eap_codigo,
          descricao_servico: i.descricao_servico,
          data_inicio: i.data_inicio || i.data_execucao || projStart,
          data_fim: i.data_fim || '',
          duracao_dias: Math.max(1, i.duracao_dias || 1),
          e_analitico: !!i.e_analitico,
          predecessores: i.predecessores || [],
          percentual_executado_financeiro: i.percentual_executado_financeiro || 0
        }));

        const result = computeFullSchedule(engineItems, projStart);
        
        let hasEngineCorrections = false;
        const syncedItems: ItemEap[] = result.syncedItems.map(e => {
          const original = items.find(it => it.id === e.item_eap_id || it.eap_codigo === e.eap_codigo);
          const updatedItem: ItemEap = {
            id: e.id,
            item_eap_id: e.item_eap_id,
            eap_codigo: e.eap_codigo,
            descricao_servico: e.descricao_servico,
            data_inicio: e.data_inicio,
            data_execucao: e.data_inicio,
            data_fim: e.data_fim,
            duracao_dias: e.duracao_dias,
            e_analitico: e.e_analitico,
            predecessores: e.predecessores,
            percentual_executado_financeiro: e.percentual_executado_financeiro,
            unidade_medida: original?.unidade_medida,
            valor_total_contratado: original?.valor_total_contratado,
            valor_desembolsado: original?.valor_desembolsado,
            quantidade_contratada: original?.quantidade_contratada,
            preco_unitario: original?.preco_unitario,
            data_inicio_financeiro: original?.data_inicio_financeiro,
            data_fim_financeiro: original?.data_fim_financeiro,
          };

          if (
            original && 
            (original.data_inicio !== e.data_inicio || 
             original.data_fim !== e.data_fim ||
             original.duracao_dias !== e.duracao_dias)
          ) {
            hasEngineCorrections = true;
            if (e.item_eap_id) {
              pendingItemsRef.current.set(e.item_eap_id, updatedItem);
            }
          }
          return updatedItem;
        });

        if (hasEngineCorrections) {
          setHasPendingChanges(true);
        }

        setRawItems(syncedItems);
        
        const { ganttTasks, ganttLinks } = buildGanttData(syncedItems, projStart);
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

  // ── 4. Handler do evento update-task do SVAR Gantt ──────────────────────────

  /**
   * Chamado pelo SVAR após qualquer mudança de data/duração em uma tarefa.
   * Executa os Passos 5, 6 e 7 do Motor do Cronograma (Auto-Scheduling & Domino Effect).
   */
  const handleTaskUpdate = (id: string, updatedTask: Partial<ITask>) => {
    const currentItems = rawItemsRef.current;
    const currentProj = selectedProjRef.current;
    const projStart = currentProj?.data_inicio ?? formatEngineYMD(new Date());

    const item = currentItems.find(i => i.eap_codigo === id);
    if (!item) return;

    // Passo 5: Mapeamento da Intenção de Interação do Usuário
    let interactionType: InteractionType = 'body_move';
    let newStart: string | undefined;
    let newEnd: string | undefined;
    let newDuration: number | undefined;

    if (updatedTask.start && updatedTask.end) {
      newStart = formatEngineYMD(updatedTask.start);
      // O SVAR Gantt opera com data de término exclusiva. Subtraímos 1 dia para voltar ao nosso formato inclusivo.
      newEnd = formatEngineYMD(new Date(updatedTask.end.getTime() - 86400000));
      const oldStart = item.data_inicio ?? item.data_execucao ?? projStart;
      const oldEnd = item.data_fim ?? addEngineDays(oldStart, Math.max(1, item.duracao_dias || 1) - 1);

      if (newStart !== oldStart && newEnd !== oldEnd) {
        interactionType = 'body_move';
      } else if (newEnd !== oldEnd) {
        interactionType = 'resize_right';
      } else if (newStart !== oldStart) {
        interactionType = 'resize_left';
      }
    } else if (updatedTask.start) {
      newStart = formatEngineYMD(updatedTask.start);
      interactionType = 'body_move';
    } else if (updatedTask.duration != null) {
      newDuration = Math.max(1, updatedTask.duration);
      interactionType = 'resize_right';
    }

    // Adaptar para a interface pura do motor (EapEngineItem)
    const engineItems: EapEngineItem[] = currentItems.map(i => ({
      ...i,
      data_inicio: i.data_inicio ?? i.data_execucao ?? projStart,
      data_fim: i.data_fim ?? addEngineDays(i.data_inicio ?? projStart, Math.max(1, i.duracao_dias || 1) - 1),
    }));

    // Processamento centralizado no Motor do Cronograma
    const { updatedItems: engineResult, affectedItems } = processUserInteraction(
      engineItems,
      { eap_codigo: id, interactionType, newStart, newEnd, newDuration },
      projStart
    );

    // Mapear de volta para a lista do componente
    const updatedList: ItemEap[] = engineResult.map(e => ({
      id: e.id,
      item_eap_id: e.item_eap_id,
      eap_codigo: e.eap_codigo,
      descricao_servico: e.descricao_servico,
      data_inicio: e.data_inicio,
      data_execucao: e.data_inicio,
      data_fim: e.data_fim,
      duracao_dias: e.duracao_dias,
      e_analitico: e.e_analitico,
      predecessores: e.predecessores,
      percentual_executado_financeiro: e.percentual_executado_financeiro,
    }));

    // Registrar apenas os itens afetados para persistência em lote no banco (Passo 9)
    affectedItems.forEach(aff => {
      if (aff.item_eap_id) {
        const fullItem = updatedList.find(it => it.item_eap_id === aff.item_eap_id);
        if (fullItem) {
          pendingItemsRef.current.set(aff.item_eap_id, fullItem);
        }
      }
    });

    // Passo 8: Renderização Reativa no Gráfico
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

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || authSession?.idToken;

      for (const item of sortedUpdates) {
        const targetId = item.item_eap_id || item.id;
        const payload: any = {
          id: targetId,
          projeto_id: selectedProjetoId,
          eap_codigo: item.eap_codigo,
          descricao_servico: item.descricao_servico,
          data_inicio: item.data_inicio ?? item.data_execucao,
          data_execucao: item.data_execucao ?? item.data_inicio,
          duracao_dias: Math.max(1, item.duracao_dias || 1),
          data_fim: item.data_fim || null,
          e_analitico: item.e_analitico,
          predecessores: item.predecessores ?? [],
        };

        // Envia via API backend (/api/itens-eap) com autenticação JWT do usuário
        const res = await fetch('/api/itens-eap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || (json.error && !json.success)) {
          // Fallback direto via Supabase client checando explicitamente o objeto de erro
          console.warn('[savePendingChanges] API POST falhou, executando fallback Supabase direct:', json.error || res.statusText);
          const { error: dbErr } = await supabase.from('itens_eap').update({
            data_inicio: payload.data_inicio,
            data_execucao: payload.data_execucao,
            duracao_dias: payload.duracao_dias,
            data_fim: payload.data_fim,
          }).eq('id', targetId);

          if (dbErr) {
            throw new Error(`Erro ao salvar a etapa ${item.eap_codigo}: ${dbErr.message}`);
          }
        }
      }

      pendingItemsRef.current = new Map();
      setHasPendingChanges(false);
      alert('Cronograma salvo com sucesso!');
      await fetchEapItems(selectedProjetoId);
    } catch (err: any) {
      console.error('[CronogramaExecutivoView] save error:', err);
      alert(`Falha ao salvar as alterações: ${err?.message || err}`);
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

  // ── 9. Inicialização da API do SVAR Gantt ───────────────────────────────────

  /**
   * `init` é chamado uma única vez pelo SVAR Gantt ao montar o componente,
   * passando o objeto `api`. Aqui registramos TODOS os listeners de eventos.
   */
  const handleGanttInit = (api: IApi) => {
    // ── Interceptar e Bloquear Alteração Direta em Tarefas Sumário ────────────
    api.intercept('update-task', (ev: any) => {
      const { id, task } = ev;
      const targetId = String(id || task?.id || '');
      const items = rawItemsRef.current;
      const item = items.find(i => i.eap_codigo === targetId);

      // Bloqueia qualquer tentativa de edição direta em etapas agrupadoras / sumário
      if (item && !item.e_analitico) {
        return false;
      }
    });

    api.intercept('drag-task', (ev: any) => {
      const { id, task } = ev;
      const targetId = String(id || task?.id || '');
      const items = rawItemsRef.current;
      const item = items.find(i => i.eap_codigo === targetId);

      // Bloqueia qualquer tentativa de arraste direto em etapas agrupadoras / sumário
      if (item && !item.e_analitico) {
        return false;
      }
    });

    // ── Atualização de tarefa (arrastar, redimensionar, editar inline) ─────────
    api.on('update-task', (ev: any) => {
      if (ev.inProgress) return;
      const { id, task } = ev;
      if (!id || !task) return;
      handleTaskUpdate(String(id), task);
    });

    // ── Clique na barra: abre popup de edição com os dados da tarefa ──────────
    api.on('select-task', (ev: any) => {
      const taskId = String(ev.id ?? '');
      if (!taskId) return;
      const items = rawItemsRef.current;
      const item = items.find(i => i.eap_codigo === taskId);
      if (!item) return;

      // Mapear para o formato EapItemOption esperado pelo CadastroEtapaModal
      const editItem: EapItemOption = {
        id: item.item_eap_id || item.id,
        eap_codigo: item.eap_codigo,
        descricao_servico: item.descricao_servico,
        e_analitico: item.e_analitico,
        duracao_dias: item.duracao_dias,
        predecessores: item.predecessores,
        data_execucao: item.data_execucao ?? item.data_inicio ?? undefined,
        data_inicio: item.data_inicio ?? undefined,
        data_fim: item.data_fim ?? undefined,
        unidade_medida: item.unidade_medida,
        valor_total_contratado: item.valor_total_contratado,
        valor_desembolsado: item.valor_desembolsado,
        quantidade_contratada: item.quantidade_contratada,
        preco_unitario: item.preco_unitario,
        data_inicio_financeiro: item.data_inicio_financeiro,
        data_fim_financeiro: item.data_fim_financeiro,
      };
      setItemToEdit(editItem);
      setIsCadastroEtapaOpen(true);
    });

    // ── Adição de link de dependência ─────────────────────────────────────────
    api.on('add-link', async (ev: any) => {
      const link: Partial<ILink> = ev.link ?? ev;
      if (!link.source || !link.target) return;

      const items = rawItemsRef.current;
      const targetItem = items.find(i => i.eap_codigo === String(link.target));
      if (!targetItem?.item_eap_id) return;

      const pmType = ({ e2s: 'FS', s2s: 'SS', e2e: 'FF', s2e: 'SF' })[String(link.type)] ?? 'FS';
      const lag = link.lag ?? 0;
      const lagStr = lag > 0 ? `+${lag}` : lag < 0 ? String(lag) : '';
      const predStr = pmType === 'FS' && !lag
        ? String(link.source)
        : `${link.source}${pmType}${lagStr}`;

      const currentPreds = new Set(targetItem.predecessores ?? []);
      currentPreds.add(predStr);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || authSession?.idToken;

        const res = await fetch('/api/itens-eap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            id: targetItem.item_eap_id,
            projeto_id: selectedProjetoId,
            eap_codigo: targetItem.eap_codigo,
            descricao_servico: targetItem.descricao_servico,
            predecessores: Array.from(currentPreds),
          }),
        });

        if (!res.ok) {
          const { error: err } = await supabase.from('itens_eap')
            .update({ predecessores: Array.from(currentPreds) })
            .eq('id', targetItem.item_eap_id);
          if (err) throw err;
        }
        await fetchEapItems(selectedProjetoId);
      } catch (err) {
        console.error('[CronogramaExecutivoView] add-link error:', err);
      }
    });

    // ── Remoção de link de dependência ────────────────────────────────────────
    api.on('delete-link', async (ev: any) => {
      const linkId = String(ev.id ?? '');
      if (!linkId.startsWith('lnk_')) return;
      const withoutPrefix = linkId.slice(4);
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      const srcTgt = withoutPrefix.slice(0, lastUnderscore);
      const midUnderscore = srcTgt.indexOf('_');
      const src = srcTgt.slice(0, midUnderscore);
      const tgt = srcTgt.slice(midUnderscore + 1);
      if (!src || !tgt) return;
      const items = rawItemsRef.current;
      const targetItem = items.find(i => i.eap_codigo === tgt);
      if (!targetItem?.item_eap_id) return;
      const updatedPreds = (targetItem.predecessores ?? []).filter(
        p => parsePredecessorString(p).code !== src
      );
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || authSession?.idToken;

        const res = await fetch('/api/itens-eap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            id: targetItem.item_eap_id,
            projeto_id: selectedProjetoId,
            eap_codigo: targetItem.eap_codigo,
            descricao_servico: targetItem.descricao_servico,
            predecessores: updatedPreds,
          }),
        });

        if (!res.ok) {
          const { error: err } = await supabase.from('itens_eap')
            .update({ predecessores: updatedPreds })
            .eq('id', targetItem.item_eap_id);
          if (err) throw err;
        }
        await fetchEapItems(selectedProjetoId);
      } catch (err) {
        console.error('[CronogramaExecutivoView] delete-link error:', err);
      }
    });

    // ── Exclusão de tarefa ────────────────────────────────────────────────────
    api.on('delete-task', async (ev: any) => {
      const taskId = String(ev.id ?? '');
      const items = rawItemsRef.current;
      const item = items.find(i => i.eap_codigo === taskId);
      if (!item?.item_eap_id) return;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || authSession?.idToken;

        const res = await fetch('/api/itens-eap', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ id: item.item_eap_id }),
        });

        if (!res.ok) {
          const { error: err } = await supabase.from('itens_eap').delete().eq('id', item.item_eap_id);
          if (err) throw err;
        }
        await fetchEapItems(selectedProjetoId);
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

  // ── 10. Marcador de "hoje" e Configuração de Escala ──────────────────────────

  const todayMarker = [{ start: new Date(), text: 'Hoje', css: 'gantt-today-marker' }];

  const ganttScales = useMemo(() => {
    switch (timeScale) {
      case 'month':
        return [
          { unit: 'year', step: 1, format: '%Y' },
          { unit: 'month', step: 1, format: '%F' },
        ];
      case 'week':
        return [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'week', step: 1, format: 'Sem. %W' },
        ];
      case 'day':
      default:
        return [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'week', step: 1, format: 'S%W' },
          { unit: 'day', step: 1, format: '%d' },
        ];
    }
  }, [timeScale]);

  // ── 11. Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#005daa]/10 to-transparent rounded-bl-full -z-10" />
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-[#005daa] tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px]">calendar_month</span>
              Cronograma Executivo
            </h2>
            {selectedProj?.codigo_contrato && (
              <span className="bg-white text-[#005daa] border border-[#005daa]/30 px-3 py-1 rounded-full font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                CONTRATO {selectedProj.codigo_contrato}
              </span>
            )}
          </div>
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

          {/* ── Seletor de Escala ── */}
          <div className="flex items-center bg-white border border-[#c0c7d6] rounded-lg overflow-hidden shadow-sm h-9">
            {(['month', 'week', 'day'] as const).map(scale => (
              <button
                key={scale}
                onClick={() => setTimeScale(scale)}
                className={`px-3 h-full text-xs font-bold uppercase tracking-wider transition-colors border-r last:border-r-0 border-[#c0c7d6] ${
                  timeScale === scale
                    ? 'bg-[#005daa] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {scale === 'month' ? 'Mês' : scale === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>



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
              <p className="text-sm text-slate-500 mt-4">
                Para começar, acesse a aba <span className="font-bold">EAP do Projeto</span> para cadastrar ou importar etapas.
              </p>
            )}
          </div>
        ) : (
          <div className="wx-willow-theme w-full h-[680px]">
            <GanttErrorBoundary onReset={() => fetchEapItems(selectedProjetoId)}>
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
                scales={ganttScales}
                /* ── Largura da célula e altura de linha ── */
                cellWidth={38}
                cellHeight={34}
                /* ── Modo de exibição (grid + chart) ── */
                displayMode="all"
              />
            </GanttErrorBoundary>
          </div>
        )}
      </div>



      {/* ── Modal de cadastramento de etapa ── */}
      {selectedProjetoId && (
        <CadastroEtapaModal
          isOpen={isCadastroEtapaOpen}
          onClose={() => { setIsCadastroEtapaOpen(false); setItemToEdit(null); }}
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
          itemToEdit={itemToEdit}
          authSession={authSession}
          onSuccess={() => fetchEapItems(selectedProjetoId)}
        />
      )}
    </div>
  );
};
