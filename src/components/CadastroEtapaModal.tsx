import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EapItemOption {
  id?: string;
  eap_codigo: string;
  descricao_servico: string;
  e_analitico?: boolean;
  duracao_dias?: number;
  predecessores?: string[];
  unidade_medida?: string;
  valor_total_contratado?: number;
  valor_desembolsado?: number;
  data_execucao?: string;
  data_inicio?: string;
  data_fim?: string;
}

/** Estrutura interna de um predecessor com tipo e lag */
interface PredEntry {
  code: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number; // dias (negativo = lead)
}

interface CadastroEtapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  projetoId: string;
  projetoDataInicio?: string;
  existingItems: EapItemOption[];
  itemToEdit?: EapItemOption | null;
  authSession?: any;
  onSuccess: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEP_LABELS: Record<string, string> = {
  FS: 'FS – Fim → Início',
  SS: 'SS – Início → Início',
  FF: 'FF – Fim → Fim',
  SF: 'SF – Início → Fim',
};

const DEP_COLORS: Record<string, string> = {
  FS: 'bg-blue-100 text-blue-800 border-blue-200',
  SS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  FF: 'bg-amber-100 text-amber-800 border-amber-200',
  SF: 'bg-purple-100 text-purple-800 border-purple-200',
};

/** Converte "1.1.1FS+2" → PredEntry */
function parsePredStr(s: string): PredEntry {
  const m = s.match(/^([A-Za-z0-9.]+?)(?:(FS|SS|FF|SF))?(?:([+-]\d+))?$/);
  if (!m) return { code: s, type: 'FS', lag: 0 };
  return {
    code: m[1],
    type: (m[2] as PredEntry['type']) || 'FS',
    lag: m[3] ? parseInt(m[3], 10) : 0,
  };
}

