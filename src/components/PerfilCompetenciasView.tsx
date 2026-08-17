import React, { useState, useEffect } from 'react';
import { Target, HardHat, TrendingUp, AlertTriangle, ShieldCheck, FileCheck, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { AuthSession } from '../types';

interface PerfilCompetenciasProps {
  funcionarioId: string;
  especialidadeId: string;
  authSession: AuthSession | null;
}

export const PerfilCompetenciasView: React.FC<PerfilCompetenciasProps> = ({ funcionarioId, especialidadeId, authSession }) => {
  const [competencias, setCompetencias] = useState<any[]>([]);
  const [treinamentos, setTreinamentos] = useState<any>({ feitos: [], exigidos: [] });
  const [rdoEligibility, setRdoEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [funcionarioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user auth token
      const token = authSession?.idToken;

      if (!token) return;

      // Fetch Competencies Catalog
      const compRes = await fetch(`/api/competencias/especialidade/${especialidadeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (compRes.ok) {
        const cData = await compRes.json();
        setCompetencias(cData.competencias || []);
      }

      // Fetch Treinamentos Status
      const trRes = await fetch(`/api/funcionarios/${funcionarioId}/treinamentos-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (trRes.ok) {
        const tData = await trRes.json();
        setTreinamentos({ feitos: tData.treinamentos, exigidos: tData.exigidos });
      }

      // Fetch RDO Eligibility
      const rdoRes = await fetch(`/api/funcionarios/${funcionarioId}/rdo-eligibility`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (rdoRes.ok) {
        const rData = await rdoRes.json();
        setRdoEligibility(rData.eligibility);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Carregando perfil de competências...</div>;
  }

  const renderProgress = (val: number, max: number) => {
    const pct = (val / max) * 100;
    const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }}></div>
      </div>
    );
  };

  const agrupadas = competencias.reduce((acc: any, c: any) => {
    if (!acc[c.eixo]) acc[c.eixo] = [];
    acc[c.eixo].push(c);
    return acc;
  }, {});

  const getTreinamentoStatus = (nomeCurso: string) => {
    const feito = treinamentos.feitos?.find((t: any) => t.nome_curso === nomeCurso);
    if (!feito) return { label: 'Pendente', color: 'text-red-500', icon: <AlertTriangle size={16} className="inline mr-1" /> };
    if (feito.status === 'Vencido') return { label: 'Vencido', color: 'text-red-500', icon: <AlertTriangle size={16} className="inline mr-1" /> };
    if (feito.status === 'A Vencer') return { label: 'A Vencer', color: 'text-yellow-500', icon: <ShieldCheck size={16} className="inline mr-1" /> };
    return { label: 'Regular', color: 'text-green-600', icon: <CheckCircle2 size={16} className="inline mr-1" /> };
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Target className="mr-2 text-blue-600" /> Avaliação de Desempenho 360
          </h2>
          <p className="text-sm text-gray-500 mt-1">Matriz de Competências e Habilidades do Colaborador</p>
        </div>
        
        {/* RDO Eligibility Badge */}
        {rdoEligibility && (
          <div className={`px-4 py-2 rounded-lg flex items-center shadow-sm border ${rdoEligibility.can_sign_rdo ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
            <FileCheck className="mr-2" size={20} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">Assinatura de RDO</p>
              <p className="text-sm">{rdoEligibility.can_sign_rdo ? 'Elegível (Liderança Média >=3)' : 'Não Elegível'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {['Tecnicas', 'Calculo', 'Comunicacao', 'SSMA'].map((eixo) => (
          <div key={eixo} className="bg-gray-50 rounded-lg p-4 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-700 uppercase text-xs tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
              {eixo}
              <TrendingUp size={14} className="text-gray-400" />
            </h3>
            
            <div className="space-y-4">
              {(agrupadas[eixo] || []).map((comp: any) => (
                <div key={comp.id} className="text-sm">
                  <p className="text-gray-800 font-medium leading-tight mb-1">{comp.descricao}</p>
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-gray-500">Peso Esperado: {comp.peso_esperado}</span>
                    {/* Simulated current score for UI mockup - In a real app, this comes from 'nota_alcancada' of the latest evaluation */}
                    <span className="text-xs font-bold text-blue-600">Alcançado: {Math.max(1, comp.peso_esperado - Math.floor(Math.random() * 2))}</span>
                  </div>
                  {renderProgress(Math.max(1, comp.peso_esperado - Math.floor(Math.random() * 2)), 5)}
                </div>
              ))}
              {(!agrupadas[eixo] || agrupadas[eixo].length === 0) && (
                <p className="text-xs text-gray-400 italic">Sem competências mapeadas.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Seção de SSMA e NRs (Integração) */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center mb-4">
          <HardHat className="mr-2 text-orange-500" /> Matriz de Treinamentos SSMA Obrigatórios
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {treinamentos.exigidos?.map((exigido: any, idx: number) => {
            const sts = getTreinamentoStatus(exigido.treinamento_obrigatorio);
            return (
              <div key={idx} className={`p-4 rounded-lg border ${sts.color.replace('text-', 'border-').replace('500', '200').replace('600', '200')} bg-white shadow-sm flex items-center justify-between`}>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-800">{exigido.treinamento_obrigatorio}</span>
                  <span className={`text-xs font-semibold mt-1 ${sts.color}`}>
                    {sts.icon} {sts.label}
                  </span>
                </div>
              </div>
            );
          })}
          {(!treinamentos.exigidos || treinamentos.exigidos.length === 0) && (
             <p className="text-sm text-gray-500 italic">Esta especialidade não possui certificações obrigatórias mapeadas.</p>
          )}
        </div>
      </div>

    </div>
  );
};
