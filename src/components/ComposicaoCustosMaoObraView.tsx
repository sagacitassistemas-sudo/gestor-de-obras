import React, { useState, useEffect } from 'react';
import { AuthSession } from '../types';

interface ComposicaoCustosMaoObraViewProps {
  authSession: AuthSession | null;
  projetoId: string;
  osId?: string;
}

export function ComposicaoCustosMaoObraView({ authSession, projetoId, osId }: ComposicaoCustosMaoObraViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!projetoId || !authSession?.idToken) return;
    
    async function fetchSimulacao() {
      try {
        setLoading(true);
        let url = `/api/custos/simulacao-mao-obra?projeto_id=${projetoId}`;
        if (osId) url += `&os_id=${osId}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${authSession?.idToken}`
          }
        });
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error || 'Erro ao carregar simulação');
        
        setData(result.calculo);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSimulacao();
  }, [projetoId, osId, authSession]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
        <p className="text-slate-500 font-medium">Calculando Composição de Custos de Mão de Obra (Histograma e Calendário)...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex flex-col items-center justify-center">
        <span className="material-symbols-outlined text-3xl mb-2">error</span>
        <p className="font-bold">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6">
      <div className="flex justify-between items-start border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">calculate</span>
            Motor de Cálculo: Mão de Obra
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Simulação dinâmica baseada no calendário do projeto e curva do histograma de equipe.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_month</span>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Carga Mensal Ativa</span>
            <span className="text-sm font-mono font-bold text-slate-800">{data.horas_mes_adotadas}h</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-emerald-600 text-3xl mb-2">person_add</span>
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Custo Admissional (Histograma)</span>
          <span className="text-2xl font-bold font-mono text-emerald-900">
            R$ {data.total_admission_costs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <p className="text-[10px] text-emerald-600 mt-2 opacity-80">Ref: Exames PCMSO alocados pontualmente na admissão.</p>
        </div>

        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-red-600 text-3xl mb-2">person_remove</span>
          <span className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Custo Demissional (Histograma)</span>
          <span className="text-2xl font-bold font-mono text-red-900">
            R$ {data.total_dismissal_costs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <p className="text-[10px] text-red-600 mt-2 opacity-80">Ref: Custos rescisórios pontuais do desligamento.</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-blue-600 text-3xl mb-2">schedule</span>
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Custo Horista (Composto)</span>
          <span className="text-2xl font-bold font-mono text-blue-900">
            R$ {data.total_hourly_rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /h
          </span>
          <p className="text-[10px] text-blue-600 mt-2 opacity-80">Salário Base + Leis Sociais + Encargos Gerais + EPIs.</p>
        </div>
      </div>
      
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">info</span>
          Regra de Compliance
        </h4>
        <p className="text-xs text-slate-600">
          Este motor executa simulações <strong>on-the-fly</strong>. Para Ordem de Serviços aprovadas e em execução, 
          estes valores são convertidos em <strong>Snapshots Históricos</strong> para garantir conformidade e evitar que alterações 
          sindicais ou contratuais afetem custos de obras já precificadas ou medidas.
        </p>
      </div>

      {data.pendencias && data.pendencias.length > 0 && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 mt-4">
          <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Log de Auditoria: Pendências para Definir
          </h4>
          <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
            {data.pendencias.map((pendencia: string, idx: number) => (
              <li key={idx}>{pendencia}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
