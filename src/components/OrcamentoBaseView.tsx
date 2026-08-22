import React, { useState, useEffect } from 'react';
import { CriarProjetoSimuladoModal } from './CriarProjetoSimuladoModal';

interface EtapaVariacional {
  id: string;
  nome: string;
  min: number;
  max: number;
  valorPadrao: number;
  decomposicao: {
    mo: number;
    mat: number;
    eqp: number;
    ferr: number;
  };
}

const ETAPAS_BASE: EtapaVariacional[] = [
  { id: '1', nome: 'Projetos e Licenciamento', min: 3, max: 5, valorPadrao: 4, decomposicao: { mo: 80, mat: 5, eqp: 10, ferr: 5 } },
  { id: '2', nome: 'Serviços Preliminares e Canteiro', min: 2, max: 4, valorPadrao: 3, decomposicao: { mo: 40, mat: 35, eqp: 20, ferr: 5 } },
  { id: '3', nome: 'Infraestrutura / Fundações', min: 5, max: 7, valorPadrao: 6, decomposicao: { mo: 25, mat: 50, eqp: 20, ferr: 5 } },
  { id: '4', nome: 'Contrapiso e Regularizações', min: 1, max: 2, valorPadrao: 2, decomposicao: { mo: 45, mat: 45, eqp: 5, ferr: 5 } },
  { id: '5', nome: 'Impermeabilização', min: 2, max: 4, valorPadrao: 3, decomposicao: { mo: 30, mat: 60, eqp: 5, ferr: 5 } },
  { id: '6', nome: 'Estrutura', min: 12, max: 20, valorPadrao: 16, decomposicao: { mo: 30, mat: 55, eqp: 10, ferr: 5 } },
  { id: '7', nome: 'Fechamentos (Alvenaria/Esquadrias)', min: 10, max: 19, valorPadrao: 15, decomposicao: { mo: 40, mat: 50, eqp: 5, ferr: 5 } },
  { id: '8', nome: 'Cobertura', min: 3, max: 5, valorPadrao: 4, decomposicao: { mo: 30, mat: 60, eqp: 5, ferr: 5 } },
  { id: '9', nome: 'Instalação Hidráulica', min: 9, max: 12, valorPadrao: 10, decomposicao: { mo: 40, mat: 50, eqp: 5, ferr: 5 } },
  { id: '10', nome: 'Instalação Elétrica', min: 5, max: 7, valorPadrao: 6, decomposicao: { mo: 40, mat: 50, eqp: 5, ferr: 5 } },
  { id: '11', nome: 'Revestimentos, Acabamentos e Pintura', min: 20, max: 38, valorPadrao: 30, decomposicao: { mo: 50, mat: 40, eqp: 5, ferr: 5 } },
  { id: '12', nome: 'Serviços Complementares e Limpeza', min: 0, max: 1, valorPadrao: 1, decomposicao: { mo: 45, mat: 45, eqp: 5, ferr: 5 } },
];

const TIPOLOGIA_NOMES: Record<string, string> = {
  'R-1': 'Residência Unifamiliar',
  'PP-4': 'Prédio Popular (4 pav.)',
  'R-8': 'Residência Multifamiliar (8 pav.)',
  'R-16': 'Residência Multifamiliar (16 pav.)',
  'CAL-8': 'Comercial Andares Livres (8 pav.)',
  'CSL-8': 'Comercial Salas e Lojas (8 pav.)',
  'CSL-16': 'Comercial Salas e Lojas (16 pav.)',
  'GI': 'Galpão Industrial',
  'RP1Q': 'Residência Popular (1 quarto)',
  'PIS': 'Projeto de Interesse Social'
};

export interface CUBBaseInfo {
  id: string;
  uf: string;
  sinduscon_nome: string;
  mes_referencia: string;
  dados_json: any;
  atualizado_em: string;
  status?: string;
  projetos?: number;
}

