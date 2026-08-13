import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

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

export const CadastroEtapaModal: React.FC<CadastroEtapaModalProps> = ({
  isOpen,
  onClose,
  projetoId,
  projetoDataInicio,
  existingItems,
  itemToEdit,
  authSession,
  onSuccess
}) => {
  const [parentCode, setParentCode] = useState<string>('root'); // 'root' ou código EAP do pai
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
  const [selectedPredecessores, setSelectedPredecessores] = useState<string[]>([]);
  const [dataExecucao, setDataExecucao] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Unidades de medida comuns para construção civil
  const unidadesComuns = ['m²', 'm³', 'un', 'vb', 'kg', 'h', 'm', 'cj', 'gl', 'tx', 'sc', 'm.p.'];

  // Opções de agrupadores pai (Sintéticos / Níveis 1, 2 e 3)
  const parentOptions = useMemo(() => {
    return existingItems
      .filter(i => {
        // Se estamos editando, não podemos selecionar a si próprio nem seus descendentes como pai
        if (itemToEdit && (i.eap_codigo === itemToEdit.eap_codigo || i.eap_codigo.startsWith(itemToEdit.eap_codigo + '.'))) {
          return false;
        }
        return !i.e_analitico && i.eap_codigo.split('.').length < 4;
      })
      .sort((a, b) => a.eap_codigo.localeCompare(b.eap_codigo, undefined, { numeric: true }));
  }, [existingItems, itemToEdit]);

  // Possíveis etapas predecessoras (não inclui o próprio item em edição)
  const predecessorOptions = useMemo(() => {
    return existingItems
      .filter(i => {
        if (itemToEdit && i.eap_codigo === itemToEdit.eap_codigo) return false;
        return true;
      })
      .sort((a, b) => a.eap_codigo.localeCompare(b.eap_codigo, undefined, { numeric: true }));
  }, [existingItems, itemToEdit]);

  // Função para calcular sugestão automática de código EAP
  const calculateSuggestedEap = (pCode: string): string => {
    if (pCode === 'root') {
      // Procura o maior número inteiro de Nível 1 (ex: 1, 2, 3)
      const level1Numbers = existingItems
        .map(i => i.eap_codigo.split('.')[0])
        .filter(str => /^\d+$/.test(str))
        .map(Number);
      const maxL1 = level1Numbers.length > 0 ? Math.max(...level1Numbers) : 0;
      return String(maxL1 + 1);
    } else {
      // Procura os filhos diretos do pai selecionado
      const prefix = pCode + '.';
      const directChildren = existingItems.filter(i => i.eap_codigo.startsWith(prefix) && i.eap_codigo.split('.').length === pCode.split('.').length + 1);
      
      const lastSegmentNumbers = directChildren
        .map(i => {
          const parts = i.eap_codigo.split('.');
          return Number(parts[parts.length - 1]);
        })
        .filter(n => !isNaN(n));

      const maxChild = lastSegmentNumbers.length > 0 ? Math.max(...lastSegmentNumbers) : 0;
      return `${pCode}.${maxChild + 1}`;
    }
  };

  // Efeito para preencher/resetar o formulário quando o modal abre ou itemToEdit muda
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);

    if (itemToEdit) {
      // Modo Edição
      const parts = itemToEdit.eap_codigo.split('.');
      const pCode = parts.length > 1 ? parts.slice(0, parts.length - 1).join('.') : 'root';
      
      setParentCode(pCode);
      setEapCodigo(itemToEdit.eap_codigo);
      setIsManualEap(true);
      setDescricaoServico(itemToEdit.descricao_servico || '');
      setEAnalitico(!!itemToEdit.e_analitico);
      setUnidadeMedida(itemToEdit.unidade_medida || 'm²');
      setDuracaoDias(itemToEdit.duracao_dias || 1);
      setValorTotalContratado(String(itemToEdit.valor_total_contratado || 0));
      setValorDesembolsado(String(itemToEdit.valor_desembolsado || 0));
      setSelectedPredecessores(Array.isArray(itemToEdit.predecessores) ? itemToEdit.predecessores : []);
      setDataExecucao(itemToEdit.data_execucao || itemToEdit.data_inicio || '');
      setQuantidadeContratada('1');
      setPrecoUnitario(String(itemToEdit.valor_total_contratado || 0));
    } else {
      // Modo Criação
      setParentCode('root');
      const suggested = calculateSuggestedEap('root');
      setEapCodigo(suggested);
      setIsManualEap(false);
      setDescricaoServico('');
      setEAnalitico(false);
      setUnidadeMedida('m²');
      setDuracaoDias(1);
      setQuantidadeContratada('1');
      setPrecoUnitario('0');
      setValorTotalContratado('0');
      setValorDesembolsado('0');
      setSelectedPredecessores([]);
      setDataExecucao(projetoDataInicio || new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, itemToEdit]);

  // Recalcula sugestão de código quando o pai muda no modo criação
  const handleParentChange = (newPCode: string) => {
    setParentCode(newPCode);
    if (!itemToEdit && !isManualEap) {
      const suggested = calculateSuggestedEap(newPCode);
      setEapCodigo(suggested);

      // Auto ajustar eAnalitico: se o pai for nível 3 (ex: 1.1.1), o filho será nível 4 (analítico)
      if (newPCode !== 'root' && newPCode.split('.').length >= 3) {
        setEAnalitico(true);
      } else {
        setEAnalitico(false);
      }
    }
  };

  // Recalcular valor total contratado quando quantidade ou preço unitário mudar
  const handleQtdPriceChange = (qtdStr: string, priceStr: string) => {
    setQuantidadeContratada(qtdStr);
    setPrecoUnitario(priceStr);
    const q = parseFloat(qtdStr) || 0;
    const p = parseFloat(priceStr) || 0;
    setValorTotalContratado((q * p).toFixed(2));
  };

  // Toggle de seleção de predecessora
  const togglePredecessor = (code: string) => {
    setSelectedPredecessores(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Submissão do formulário
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
    const calculatedPai = parts.length > 1 ? parts.slice(0, parts.length - 1).join('.') : null;

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
        e_analitico: eAnalitico,
        duracao_dias: Math.max(1, Number(duracaoDias || 1)),
        predecessores: selectedPredecessores,
        data_execucao: dataExecucao || null
      };

      const res = await fetch('/api/itens-eap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && (json.success || json.id || json.item_eap_id)) {
        onSuccess();
        onClose();
      } else {
        // Fallback direto via Supabase Client se o endpoint responder com erro
        console.warn("[CadastroEtapaModal] API endpoint fallback to Supabase Client:", json.error || res.statusText);
        const upsertData: any = {
          projeto_id: projetoId,
          eap_codigo: eapCodigo.trim(),
          eap_pai_codigo: calculatedPai,
          descricao_servico: descricaoServico.trim(),
          unidade_medida: eAnalitico ? unidadeMedida.trim() : null,
          preco_unitario: eAnalitico ? parseFloat(precoUnitario) || 0 : 0,
          quantidade_contratada: eAnalitico ? parseFloat(quantidadeContratada) || 1 : 0,
          valor_total_contratado: eAnalitico ? parseFloat(valorTotalContratado) || 0 : 0,
          e_analitico: eAnalitico,
          duracao_dias: Math.max(1, Number(duracaoDias || 1)),
          predecessores: selectedPredecessores,
          data_inicio: dataExecucao || null
        };

        if (itemToEdit?.id) {
          upsertData.id = itemToEdit.id;
        }

        const { error: dbError } = await supabase.from('itens_eap').upsert(upsertData);
        if (dbError) throw dbError;

        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error("[CadastroEtapaModal] Erro ao salvar etapa:", err);
      const msg = typeof err === 'object' ? (err.message || err.error_description || JSON.stringify(err)) : String(err);
      setErrorMessage(`Erro ao salvar etapa: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isLevel3 = eapCodigo.split('.').length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#005daa] to-[#004a88] text-white flex items-center justify-between shadow-md">
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
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO COM SCROLL */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {errorMessage}
            </div>
          )}

          {/* SELEÇÃO DO PAI & CÓDIGO EAP */}
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
                    {p.eap_codigo} - {p.descricao_servico}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Código EAP <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsManualEap(!isManualEap)}
                  className="text-[11px] text-[#005daa] hover:underline font-bold"
                >
                  {isManualEap ? 'Auto Sugestão' : 'Editar Manual'}
                </button>
              </div>
              <input
                type="text"
                value={eapCodigo}
                onChange={(e) => {
                  setEapCodigo(e.target.value);
                  setIsManualEap(true);
                }}
                placeholder="Ex: 1.1.1"
                required
                className="w-full bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none transition-all"
              />
            </div>
          </div>

          {/* DESCRIÇÃO DO SERVIÇO & TIPO (ANALÍTICO OU SINTÉTICO) */}
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
                <input
                  type="checkbox"
                  checked={eAnalitico}
                  onChange={(e) => setEAnalitico(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#005daa]"></div>
              </label>
            </div>
          </div>

          {/* SEÇÃO EXECUÇÃO & CRONOGRAMA (DURAÇÃO, DATA, PREDECESSORAS) */}
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-[#005daa] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              Prazos e Dependências (Cronograma)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Duração estimada (Dias Úteis)
                </label>
                <input
                  type="number"
                  min="1"
                  value={duracaoDias}
                  onChange={(e) => setDuracaoDias(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-slate-300 font-bold text-sm text-slate-900 rounded-lg px-3.5 py-2.5 focus:ring-2 focus:ring-[#005daa]/20 focus:border-[#005daa] outline-none transition-all"
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

            {/* SELETOR MULTI-SELECT DE PREDECESSORAS */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Atividades Predecessoras (Dependências)
              </label>
              {predecessorOptions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Nenhuma outra etapa cadastrada para definir predecessora.</p>
              ) : (
                <div className="max-h-36 overflow-y-auto p-2 bg-white border border-slate-200 rounded-lg space-y-1">
                  {predecessorOptions.map(p => {
                    const isSelected = selectedPredecessores.includes(p.eap_codigo);
                    return (
                      <div
                        key={p.eap_codigo}
                        onClick={() => togglePredecessor(p.eap_codigo)}
                        className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border border-blue-200 text-[#005daa] font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // tratado pelo container
                            className="rounded border-slate-300 text-[#005daa] focus:ring-[#005daa]"
                          />
                          <span className="font-mono">{p.eap_codigo}</span>
                          <span className="truncate max-w-[280px]">{p.descricao_servico}</span>
                        </div>
                        {p.duracao_dias && (
                          <span className="text-[10px] text-slate-400 font-mono">{p.duracao_dias}d</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CAMPOS FINANCEIROS (APENAS PARA ANALÍTICO/EXECUTÁVEL) */}
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
                    {unidadesComuns.map(u => (
                      <option key={u} value={u} />
                    ))}
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

          {/* RODAPÉ E BOTÕES DE AÇÃO */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
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
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {itemToEdit ? 'Atualizar Etapa' : 'Cadastrar Etapa'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