/** Converte PredEntry → "1.1.1FS+2" (omite tipo/lag quando padrão FS sem lag) */
function predEntryToStr(p: PredEntry): string {
  const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? String(p.lag) : '';
  if (p.type === 'FS' && !p.lag) return p.code;
  return `${p.code}${p.type}${lagStr}`;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export const CadastroEtapaModal: React.FC<CadastroEtapaModalProps> = ({
  isOpen,
  onClose,
  projetoId,
  projetoDataInicio,
  existingItems,
  itemToEdit,
  authSession,
  onSuccess,
}) => {
  // ── Estado do formulário ───────────────────────────────────────────────────
  const [parentCode, setParentCode] = useState<string>('root');
  const [eapCodigo, setEapCodigo] = useState<string>('');
  const [isManualEap, setIsManualEap] = useState<boolean>(false);
  const [descricaoServico, setDescricaoServico] = useState<string>('');
  const [eAnalitico, setEAnalitico] = useState<boolean>(false);
  const [unidadeMedida, setUnidadeMedida] = useState<string>('m²');
  const [duracaoDias, setDuracaoDias] = useState<number>(1);
  const [quantidadeContratada, setQuantidadeContratada] = useState<string>('1');
  const [precoUnitario, setPrecoUnitario] = useState<string>('0');
  const [valorTotalContratado, setValorTotalContratado] = useState<string>('0');
  const [valorDesembolsado, setValorDesembolsado] = useState<string>('0');
  const [dataExecucao, setDataExecucao] = useState<string>('');

  /** Lista de predecessores com tipo e lag */
  const [predEntries, setPredEntries] = useState<PredEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Constantes ─────────────────────────────────────────────────────────────
  const unidadesComuns = ['m²', 'm³', 'un', 'vb', 'kg', 'h', 'm', 'cj', 'gl', 'tx', 'sc', 'm.p.'];

  // ── Opções calculadas ──────────────────────────────────────────────────────

  const parentOptions = useMemo(() => {
    return existingItems
      .filter(i => {
        if (itemToEdit && (i.eap_codigo === itemToEdit.eap_codigo || i.eap_codigo.startsWith(itemToEdit.eap_codigo + '.'))) return false;
        return !i.e_analitico && i.eap_codigo.split('.').length < 4;
      })
      .sort((a, b) => a.eap_codigo.localeCompare(b.eap_codigo, undefined, { numeric: true }));
  }, [existingItems, itemToEdit]);

  const predecessorOptions = useMemo(() => {
    return existingItems
      .filter(i => {
        if (itemToEdit && i.eap_codigo === itemToEdit.eap_codigo) return false;
        return true;
      })
      .sort((a, b) => a.eap_codigo.localeCompare(b.eap_codigo, undefined, { numeric: true }));
  }, [existingItems, itemToEdit]);

  // ── Sugestão de código EAP ────────────────────────────────────────────────

  const calculateSuggestedEap = (pCode: string): string => {
    if (pCode === 'root') {
      const nums = existingItems.map(i => i.eap_codigo.split('.')[0]).filter(s => /^\d+$/.test(s)).map(Number);
      return String(nums.length > 0 ? Math.max(...nums) + 1 : 1);
    }
    const prefix = pCode + '.';
    const children = existingItems.filter(i => i.eap_codigo.startsWith(prefix) && i.eap_codigo.split('.').length === pCode.split('.').length + 1);
    const nums = children.map(i => Number(i.eap_codigo.split('.').pop())).filter(n => !isNaN(n));
    return `${pCode}.${nums.length > 0 ? Math.max(...nums) + 1 : 1}`;
  };

  // ── Inicialização do formulário ────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);

    if (itemToEdit) {
      const parts = itemToEdit.eap_codigo.split('.');
      const pCode = parts.length > 1 ? parts.slice(0, -1).join('.') : 'root';
      setParentCode(pCode);
      setEapCodigo(itemToEdit.eap_codigo);
      setIsManualEap(true);
      setDescricaoServico(itemToEdit.descricao_servico || '');
      setEAnalitico(!!itemToEdit.e_analitico);
      setUnidadeMedida(itemToEdit.unidade_medida || 'm²');
      setDuracaoDias(itemToEdit.duracao_dias || 1);
      setValorTotalContratado(String(itemToEdit.valor_total_contratado || 0));
      setValorDesembolsado(String(itemToEdit.valor_desembolsado || 0));
      setDataExecucao(itemToEdit.data_execucao || itemToEdit.data_inicio || '');
      setQuantidadeContratada('1');
      setPrecoUnitario(String(itemToEdit.valor_total_contratado || 0));
      // Parsear predecessores existentes
      setPredEntries(
        (itemToEdit.predecessores ?? []).map(parsePredStr)
      );
    } else {
      setParentCode('root');
      setEapCodigo(calculateSuggestedEap('root'));
      setIsManualEap(false);
      setDescricaoServico('');
      setEAnalitico(false);
      setUnidadeMedida('m²');
      setDuracaoDias(1);
      setQuantidadeContratada('1');
      setPrecoUnitario('0');
      setValorTotalContratado('0');
      setValorDesembolsado('0');
      setDataExecucao(projetoDataInicio || new Date().toISOString().split('T')[0]);
      setPredEntries([]);
    }
  }, [isOpen, itemToEdit]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleParentChange = (newPCode: string) => {
    setParentCode(newPCode);
    if (!itemToEdit && !isManualEap) {
      setEapCodigo(calculateSuggestedEap(newPCode));
      // Se o pai for nível 2 ou mais (ex: 2.1), o filho será nível 3+, então default é Serviço Executável
      if (newPCode !== 'root' && newPCode.split('.').length >= 2) setEAnalitico(true);
      else setEAnalitico(false);
    }
  };

  const handleQtdPriceChange = (qtdStr: string, priceStr: string) => {
    setQuantidadeContratada(qtdStr);
    setPrecoUnitario(priceStr);
    setValorTotalContratado(((parseFloat(qtdStr) || 0) * (parseFloat(priceStr) || 0)).toFixed(2));
  };

  // ── Gestão de predecessoras ────────────────────────────────────────────────

  const isPredSelected = (code: string) => predEntries.some(p => p.code === code);

  const togglePredecessor = (code: string) => {
    if (isPredSelected(code)) {
      setPredEntries(prev => prev.filter(p => p.code !== code));
    } else {
      setPredEntries(prev => [...prev, { code, type: 'FS', lag: 0 }]);
    }
  };

  const updatePredType = (code: string, type: PredEntry['type']) => {
    setPredEntries(prev => prev.map(p => p.code === code ? { ...p, type } : p));
  };

  const updatePredLag = (code: string, lag: number) => {
    setPredEntries(prev => prev.map(p => p.code === code ? { ...p, lag } : p));
  };

  // ── Submissão ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!eapCodigo.trim() || !descricaoServico.trim()) {
      setErrorMessage('Código EAP e Descrição/Nome do Serviço são obrigatórios.');
      return;
    }
    if (eAnalitico && !unidadeMedida.trim()) {
      setErrorMessage('Unidade de medida é obrigatória para serviços executáveis/analíticos.');
      return;
    }

    const parts = eapCodigo.split('.');
    const calculatedPai = parts.length > 1 ? parts.slice(0, -1).join('.') : null;

    // Serializar predecessoras para o formato "1.1.1FS+2"
    const predecessores = predEntries.map(predEntryToStr);

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const payload: any = {
        id: itemToEdit?.id,
        projeto_id: projetoId,
        eap_codigo: eapCodigo.trim(),
        eap_pai_codigo: calculatedPai,
        descricao_servico: descricaoServico.trim(),
        unidade_medida: eAnalitico ? unidadeMedida.trim() : null,
        preco_unitario: eAnalitico ? parseFloat(precoUnitario) || 0 : 0,
        quantidade_contratada: eAnalitico ? parseFloat(quantidadeContratada) || 1 : 0,
        valor_total_contratado: eAnalitico ? parseFloat(valorTotalContratado) || 0 : 0,
        valor_desembolsado: eAnalitico ? parseFloat(valorDesembolsado) || 0 : 0,
        e_analitico: eAnalitico,
        duracao_dias: Math.max(1, Number(duracaoDias || 1)),
        predecessores,
        data_execucao: dataExecucao || null,
      };

      const res = await fetch('/api/itens-eap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && (json.success || json.id || json.item_eap_id)) {
        onSuccess();
        onClose();
      } else {
        // Fallback direto via Supabase Client
        console.warn('[CadastroEtapaModal] Fallback para Supabase direto:', json.error || res.statusText);
        const upsertData: any = {
          projeto_id: projetoId,
          eap_codigo: eapCodigo.trim(),
          eap_pai_codigo: calculatedPai,
          descricao_servico: descricaoServico.trim(),
          unidade_medida: eAnalitico ? unidadeMedida.trim() : null,
          preco_unitario: eAnalitico ? parseFloat(precoUnitario) || 0 : 0,
          quantidade_contratada: eAnalitico ? parseFloat(quantidadeContratada) || 1 : 0,
          valor_total_contratado: eAnalitico ? parseFloat(valorTotalContratado) || 0 : 0,
          valor_desembolsado: eAnalitico ? parseFloat(valorDesembolsado) || 0 : 0,
          e_analitico: eAnalitico,
          duracao_dias: Math.max(1, Number(duracaoDias || 1)),
          predecessores,
          data_inicio: dataExecucao || null,
        };
        if (itemToEdit?.id) upsertData.id = itemToEdit.id;
        const { error: dbError } = await supabase.from('itens_eap').upsert(upsertData);
        if (dbError) throw dbError;
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      const msg = typeof err === 'object' ? (err.message || err.error_description || JSON.stringify(err)) : String(err);
      setErrorMessage(`Erro ao salvar etapa: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">

        {/* ── Cabeçalho ── */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#005daa] to-[#004a88] text-white flex items-center justify-between shadow-md flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <span className="material-symbols-outlined text-[24px]">account_tree</span>
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">
                {itemToEdit ? `Editar Etapa: ${itemToEdit.eap_codigo}` : 'Cadastrar Nova Etapa (EAP)'}
              </h3>
              <p className="text-xs text-blue-100 font-medium">
                Estrutura Analítica do Projeto e Gestão Executiva
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* ── Corpo do formulário com scroll ── */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">

          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {errorMessage}
            </div>
          )}

          {/* ── Seleção do pai & código EAP ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Etapa Pai (Agrupador)
              </label>
              <select
                value={parentCode}
                onChange={(e) => handleParentChange(e.target.value)}
                disabled={!!itemToEdit}
                className="w-full bg-white border border-slate-300 text-slate-900 font-medium text-sm rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none transition-all cursor-pointer disabled:bg-slate-100 disabled:opacity-75"
              >
                <option value="root">Nível 1 (Macroetapa Raiz)</option>
                {parentOptions.map(p => (
                  <option key={p.eap_codigo} value={p.eap_codigo}>
                    {p.eap_codigo} – {p.descricao_servico}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Código EAP <span className="text-red-500">*</span>
                </label>
                <button type="button" onClick={() => setIsManualEap(!isManualEap)} className="text-[11px] text-[#005daa] hover:underline font-bold">
                  {isManualEap ? 'Auto Sugestão' : 'Editar Manual'}
                </button>
              </div>
              <input
                type="text"
                value={eapCodigo}
                onChange={(e) => { setEapCodigo(e.target.value); setIsManualEap(true); }}
                placeholder="Ex: 1.1.1"
                required
                className="w-full bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none transition-all"
              />
            </div>
          </div>

          {/* ── Descrição & tipo ── */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Descrição / Nome do Serviço <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                placeholder="Ex: Armação e Concretagem de Vigas"
                required
                className="w-full bg-white border border-slate-300 font-medium text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="block text-sm font-bold text-slate-900">É um Serviço Executável (Analítico)?</span>
                <span className="text-xs text-slate-500">
                  {eAnalitico ? 'Etapa executável (Nível 3) com duração, quantidades e valores.' : 'Agrupador de etapas (Níveis 1 ou 2).'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={eAnalitico} onChange={(e) => setEAnalitico(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#005daa]"></div>
              </label>
            </div>
          </div>

          {/* ── Cronograma: duração e data ── */}
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-[#005daa] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              Prazos e Dependências (Cronograma PMO)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  Duração estimada (Dias)
                  {!eAnalitico && <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Automático</span>}
                </label>
                <input
                  type="number"
                  min="1"
                  value={duracaoDias}
                  onChange={(e) => setDuracaoDias(parseInt(e.target.value) || 1)}
                  disabled={!eAnalitico}
                  className={`w-full border font-bold text-sm rounded-lg px-3.5 py-2.5 transition-all outline-none 
                    ${!eAnalitico 
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa]'
                    }`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Data de Início Prevista
                </label>
                <input
                  type="date"
                  value={dataExecucao}
                  onChange={(e) => setDataExecucao(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-sm font-medium text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none transition-all"
                />
              </div>
            </div>

            {/* ── Seletor de predecessoras com tipo e lag ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">link</span>
                  Dependências (Predecessoras)
                </label>
                {predEntries.length > 0 && (
                  <span className="text-[11px] bg-[#005daa] text-white px-2 py-0.5 rounded-full font-bold">
                    {predEntries.length} definida{predEntries.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {predecessorOptions.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  Nenhuma outra etapa cadastrada para definir predecessora.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Lista de etapas para selecionar */}
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {predecessorOptions.map(p => {
                      const selected = isPredSelected(p.eap_codigo);
                      return (
                        <div
                          key={p.eap_codigo}
                          onClick={() => togglePredecessor(p.eap_codigo)}
                          className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors select-none ${
                            selected
                              ? 'bg-blue-50 text-[#005daa]'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                              selected ? 'bg-[#005daa] border-[#005daa]' : 'border-slate-300 bg-white'
                            }`}>
                              {selected && (
                                <span className="material-symbols-outlined text-white" style={{ fontSize: 12, lineHeight: 1 }}>check</span>
                              )}
                            </div>
                            <span className="font-mono font-bold">{p.eap_codigo}</span>
                            <span className="truncate max-w-[220px] text-slate-600">{p.descricao_servico}</span>
                          </div>
                          {p.duracao_dias && (
                            <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 ml-2">{p.duracao_dias}d</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Configuração de tipo e lag para cada predecessora selecionada */}
                  {predEntries.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                        Configure o tipo e lag de cada dependência:
                      </p>
                      {predEntries.map(entry => {
                        const opt = predecessorOptions.find(p => p.eap_codigo === entry.code);
                        return (
                          <div key={entry.code} className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap items-center gap-3">
                            {/* Badge do tipo atual */}
                            <span className={`text-[11px] px-2 py-0.5 rounded border font-bold font-mono ${DEP_COLORS[entry.type]}`}>
                              {entry.type}
                            </span>

                            {/* Código e nome */}
                            <div className="flex-1 min-w-0">
                              <span className="font-mono font-bold text-xs text-slate-900">{entry.code}</span>
                              {opt && (
                                <span className="text-[11px] text-slate-500 ml-1.5 truncate">{opt.descricao_servico}</span>
                              )}
                            </div>

                            {/* Tipo de dependência */}
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-slate-500 font-medium">Tipo:</span>
                              <select
                                value={entry.type}
                                onChange={(e) => updatePredType(entry.code, e.target.value as PredEntry['type'])}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-bold border border-slate-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none cursor-pointer"
                              >
                                {Object.entries(DEP_LABELS).map(([k, label]) => (
                                  <option key={k} value={k}>{label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Lag */}
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-slate-500 font-medium">Lag (d):</span>
                              <input
                                type="number"
                                value={entry.lag}
                                onChange={(e) => updatePredLag(entry.code, parseInt(e.target.value) || 0)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-16 text-xs font-bold font-mono border border-slate-300 rounded-md px-2 py-1 text-center bg-white focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none"
                                title="Positivo = atraso, Negativo = avanço (lead)"
                              />
                            </div>

                            {/* Preview da string gerada */}
                            <div className="ml-auto">
                              <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                                {predEntryToStr(entry)}
                              </span>
                            </div>

                            {/* Remover */}
                            <button
                              type="button"
                              onClick={() => togglePredecessor(entry.code)}
                              className="text-red-400 hover:text-red-600 transition-colors cursor-pointer flex-shrink-0"
                              title="Remover dependência"
                            >
                              <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                            </button>
                          </div>
                        );
                      })}

                      {/* Legenda dos tipos */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(DEP_LABELS).map(([k, label]) => (
                          <span key={k} className={`text-[10px] px-2 py-0.5 rounded border font-medium ${DEP_COLORS[k]}`}>
                            {label}
                          </span>
                        ))}
                        <span className="text-[10px] text-slate-400 font-medium self-center">
                          · Lag negativo = avanço (lead)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Campos financeiros (apenas analítico) ── */}
          {eAnalitico && (
            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">payments</span>
                Quantitativos e Orçamento
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Unidade de Medida <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="unidades-list"
                    value={unidadeMedida}
                    onChange={(e) => setUnidadeMedida(e.target.value)}
                    placeholder="Ex: m²"
                    className="w-full bg-white border border-slate-300 font-bold text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
                  />
                  <datalist id="unidades-list">
                    {unidadesComuns.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Qtd. Contratada
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={quantidadeContratada}
                    onChange={(e) => handleQtdPriceChange(e.target.value, precoUnitario)}
                    className="w-full bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Preço Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precoUnitario}
                    onChange={(e) => handleQtdPriceChange(quantidadeContratada, e.target.value)}
                    className="w-full bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Valor Total Contratado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorTotalContratado}
                    onChange={(e) => setValorTotalContratado(e.target.value)}
                    className="w-full bg-emerald-100/50 border border-emerald-300 font-mono font-bold text-sm text-emerald-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Valor Desembolsado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorDesembolsado}
                    onChange={(e) => setValorDesembolsado(e.target.value)}
                    className="w-full bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Rodapé e botões ── */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="text-xs text-slate-400">
              {predEntries.length > 0 && (
                <span>
                  Dependências: {predEntries.map(predEntryToStr).join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#005daa] hover:bg-[#004a88] text-white font-bold text-sm rounded-xl shadow-md shadow-[#005daa]/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    {itemToEdit ? 'Atualizar Etapa' : 'Cadastrar Etapa'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
