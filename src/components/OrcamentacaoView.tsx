import React, { useState, useEffect } from 'react';

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
  };
}

const ETAPAS_BASE: EtapaVariacional[] = [
  { id: '1', nome: 'Projetos e Licenciamento', min: 3, max: 5, valorPadrao: 4, decomposicao: { mo: 85, mat: 5, eqp: 10 } },
  { id: '2', nome: 'Serviços Preliminares e Canteiro', min: 2, max: 4, valorPadrao: 3, decomposicao: { mo: 45, mat: 35, eqp: 20 } },
  { id: '3', nome: 'Infraestrutura / Fundações', min: 5, max: 7, valorPadrao: 6, decomposicao: { mo: 30, mat: 50, eqp: 20 } },
  { id: '4', nome: 'Contrapiso e Regularizações', min: 1, max: 2, valorPadrao: 2, decomposicao: { mo: 50, mat: 45, eqp: 5 } },
  { id: '5', nome: 'Impermeabilização', min: 2, max: 4, valorPadrao: 3, decomposicao: { mo: 35, mat: 60, eqp: 5 } },
  { id: '6', nome: 'Estrutura', min: 12, max: 20, valorPadrao: 16, decomposicao: { mo: 35, mat: 55, eqp: 10 } },
  { id: '7', nome: 'Fechamentos (Alvenaria/Esquadrias)', min: 10, max: 19, valorPadrao: 15, decomposicao: { mo: 45, mat: 50, eqp: 5 } },
  { id: '8', nome: 'Cobertura', min: 3, max: 5, valorPadrao: 4, decomposicao: { mo: 35, mat: 60, eqp: 5 } },
  { id: '9', nome: 'Instalação Hidráulica', min: 9, max: 12, valorPadrao: 10, decomposicao: { mo: 45, mat: 50, eqp: 5 } },
  { id: '10', nome: 'Instalação Elétrica', min: 5, max: 7, valorPadrao: 6, decomposicao: { mo: 45, mat: 50, eqp: 5 } },
  { id: '11', nome: 'Revestimentos, Acabamentos e Pintura', min: 20, max: 38, valorPadrao: 30, decomposicao: { mo: 55, mat: 40, eqp: 5 } },
  { id: '12', nome: 'Serviços Complementares e Limpeza', min: 0, max: 1, valorPadrao: 1, decomposicao: { mo: 50, mat: 45, eqp: 5 } },
];

import { CriarProjetoSimuladoModal } from './CriarProjetoSimuladoModal';

interface OrcamentacaoViewProps {
  authSession?: any;
  onNavigateTab?: (tab: string) => void;
}

export const OrcamentacaoView: React.FC<OrcamentacaoViewProps> = ({ authSession, onNavigateTab }) => {
  const [orcamentoBase, setOrcamentoBase] = useState<number>(500000);
  const [percentuais, setPercentuais] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  useEffect(() => {
    const iniciais: Record<string, number> = {};
    ETAPAS_BASE.forEach(e => {
      iniciais[e.id] = e.valorPadrao;
    });
    setPercentuais(iniciais);
  }, []);

  const totalPercentual = (Object.values(percentuais) as number[]).reduce((a, b) => a + b, 0);
  const is100Percent = totalPercentual === 100;

  const formatCurrency = (val: number) => {
    return Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val: number) => {
    return val.toFixed(1) + '%';
  };

  const handleSliderChange = (id: string, value: number) => {
    setPercentuais(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Calcula totais globais
  let globalMO = 0;
  let globalMAT = 0;
  let globalEQP = 0;
  let totalCalculated = 0;

  ETAPAS_BASE.forEach(etapa => {
    const currentPercent = percentuais[etapa.id] || 0;
    const stageValue = (currentPercent / 100) * orcamentoBase;
    globalMO += stageValue * (etapa.decomposicao.mo / 100);
    globalMAT += stageValue * (etapa.decomposicao.mat / 100);
    globalEQP += stageValue * (etapa.decomposicao.eqp / 100);
    totalCalculated += stageValue;
  });

  const percGlobalMO = totalCalculated > 0 ? (globalMO / totalCalculated) * 100 : 0;
  const percGlobalMAT = totalCalculated > 0 ? (globalMAT / totalCalculated) * 100 : 0;
  const percGlobalEQP = totalCalculated > 0 ? (globalEQP / totalCalculated) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e2e8] p-6 shadow-sm z-10 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005daa]">analytics</span>
            Simulador de Orçamento de Obra
          </h2>
          <p className="text-sm text-[#707785] mt-1">Defina o montante de gasto e crie cenários variacionais com decomposição de custos (MO/MAT/EQP).</p>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {/* Painel Hero - Orçamento Global e Totalizador */}
        <div className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] p-6 mb-8 flex flex-col xl:flex-row items-stretch justify-between gap-6">
          
          <div className="flex-1 flex flex-col justify-center">
            <label className="block text-sm font-bold text-[#404753] uppercase mb-3">
              Montante de Gasto Definido (Orçamento Base)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#707785]">R$</span>
              <input 
                type="number"
                min="0"
                step="1000"
                value={orcamentoBase}
                onChange={(e) => setOrcamentoBase(Number(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border-2 border-[#e1e2e8] focus:border-[#005daa] rounded-xl text-3xl font-bold text-[#191c1e] pl-16 pr-4 py-4 outline-none transition-colors"
                placeholder="500000"
              />
            </div>
          </div>

          <div className="flex gap-4 items-stretch flex-wrap md:flex-nowrap">
            {/* Totalizador de Etapas */}
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 w-full md:w-auto min-w-[200px] transition-colors ${
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
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(true)}
                disabled={!is100Percent}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold shadow-md transition-all ${is100Percent ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                title={!is100Percent ? "O orçamento deve fechar exatamente em 100% para gerar um projeto" : ""}
              >
                <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                Transformar em Projeto Real
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
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center divide-x divide-slate-200">
                      <div>
                        <p className="text-[9px] font-bold text-blue-600 uppercase">MO ({etapa.decomposicao.mo}%)</p>
                        <p className="text-[11px] font-bold text-slate-700">{formatCurrency(valMO)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-emerald-600 uppercase">MAT ({etapa.decomposicao.mat}%)</p>
                        <p className="text-[11px] font-bold text-slate-700">{formatCurrency(valMAT)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-amber-600 uppercase">EQP ({etapa.decomposicao.eqp}%)</p>
                        <p className="text-[11px] font-bold text-slate-700">{formatCurrency(valEQP)}</p>
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
        orcamentoBase={orcamentoBase}
        authSession={authSession}
        onNavigateTab={onNavigateTab}
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