interface OrcamentoBaseViewProps {
  authSession?: any;
  onNavigateTab?: (tab: string) => void;
}

export const OrcamentoBaseView: React.FC<OrcamentoBaseViewProps> = ({ authSession, onNavigateTab }) => {
  const [bases, setBases] = useState<CUBBaseInfo[]>([]);
  const [percentuais, setPercentuais] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Simulações (Rascunhos)
  const [simulacoes, setSimulacoes] = useState<any[]>([]);
  const [simulacaoId, setSimulacaoId] = useState<string>('');
  const [simulacaoNome, setSimulacaoNome] = useState<string>('');
  const [savingDraft, setSavingDraft] = useState(false);

  // Premissas de Projeto
  const [areaTotal, setAreaTotal] = useState<number>(1000);
  const [andares, setAndares] = useState<number>(1);
  const [selectedBaseId, setSelectedBaseId] = useState<string>('');
  const [selectedTipologia, setSelectedTipologia] = useState<string>('R-1');
  const [selectedPadrao, setSelectedPadrao] = useState<string>('normal');

  // Adições Especiais (Fatores Adicionais)
  const [adicoes, setAdicoes] = useState<{id: string, nome: string, valor: number}[]>([]);

  useEffect(() => {
    const iniciais: Record<string, number> = {};
    ETAPAS_BASE.forEach(e => {
      iniciais[e.id] = e.valorPadrao;
    });
    setPercentuais(iniciais);
    fetchBases();
  }, [authSession?.idToken]);

  const fetchBases = async () => {
    try {
      const response = await fetch('/api/cub/bases', {
        headers: {
          'Authorization': `Bearer ${authSession?.idToken}`
        }
      });
      if (response.ok) {
        const resData = await response.json();
        setBases(resData.bases || []);
        if (resData.bases && resData.bases.length > 0) {
          setSelectedBaseId(resData.bases[0].id);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar bases CUB:", error);
    }
  };

  const fetchSimulacoes = async () => {
    if (!authSession) return;
    try {
      const res = await fetch('/api/simulacoes', {
        headers: { 'Authorization': `Bearer ${authSession.idToken}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSimulacoes(data.data);
      }
    } catch (err) {
      console.error("Erro ao buscar simulações:", err);
    }
  };

  useEffect(() => {
    fetchSimulacoes();
  }, [authSession]);

  const getCubValue = () => {
    if (!selectedBaseId) return 0;
    const base = bases.find(b => b.id === selectedBaseId);
    if (!base || !base.dados_json || !Array.isArray(base.dados_json)) return 0;

    const tipologiaData = base.dados_json.find((item: any) => item.tipo === selectedTipologia);
    if (!tipologiaData) return 0;

    return tipologiaData[selectedPadrao] || 0;
  };

  const cubValue = getCubValue();
  const baseCalculadaCUB = areaTotal * cubValue;
  const totalAdicoes = adicoes.reduce((acc, curr) => acc + curr.valor, 0);
  const orcamentoBase = baseCalculadaCUB + totalAdicoes;

  const totalPercentual = (Object.values(percentuais) as number[]).reduce((a, b) => a + b, 0);
  const is100Percent = totalPercentual === 100;

  const formatCurrency = (val: number) => {
    return Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val: number) => {
    return val.toFixed(1) + '%';
  };

  const handleAddAdicao = () => {
    setAdicoes([...adicoes, { id: Math.random().toString(36).substr(2, 9), nome: '', valor: 0 }]);
  };

  const handleUpdateAdicao = (id: string, field: 'nome' | 'valor', value: any) => {
    setAdicoes(adicoes.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleRemoveAdicao = (id: string) => {
    setAdicoes(adicoes.filter(a => a.id !== id));
  };

  const handleSliderChange = (id: string, value: number) => {
    setPercentuais(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSalvarRascunho = async () => {
    if (!authSession) return;
    const nome = window.prompt("Nome da Simulação:", simulacaoNome || "Simulação de Obra");
    if (!nome) return;

    setSavingDraft(true);
    try {
      const dados_json = {
        areaTotal,
        andares,
        selectedBaseId,
        selectedTipologia,
        selectedPadrao,
        percentuais,
        adicoes
      };

      const res = await fetch('/api/simulacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.idToken}`
        },
        body: JSON.stringify({
          nome,
          dados_json
        })
      });

      const data = await res.json();
      if (data.success) {
        setSimulacaoId(data.data.id);
        setSimulacaoNome(data.data.nome);
        alert('Simulação salva com sucesso!');
        fetchSimulacoes();
      } else {
        alert('Erro ao salvar simulação: ' + data.error);
      }
    } catch (err) {
      alert('Erro na comunicação com o servidor.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleCarregarSimulacao = (id: string) => {
    if (!id) return;
    const sim = simulacoes.find(s => s.id === id);
    if (!sim) return;

    setSimulacaoId(sim.id);
    setSimulacaoNome(sim.nome);
    const d = sim.dados_json;
    if (d) {
      if (d.areaTotal) setAreaTotal(d.areaTotal);
      if (d.andares) setAndares(d.andares);
      if (d.selectedBaseId) setSelectedBaseId(d.selectedBaseId);
      if (d.selectedTipologia) setSelectedTipologia(d.selectedTipologia);
      if (d.selectedPadrao) setSelectedPadrao(d.selectedPadrao);
      if (d.percentuais) setPercentuais(d.percentuais);
      if (d.adicoes) setAdicoes(d.adicoes);
    }
  };

  const handleDeleteSimulacao = async () => {
    if (!simulacaoId || !authSession) return;
    if (!window.confirm('Tem certeza que deseja excluir este rascunho? Esta ação não pode ser desfeita.')) return;

    try {
      const res = await fetch(`/api/simulacoes/${simulacaoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authSession.idToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        alert('Rascunho excluído com sucesso!');
        setSimulacaoId('');
        setSimulacaoNome('');
        fetchSimulacoes();
      } else {
        alert('Erro ao excluir rascunho: ' + data.error);
      }
    } catch (err) {
      alert('Erro na comunicação com o servidor.');
    }
  };

  // Calcula totais globais
  let globalMO = 0;
  let globalMAT = 0;
  let globalEQP = 0;
  let globalFERR = 0;
  let totalCalculated = 0;

  ETAPAS_BASE.forEach(etapa => {
    const currentPercent = percentuais[etapa.id] || 0;
    const stageValue = (currentPercent / 100) * orcamentoBase;
    globalMO += stageValue * (etapa.decomposicao.mo / 100);
    globalMAT += stageValue * (etapa.decomposicao.mat / 100);
    globalEQP += stageValue * (etapa.decomposicao.eqp / 100);
    globalFERR += stageValue * (etapa.decomposicao.ferr / 100);
    totalCalculated += stageValue;
  });

  const percGlobalMO = totalCalculated > 0 ? (globalMO / totalCalculated) * 100 : 0;
  const percGlobalMAT = totalCalculated > 0 ? (globalMAT / totalCalculated) * 100 : 0;
  const percGlobalEQP = totalCalculated > 0 ? (globalEQP / totalCalculated) * 100 : 0;
  const percGlobalFERR = totalCalculated > 0 ? (globalFERR / totalCalculated) * 100 : 0;

  const activeBase = bases.find(b => b.id === selectedBaseId);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e2e8] p-6 shadow-sm z-10 flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005daa]">calculate</span>
            Orçamento Base & Simulação
          </h2>
          <p className="text-sm text-[#707785] mt-1">Defina as premissas de projeto e tabela CUB para simular as etapas da obra.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={simulacaoId}
            onChange={(e) => handleCarregarSimulacao(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none text-sm font-medium"
          >
            <option value="">Carregar rascunho salvo...</option>
            {simulacoes.map(s => (
              <option key={s.id} value={s.id}>{s.nome} ({new Date(s.updated_at).toLocaleDateString()})</option>
            ))}
          </select>

          {simulacaoId && (
            <button 
              onClick={handleDeleteSimulacao}
              className="flex items-center justify-center p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 border border-transparent hover:border-rose-200 rounded-lg transition-colors"
              title="Excluir este rascunho"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          )}

          <button 
            onClick={handleSalvarRascunho}
            disabled={savingDraft}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#005daa] text-[#005daa] hover:bg-blue-50 rounded-lg font-bold transition-all text-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {savingDraft ? 'Salvando...' : 'Salvar Rascunho'}
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        
        {/* Painel Premissas */}
        <div className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] p-6 mb-6">
          <h3 className="font-bold text-[#191c1e] mb-4 text-lg border-b border-slate-100 pb-2">Premissas do Projeto</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* Base CUB */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">Tabela de Referência (CUB)</label>
              <select 
                value={selectedBaseId}
                onChange={(e) => setSelectedBaseId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
              >
                <option value="" disabled>Selecione uma base...</option>
                {bases.map(base => (
                  <option key={base.id} value={base.id}>
                    {base.sinduscon_nome} - {base.mes_referencia}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipologia */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Tipologia</label>
              <select 
                value={selectedTipologia}
                onChange={(e) => setSelectedTipologia(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
              >
                {activeBase && Array.isArray(activeBase.dados_json) ? (
                  activeBase.dados_json.map((item: any) => (
                    <option key={item.tipo} value={item.tipo}>
                      {item.tipo} {TIPOLOGIA_NOMES[item.tipo] ? `- ${TIPOLOGIA_NOMES[item.tipo]}` : ''}
                    </option>
                  ))
                ) : (
                  <option value="R-1">R-1 - Residência Unifamiliar</option>
                )}
              </select>
            </div>

            {/* Padrão */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Padrão</label>
              <select 
                value={selectedPadrao}
                onChange={(e) => setSelectedPadrao(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none"
              >
                <option value="baixo">Baixo</option>
                <option value="normal">Normal</option>
                <option value="alto">Alto</option>
              </select>
            </div>

            {/* Custo m2 Exibição */}
            <div className="flex flex-col justify-end">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Custo CUB (m²)</label>
              <div className="px-4 py-2 bg-[#f0f4f8] border border-blue-100 rounded-lg text-[#005daa] font-black text-lg">
                {formatCurrency(cubValue)}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Área Total (m²)</label>
              <input 
                type="number"
                min="0"
                value={areaTotal}
                onChange={(e) => setAreaTotal(Number(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none font-medium text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Andares</label>
              <input 
                type="number"
                min="1"
                value={andares}
                onChange={(e) => setAndares(Number(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#005daa] outline-none font-medium text-lg"
              />
            </div>
            
            <div className="lg:col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-center items-end">
              <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                Orçamento Base Global Projetado
              </label>
              <div className="text-3xl font-black text-emerald-700">
                {formatCurrency(orcamentoBase)}
              </div>
              {totalAdicoes > 0 && (
                <div className="text-xs text-emerald-600 font-medium mt-1">
                  (CUB: {formatCurrency(baseCalculadaCUB)} + Adições: {formatCurrency(totalAdicoes)})
                </div>
              )}
            </div>

          </div>

          {/* Adições Especiais */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="font-bold text-[#191c1e] text-md">Adições Especiais</h4>
                <p className="text-[11px] text-slate-500">Ex: Elevadores, Fundações Especiais, Projetos Específicos que não compõem a tabela CUB padrão.</p>
              </div>
              <button 
                onClick={handleAddAdicao}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Adicionar Componente
              </button>
            </div>
            
            {adicoes.length > 0 ? (
              <div className="space-y-3">
                {adicoes.map((adicao) => (
                  <div key={adicao.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        placeholder="Nome do componente (Ex: Elevadores)"
                        value={adicao.nome}
                        onChange={(e) => handleUpdateAdicao(adicao.id, 'nome', e.target.value)}
                        className="w-full bg-transparent outline-none font-medium text-sm text-slate-700 placeholder-slate-400"
                      />
                    </div>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div className="w-48 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0.00"
                        value={adicao.valor || ''}
                        onChange={(e) => handleUpdateAdicao(adicao.id, 'valor', Number(e.target.value) || 0)}
                        className="w-full pl-10 pr-3 py-1.5 bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 font-bold text-slate-700 text-sm"
                      />
                    </div>
                    <button 
                      onClick={() => handleRemoveAdicao(adicao.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Remover"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">extension</span>
                <p className="text-sm font-medium text-slate-500">Nenhum componente adicional inserido.</p>
              </div>
            )}
          </div>
        </div>

        {/* Painel Hero - Totalizador */}
        <div className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] p-6 mb-8 flex flex-col xl:flex-row items-stretch justify-between gap-6">
          <div className="flex-1">
             <h3 className="font-bold text-[#191c1e] text-lg mb-2">Simulação de Etapas e Decomposição</h3>
             <p className="text-sm text-slate-600">Com base no orçamento projetado de {formatCurrency(orcamentoBase)}, ajuste as fatias de macro-etapas para transformar essa simulação em um projeto real.</p>
          </div>

          <div className="flex gap-4 items-stretch flex-wrap md:flex-nowrap">
            {/* Totalizador de Etapas */}
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 w-full md:w-auto min-w-[180px] transition-colors ${
              is100Percent ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${is100Percent ? 'text-emerald-700' : 'text-amber-700'}`}>
                Distribuição Total
              </span>
              <div className={`text-4xl font-black ${is100Percent ? 'text-emerald-600' : 'text-amber-600'}`}>
                {totalPercentual.toFixed(1)}%
              </div>
            </div>

            {/* Totalizadores MO/MAT/EQP */}
            <div className="flex flex-col justify-between w-full md:w-auto min-w-[260px] border-l border-[#e1e2e8] pl-4 md:pl-6 py-1">
              <div className="mb-3">
                <h4 className="text-[10px] font-bold text-[#707785] uppercase tracking-wider mb-2">Decomposição Global do Custo</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="font-bold text-[#404753]">Mão de Obra</span></div>
                    <span className="font-bold text-[#191c1e]">{formatCurrency(globalMO)} <span className="text-xs font-normal text-slate-500">({formatPercent(percGlobalMO)})</span></span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="font-bold text-[#404753]">Materiais</span></div>
                    <span className="font-bold text-[#191c1e]">{formatCurrency(globalMAT)} <span className="text-xs font-normal text-slate-500">({formatPercent(percGlobalMAT)})</span></span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="font-bold text-[#404753]">Equipamentos</span></div>
                    <span className="font-bold text-[#191c1e]">{formatCurrency(globalEQP)} <span className="text-xs font-normal text-slate-500">({formatPercent(percGlobalEQP)})</span></span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div><span className="font-bold text-[#404753]">Ferramentas</span></div>
                    <span className="font-bold text-[#191c1e]">{formatCurrency(globalFERR)} <span className="text-xs font-normal text-slate-500">({formatPercent(percGlobalFERR)})</span></span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(true)}
                disabled={!is100Percent || orcamentoBase === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold shadow-md transition-all ${is100Percent && orcamentoBase > 0 ? 'bg-[#005daa] text-white hover:bg-[#004a88]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                title={!is100Percent ? "O orçamento deve fechar exatamente em 100% para gerar um projeto" : ""}
              >
                <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                Salvar Simulação
              </button>
            </div>
          </div>
        </div>

        {/* Grade de Etapas Variacionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {ETAPAS_BASE.map(etapa => {
            const currentPercent = percentuais[etapa.id] || 0;
            const calculatedValue = (currentPercent / 100) * orcamentoBase;
            const minAllowedValue = (etapa.min / 100) * orcamentoBase;
            const maxAllowedValue = (etapa.max / 100) * orcamentoBase;
            
            const isMax = currentPercent === etapa.max;
            
            const valMO = calculatedValue * (etapa.decomposicao.mo / 100);
            const valMAT = calculatedValue * (etapa.decomposicao.mat / 100);
            const valEQP = calculatedValue * (etapa.decomposicao.eqp / 100);
            const valFERR = calculatedValue * (etapa.decomposicao.ferr / 100);
            
            return (
              <div key={etapa.id} className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] p-5 flex flex-col hover:border-[#c0c7d6] transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-[#191c1e] text-[14px] leading-tight pr-2">{etapa.nome}</h3>
                    <p className="text-[10px] font-bold text-[#707785] bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-1.5">
                      Range: {etapa.min}% a {etapa.max}%
                    </p>
                  </div>
                  <div className="bg-[#f0f4f8] rounded-lg px-2.5 py-1.5 border border-[#e1e2e8] text-right flex-shrink-0">
                    <span className="block text-[#005daa] font-black text-lg leading-none">{currentPercent}%</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1 text-xs font-bold text-[#404753]">
                    <span>Total da Etapa:</span>
                    <span className="text-lg text-[#191c1e]">{formatCurrency(calculatedValue)}</span>
                  </div>
                  
                  {/* Decomposição Visual da Etapa */}
                  <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                    <div className="w-full h-1.5 rounded-full flex overflow-hidden mb-2">
                      <div className="bg-blue-500" style={{ width: `${etapa.decomposicao.mo}%` }}></div>
                      <div className="bg-emerald-500" style={{ width: `${etapa.decomposicao.mat}%` }}></div>
                      <div className="bg-amber-500" style={{ width: `${etapa.decomposicao.eqp}%` }}></div>
                      <div className="bg-indigo-500" style={{ width: `${etapa.decomposicao.ferr}%` }}></div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center divide-x divide-slate-200">
                      <div>
                        <p className="text-[8px] font-bold text-blue-600 uppercase">MO ({etapa.decomposicao.mo}%)</p>
                        <p className="text-[10px] font-bold text-slate-700">{formatCurrency(valMO)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-emerald-600 uppercase">MAT ({etapa.decomposicao.mat}%)</p>
                        <p className="text-[10px] font-bold text-slate-700">{formatCurrency(valMAT)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-amber-600 uppercase">EQP ({etapa.decomposicao.eqp}%)</p>
                        <p className="text-[10px] font-bold text-slate-700">{formatCurrency(valEQP)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-indigo-600 uppercase">FERR ({etapa.decomposicao.ferr}%)</p>
                        <p className="text-[10px] font-bold text-slate-700">{formatCurrency(valFERR)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-2 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400 font-medium flex justify-between mb-2">
                    <span>Mín: {formatCurrency(minAllowedValue)}</span>
                    <span>Máx: {formatCurrency(maxAllowedValue)}</span>
                  </div>
                  <input 
                    type="range"
                    min={etapa.min}
                    max={etapa.max}
                    step={1}
                    value={currentPercent}
                    onChange={(e) => handleSliderChange(etapa.id, Number(e.target.value))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                      isMax ? 'bg-amber-400' : 'bg-[#005daa]'
                    }`}
                    style={{
                      accentColor: isMax ? '#fbbf24' : '#005daa'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-12">        </div>
      </div>

      <CriarProjetoSimuladoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        authSession={authSession}
        orcamentoBase={orcamentoBase}
        simulacao_id={simulacaoId}
        etapas={ETAPAS_BASE.map(e => ({
          id: e.id,
          nome: e.nome,
          percentual: percentuais[e.id] || 0,
          valorCalculado: ((percentuais[e.id] || 0) / 100) * orcamentoBase,
          decomposicao: e.decomposicao
        }))}
      />
    </div>
  );
};
