import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const ProjetosEapView: React.FC = () => {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [eapData, setEapData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjetos();
  }, []);

  const fetchProjetos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('projetos').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar projetos:', error);
    } else {
      setProjetos(data || []);
      if (data && data.length > 0) {
        setSelectedProjetoId(data[0].id);
        fetchEap(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchEap = async (projetoId: string) => {
    setLoading(true);
    // Busca os dados da view que consolida a EAP e as Medições
    const { data, error } = await supabase
      .from('v_resumo_eap_medicao')
      .select('*')
      .eq('projeto_id', projetoId);
      
    if (error) {
      console.error('Erro ao buscar EAP:', error);
    } else {
      setEapData(data || []);
    }
    setLoading(false);
  };

  const handleProjetoClick = (id: string) => {
    setSelectedProjetoId(id);
    fetchEap(id);
  };

  // Calcula a profundidade da linha (para indentação na tabela)
  const getDepth = (codigo: string) => {
    if (!codigo) return 0;
    return codigo.split('.').length - 1;
  };

  const formatCurrency = (val: number) => {
    if (val == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-display text-[#191c1e]">Projetos EAP e Medições</h1>
          <p className="text-body-md text-[#707785]">Acompanhamento da Estrutura Analítica de Projetos e Execução Físico-Financeira</p>
        </div>
        <button className="px-4 py-2 bg-[#005daa] text-white rounded-md font-label-bold flex items-center gap-2 hover:bg-[#004a88]">
          <span className="material-symbols-outlined">upload_file</span>
          Importar Planilha (Python)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar com Lista de Projetos */}
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden lg:col-span-1">
          <div className="p-4 border-b border-[#e1e2e8] bg-[#f2f4f6]">
            <h2 className="font-label-bold text-[#191c1e]">Projetos (Contratos)</h2>
          </div>
          <div className="p-2 space-y-1">
            {projetos.map(proj => (
              <div 
                key={proj.id} 
                onClick={() => handleProjetoClick(proj.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedProjetoId === proj.id ? 'bg-[#d4e3ff] border border-[#005daa]/20' : 'hover:bg-[#f7f9fb] border border-transparent'}`}
              >
                <p className="text-[11px] text-[#005daa] font-bold">Projeto</p>
                <p className="font-semibold text-body-sm mt-0.5 line-clamp-2 leading-tight">{proj.nome_projeto}</p>
                <p className="text-[10px] text-[#707785] mt-2">Início: {new Date(proj.data_inicio).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
            {projetos.length === 0 && !loading && (
              <div className="p-4 text-center text-[#707785] text-sm">Nenhum projeto encontrado.</div>
            )}
          </div>
        </div>

        {/* Tabela da EAP do Projeto Selecionado */}
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f2f4f6] text-[#424753] text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 font-semibold border-b border-[#e1e2e8] w-24">Item</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#e1e2e8]">Serviço / Descrição</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#e1e2e8] text-center w-16">Un.</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#e1e2e8] text-right">Qtd</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#e1e2e8] text-right w-36">Contratado (R$)</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#e1e2e8] text-right w-36">Acumulado (R$)</th>
                  <th className="px-4 py-3 font-semibold border-b border-[#e1e2e8] text-center w-24">Avanço %</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-[#707785]">Carregando dados...</td>
                  </tr>
                )}
                {!loading && eapData.map(row => {
                  const depth = getDepth(row.eap_codigo);
                  const isSintetico = !row.e_analitico;
                  
                  return (
                    <tr 
                      key={row.eap_codigo} 
                      className={`border-b border-[#e1e2e8] hover:bg-[#f7f9fb] ${isSintetico ? 'bg-[#f7f9fb]/50' : ''}`}
                    >
                      <td className={`px-4 py-2 ${isSintetico ? 'font-bold text-[#191c1e]' : 'text-[#707785]'}`}>
                        {row.eap_codigo}
                      </td>
                      <td className={`px-4 py-2`} style={{ paddingLeft: `${Math.max(1, depth * 1.5)}rem` }}>
                        <span className={isSintetico ? 'font-bold' : ''}>{row.descricao_servico}</span>
                      </td>
                      <td className="px-4 py-2 text-center text-[#707785]">
                        {row.unidade_medida || '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {row.quantidade_contratada > 0 ? Number(row.quantidade_contratada).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className={`px-4 py-2 text-right ${isSintetico ? 'font-bold text-[#005daa]' : ''}`}>
                        {formatCurrency(row.valor_total_contratado)}
                      </td>
                      <td className={`px-4 py-2 text-right ${isSintetico ? 'font-bold text-[#10b981]' : ''}`}>
                        {formatCurrency(row.medicao_acumulada_valor)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`font-bold ${row.percentual_executado_financeiro === 100 ? 'text-[#10b981]' : 'text-[#005daa]'}`}>
                            {Number(row.percentual_executado_financeiro).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!loading && eapData.length === 0 && selectedProjetoId && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-[#707785]">Nenhum dado de EAP encontrado para este projeto.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
