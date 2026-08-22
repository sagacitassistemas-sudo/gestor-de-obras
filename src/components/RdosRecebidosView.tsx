import React, { useState, useEffect } from 'react';
import { AuthSession } from '../types';

interface RdosRecebidosViewProps {
  authSession: AuthSession | null;
}

interface Projeto {
  id: string;
  nome_projeto: string;
}

interface OSGroup {
  id: string;
  numero_os: string;
  descricao: string;
  rdos: any[];
}

export const RdosRecebidosView: React.FC<RdosRecebidosViewProps> = ({ authSession }) => {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('');
  
  const [rdos, setRdos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [osGroups, setOsGroups] = useState<OSGroup[]>([]);

  // Modal de Detalhes
  const [selectedRdo, setSelectedRdo] = useState<any | null>(null);
  
  // Modal de Revisão
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewObservation, setReviewObservation] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Carregar Projetos Iniciais
  useEffect(() => {
    if (!authSession) return;
    fetch('/api/projetos', {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.projetos) setProjetos(data.projetos);
      });
  }, [authSession]);

  // Carregar RDOs do Projeto
  useEffect(() => {
    if (!authSession || !selectedProjetoId) {
      setRdos([]);
      return;
    }
    
    setLoading(true);
    fetch(`/api/rdos?projeto_id=${selectedProjetoId}`, {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          // Filtrar apenas RDOs que foram Enviados/Consolidados (exemplo: não são rascunhos)
          // Mas podemos mostrar todos por enquanto para teste, ou focar nos consolidados
          const rdosData = data.data; // .filter((r: any) => r.status !== 'Rascunho')
          setRdos(rdosData);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedProjetoId, authSession]);

  // Agrupar RDOs por OS
  useEffect(() => {
    const groupsMap = new Map<string, OSGroup>();
    
    rdos.forEach(rdo => {
      const osId = rdo.ordem_servico_id;
      if (!osId) return; // Ignore if no OS

      if (!groupsMap.has(osId)) {
        groupsMap.set(osId, {
          id: osId,
          numero_os: rdo.ordens_servico?.numero_os || 'Desconhecida',
          descricao: rdo.ordens_servico?.descricao || 'Sem descrição',
          rdos: []
        });
      }
      
      groupsMap.get(osId)?.rdos.push(rdo);
    });

    setOsGroups(Array.from(groupsMap.values()));
  }, [rdos]);

  // Handler para atualizar status
  const updateStatus = async (rdoId: string, status: string, observacao = '') => {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/rdos/${rdoId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ status, observacao_revisao: observacao })
      });
      
      const resData = await res.json();
      if (resData.success) {
        // Update local state
        setRdos(prev => prev.map(r => r.id === rdoId ? { ...r, status, observacao_revisao: observacao } : r));
        setSelectedRdo(null);
        setIsReviewModalOpen(false);
      } else {
        alert('Erro ao atualizar RDO: ' + resData.error);
      }
    } catch (err) {
      alert('Erro de conexão ao atualizar status do RDO.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAprovar = () => {
    if (!selectedRdo) return;
    if (confirm(`Deseja aprovar o ${selectedRdo.numero_rdo}?`)) {
      updateStatus(selectedRdo.id, 'Aprovado');
    }
  };

  const handleRevisar = () => {
    if (!selectedRdo) return;
    setReviewObservation(selectedRdo.observacao_revisao || '');
    setIsReviewModalOpen(true);
  };
  
  const submitRevisao = () => {
    if (!reviewObservation.trim()) return alert('Insira uma observação para solicitar revisão.');
    updateStatus(selectedRdo.id, 'Em Revisão', reviewObservation);
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-80px)] space-y-4">
      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e1e2e8] flex flex-wrap gap-4 items-center">
        <h2 className="text-xl font-bold text-[#005daa] flex items-center gap-2 pr-6 border-r border-[#e1e2e8]">
          <span className="material-symbols-outlined">inbox</span>
          RDOs Recebidos
        </h2>
        
        <div className="flex-1 min-w-[200px] flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-[#707785]">Projeto</label>
          <select
            value={selectedProjetoId}
            onChange={(e) => setSelectedProjetoId(e.target.value)}
            className="flex-1 max-w-sm bg-[#f8fafc] border border-[#c0c7d6] text-[#191c1e] text-sm rounded-lg px-3 py-2 outline-none font-medium"
          >
            <option value="">Selecione um projeto...</option>
            {projetos.map(p => (
              <option key={p.id} value={p.id}>{p.nome_projeto}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTA AGRUPADA POR OS */}
      <div className="flex-1 overflow-y-auto">
        {!selectedProjetoId ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-[#e1e2e8]">
            <span className="material-symbols-outlined text-[48px] text-[#c0c7d6] mb-4">domain</span>
            <p className="text-[#707785]">Selecione um projeto para listar os RDOs recebidos.</p>
          </div>
        ) : loading ? (
          <div className="text-center p-8">Carregando RDOs...</div>
        ) : osGroups.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-xl border border-[#e1e2e8] text-[#707785]">Nenhum RDO encontrado neste projeto.</div>
        ) : (
          <div className="space-y-6">
            {osGroups.map(group => (
              <div key={group.id} className="bg-white rounded-xl shadow-sm border border-[#e1e2e8] overflow-hidden">
                
                {/* Header da OS */}
                <div className="bg-[#f8fafc] p-4 border-b border-[#e1e2e8] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#005daa]">engineering</span>
                    <div>
                      <h3 className="font-bold text-[#191c1e]">{group.numero_os}</h3>
                      <p className="text-xs text-[#707785]">{group.descricao}</p>
                    </div>
                  </div>
                  {/* % de Conclusão Placeholder (MOCK) */}
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase text-[#707785] mb-1">Avanço OS (Aprox.)</p>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="bg-[#10b981] h-2 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                      <span className="text-xs font-bold text-[#191c1e]">45%</span>
                    </div>
                  </div>
                </div>

                {/* Lista de RDOs da OS */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.rdos.map(rdo => (
                    <div 
                      key={rdo.id} 
                      onClick={() => setSelectedRdo(rdo)}
                      className="border border-[#e1e2e8] rounded-lg p-4 cursor-pointer hover:border-[#005daa] hover:shadow-md transition-all bg-white relative group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-[#005daa]">{rdo.numero_rdo}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rdo.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' : 
                          rdo.status === 'Em Revisão' ? 'bg-rose-100 text-rose-800' :
                          rdo.status === 'Consolidado' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {rdo.status}
                        </span>
                      </div>
                      
                      <div className="text-xs text-[#707785] space-y-1 mb-3">
                        <p className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> {new Date(rdo.data_rdo).toLocaleDateString('pt-BR')}</p>
                        <p className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">person</span> {rdo.responsavel?.name || 'Desconhecido'}</p>
                      </div>

                      <div className="border-t pt-2 flex justify-between items-center text-xs">
                        <span className="font-medium text-[#191c1e]">{rdo.rdo_items?.length || 0} Itens</span>
                        <span className="material-symbols-outlined text-[#c0c7d6] group-hover:text-[#005daa]">open_in_new</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: DETALHES DO RDO */}
      {selectedRdo && !isReviewModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-[#e1e2e8] flex justify-between items-center bg-[#f8fafc] rounded-t-2xl">
              <div>
                <h3 className="text-xl font-black text-[#191c1e]">{selectedRdo.numero_rdo}</h3>
                <p className="text-sm text-[#707785] mt-1">Data: {new Date(selectedRdo.data_rdo).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => setSelectedRdo(null)} className="text-[#707785] hover:text-[#191c1e]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content Modal */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {selectedRdo.status === 'Em Revisão' && selectedRdo.observacao_revisao && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
                  <div className="font-bold flex items-center gap-1 mb-1"><span className="material-symbols-outlined text-[16px]">warning</span> Motivo da Revisão (Enviado ao Emitente):</div>
                  <p>{selectedRdo.observacao_revisao}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e1e2e8]">
                  <p className="text-[10px] font-bold uppercase text-[#707785]">Clima (Manhã)</p>
                  <p className="font-medium text-sm">{selectedRdo.clima_manha}</p>
                </div>
                <div className="bg-[#f8fafc] p-3 rounded-lg border border-[#e1e2e8]">
                  <p className="text-[10px] font-bold uppercase text-[#707785]">Clima (Tarde)</p>
                  <p className="font-medium text-sm">{selectedRdo.clima_tarde}</p>
                </div>
              </div>

              <h4 className="font-bold text-[#191c1e] border-b pb-2 mb-3">Apontamentos Realizados</h4>
              {selectedRdo.rdo_items && selectedRdo.rdo_items.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f8fafc] border-b">
                      <tr>
                        <th className="p-3 text-xs uppercase text-[#707785]">Serviço (EAP)</th>
                        <th className="p-3 text-xs uppercase text-[#707785]">Unid.</th>
                        <th className="p-3 text-xs uppercase text-[#707785] text-right">Qtd Executada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRdo.rdo_items.map((item: any) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="p-3 font-medium text-[#191c1e]">{item.itens_eap?.descricao_servico}</td>
                          <td className="p-3 text-[#707785]">{item.itens_eap?.unidade_medida}</td>
                          <td className="p-3 text-right font-black text-[#005daa]">{item.qtd_medida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[#707785] italic">Nenhum item apontado neste RDO.</p>
              )}
            </div>

            {/* Footer / Actions Modal */}
            <div className="p-4 border-t border-[#e1e2e8] bg-[#f8fafc] rounded-b-2xl flex justify-between items-center">
              <div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                    selectedRdo.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' : 
                    selectedRdo.status === 'Em Revisão' ? 'bg-rose-100 text-rose-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    Status Atual: {selectedRdo.status}
                </span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleRevisar}
                  className="px-4 py-2 border border-rose-300 text-rose-700 font-bold rounded-lg hover:bg-rose-50 transition-colors text-sm"
                >
                  Solicitar Revisão
                </button>
                <button 
                  onClick={handleAprovar}
                  className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors text-sm shadow-sm"
                >
                  Aprovar RDO
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SUB-MODAL: REVISAR */}
      {isReviewModalOpen && selectedRdo && (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-rose-700 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>
              Solicitar Revisão ao Campo
            </h3>
            <p className="text-sm text-[#707785] mb-4">
              O RDO <strong className="text-black">{selectedRdo.numero_rdo}</strong> será devolvido ao emitente. Justifique abaixo o motivo da rejeição.
            </p>

            <textarea
              value={reviewObservation}
              onChange={(e) => setReviewObservation(e.target.value)}
              placeholder="Ex: A quantidade do item 3 está diferente do planejado..."
              className="w-full border border-gray-300 rounded-lg p-3 min-h-[120px] text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none resize-none"
            ></textarea>

            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 border rounded-md font-bold text-gray-600 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={submitRevisao}
                disabled={savingStatus}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-md text-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {savingStatus ? 'Enviando...' : 'Confirmar Revisão'}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};
