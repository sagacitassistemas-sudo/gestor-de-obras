import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ContratoObraResumo } from '../types/cerne.types';

export const ContratosObraView: React.FC = () => {
  const [contratos, setContratos] = useState<ContratoObraResumo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContratos();
  }, []);

  const fetchContratos = async () => {
    setLoading(true);
    // Chama o endpoint da nossa API ou consulta direta ao supabase.
    // Como a view `v_contratos_obra_resumo` está protegida por RLS, podemos consultar diretamente se o client tiver token, ou via backend.
    // Vamos usar fetch pra nossa API local para manter a mesma convenção.
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await fetch('/api/contratos-obra', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.contratos) {
        setContratos(json.contratos);
      }
    } catch (err) {
      console.error('Erro ao buscar contratos de obra:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (val: number) => {
    if (val == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-display text-[#191c1e]">Contratos de Obra</h1>
          <p className="text-body-md text-[#707785]">Acompanhamento da execução físico-financeira dos fornecedores</p>
        </div>
        <button className="px-4 py-2 bg-[#005daa] text-white rounded-md font-label-bold flex items-center gap-2 hover:bg-[#004a88]">
          <span className="material-symbols-outlined">add</span>
          Novo Contrato
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f2f4f6] text-[#424753] text-[11px] uppercase tracking-wider font-bold">
                <th className="px-4 py-3 border-b border-[#e1e2e8]">Número / Fornecedor</th>
                <th className="px-4 py-3 border-b border-[#e1e2e8]">Projeto Vinculado</th>
                <th className="px-4 py-3 border-b border-[#e1e2e8] text-right">Valor Global (R$)</th>
                <th className="px-4 py-3 border-b border-[#e1e2e8] text-right">Medido Acum. (R$)</th>
                <th className="px-4 py-3 border-b border-[#e1e2e8] text-center">Status</th>
                <th className="px-4 py-3 border-b border-[#e1e2e8] text-center">Avanço %</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-[#707785]">Carregando contratos...</td>
                </tr>
              )}
              {!loading && contratos.map(c => (
                <tr key={c.contrato_obra_id} className="border-b border-[#e1e2e8] hover:bg-[#f7f9fb]">
                  <td className="px-4 py-3">
                    <div className="font-bold text-[#191c1e]">{c.numero_contrato}</div>
                    <div className="text-[11px] text-[#707785]">{c.fornecedor_nome}</div>
                  </td>
                  <td className="px-4 py-3 text-[#191c1e]">
                    {c.nome_projeto || <span className="text-rose-500 text-[10px] uppercase font-bold">Não Vinculado</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(c.valor_global)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#10b981]">
                    {formatCurrency(c.medicao_valor_acumulado)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      c.contrato_status === 'VIGENTE' ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#f3f4f6] text-[#4b5563]'
                    }`}>
                      {c.contrato_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold text-[#005daa]">{Number(c.percentual_executado).toFixed(1)}%</span>
                      <div className="w-16 bg-slate-200 rounded-full h-1.5">
                        <div className="bg-[#005daa] h-1.5 rounded-full" style={{ width: `${Math.min(Number(c.percentual_executado), 100)}%` }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && contratos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-[#707785]">
                    Nenhum contrato de obra encontrado. Estabeleça um contrato com um fornecedor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
