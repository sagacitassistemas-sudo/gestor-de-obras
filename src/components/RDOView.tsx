import React, { useState, useEffect } from 'react';
import { AuthSession } from '../types';

interface RDOViewProps {
  authSession: AuthSession | null;
}

interface Projeto {
  id: string;
  nome_projeto: string;
  codigo_contrato: string;
}

interface OS {
  id: string;
  numero_os: string;
  descricao: string;
  status: string;
  item_eap_id: string;
  itens_eap?: {
    descricao_servico: string;
    unidade_medida: string;
  };
}

interface RDOItem {
  id: string;
  item_eap_id: string;
  qtd_medida: number;
  valor_total_dia: number;
  itens_eap?: {
    descricao_servico: string;
    unidade_medida: string;
  };
}

interface RDO {
  id: string;
  numero_rdo: string;
  data_rdo: string;
  status: string;
  clima_manha: string;
  clima_tarde: string;
  rdo_items?: RDOItem[];
}

interface RDOItemForm {
  id: string;
  item_eap_id: string;
  qtd_medida_hoje: number;
  fotos: File[];
}

export const RDOView: React.FC<RDOViewProps> = ({ authSession }) => {
  // Filtros Globais
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('');
  
  const [ordensServico, setOrdensServico] = useState<OS[]>([]);
  const [selectedOsId, setSelectedOsId] = useState<string>('');

  // Lista Master e Estado
  const [rdos, setRdos] = useState<RDO[]>([]);
  const [selectedRdo, setSelectedRdo] = useState<RDO | null>(null);

  // Controle de Visualização
  const [isCreating, setIsCreating] = useState(false);

  // Estados do Formulário de Criação
  const [dataRdo, setDataRdo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [climaManha, setClimaManha] = useState<string>('BOM');
  const [climaTarde, setClimaTarde] = useState<string>('BOM');
  const [lancamentos, setLancamentos] = useState<RDOItemForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Carregar Projetos Iniciais
  useEffect(() => {
    if (!authSession) return;
    setLoading(true);
    fetch('/api/projetos', {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.projetos) {
          setProjetos(data.projetos);
        }
      })
      .finally(() => setLoading(false));
  }, [authSession]);

  // Carregar OS ao selecionar Projeto
  useEffect(() => {
    setSelectedOsId('');
    setOrdensServico([]);
    if (!authSession || !selectedProjetoId) return;
    
    fetch(`/api/ordens-servico?projeto_id=${selectedProjetoId}`, {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setOrdensServico(data.data);
        }
      });
  }, [selectedProjetoId, authSession]);

  // Carregar RDOs ao selecionar OS
  useEffect(() => {
    setRdos([]);
    setSelectedRdo(null);
    setIsCreating(false);
    if (!authSession || !selectedOsId) return;

    fetch(`/api/rdos?ordem_servico_id=${selectedOsId}`, {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setRdos(data.data);
        }
      });
  }, [selectedOsId, authSession]);

  const handleCadastrarRdo = () => {
    if (!selectedOsId) return alert('Selecione uma Ordem de Serviço primeiro.');
    setIsCreating(true);
    setSelectedRdo(null);
    setDataRdo(new Date().toISOString().split('T')[0]);
    
    // Inicia com a EAP associada a OS
    const osSelected = ordensServico.find(os => os.id === selectedOsId);
    if (osSelected) {
      setLancamentos([{
        id: Date.now().toString(),
        item_eap_id: osSelected.item_eap_id,
        qtd_medida_hoje: 0,
        fotos: []
      }]);
    } else {
      setLancamentos([]);
    }
  };

  const handleUpdateLancamento = (id: string, field: keyof RDOItemForm, value: any) => {
    setLancamentos(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleSalvarNovoRdo = async () => {
    if (!selectedProjetoId || !selectedOsId) return alert('Projeto ou OS não selecionado.');
    if (lancamentos.length === 0) return alert('Adicione apontamentos.');
    
    setSaving(true);
    try {
      const payload = {
        projeto_id: selectedProjetoId,
        ordem_servico_id: selectedOsId,
        data_rdo: dataRdo,
        clima_manha: climaManha,
        clima_tarde: climaTarde,
        itens: lancamentos
      };

      const response = await fetch('/api/rdos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      
      if (resData.success) {
        alert('RDO Salvo com sucesso!');
        // Atualiza a lista master recarregando do banco ou localmente
        fetch(`/api/rdos?ordem_servico_id=${selectedOsId}`, {
          headers: { Authorization: `Bearer ${authSession?.idToken}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) setRdos(data.data);
        });
        setIsCreating(false);
      } else {
        alert(`Erro: ${resData.error}`);
      }
    } catch (err) {
      alert('Erro ao salvar RDO');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-80px)] space-y-4">
      
      {/* ── HEADER / FILTROS GLOBAIS ── */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e1e2e8] flex flex-wrap gap-4 items-center">
        <h2 className="text-xl font-bold text-[#005daa] flex items-center gap-2 pr-6 border-r border-[#e1e2e8]">
          <span className="material-symbols-outlined">fact_check</span>
          RDOs
        </h2>
        
        <div className="flex-1 min-w-[200px] flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-[#707785]">1. Projeto</label>
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

        <div className="flex-1 min-w-[200px] flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-[#707785]">2. OS Associada</label>
          <select
            value={selectedOsId}
            onChange={(e) => setSelectedOsId(e.target.value)}
            disabled={!selectedProjetoId}
            className="flex-1 max-w-sm bg-[#f8fafc] border border-[#c0c7d6] text-[#191c1e] text-sm rounded-lg px-3 py-2 outline-none font-medium disabled:opacity-50"
          >
            <option value="">Selecione uma Ordem de Serviço...</option>
            {ordensServico.map(os => (
              <option key={os.id} value={os.id}>{os.numero_os} - {os.descricao}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── SPLIT VIEW (MASTER / DETAIL) ── */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        
        {/* COLUNA ESQUERDA: LISTA DE RDOs (MASTER) */}
        <div className="w-1/3 bg-white rounded-xl shadow-sm border border-[#e1e2e8] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#e1e2e8] flex items-center justify-between bg-[#f8fafc]">
            <h3 className="font-bold text-[#191c1e]">Diários Registrados</h3>
            <button
              onClick={handleCadastrarRdo}
              disabled={!selectedOsId}
              className="bg-[#005daa] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 hover:bg-[#004a88] transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Novo RDO
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {!selectedOsId ? (
              <p className="text-center text-sm text-[#707785] p-6">Selecione uma OS acima.</p>
            ) : rdos.length === 0 ? (
              <p className="text-center text-sm text-[#707785] p-6">Nenhum RDO encontrado para esta OS.</p>
            ) : (
              rdos.map(rdo => (
                <div
                  key={rdo.id}
                  onClick={() => { setSelectedRdo(rdo); setIsCreating(false); }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedRdo?.id === rdo.id
                      ? 'border-[#005daa] bg-[#eff6ff] shadow-sm'
                      : 'border-[#e1e2e8] hover:border-[#c0c7d6] hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[#191c1e] text-sm">{rdo.numero_rdo}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rdo.status === 'Rascunho' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {rdo.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#707785] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {new Date(rdo.data_rdo).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-xs font-bold text-[#005daa] mt-2">
                    {rdo.rdo_items?.length} Apontamento(s)
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHE OU CRIAÇÃO */}
        <div className="w-2/3 bg-white rounded-xl shadow-sm border border-[#e1e2e8] flex flex-col overflow-y-auto">
          
          {/* VIEW: CRIAÇÃO DE NOVO RDO */}
          {isCreating && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#191c1e] border-b pb-3 mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa]">note_add</span>
                Cadastrar Novo RDO
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Data *</label>
                  <input type="date" value={dataRdo} onChange={e => setDataRdo(e.target.value)} className="w-full border rounded p-2" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Clima Manhã</label>
                    <select value={climaManha} onChange={e => setClimaManha(e.target.value)} className="w-full border rounded p-2 text-sm">
                      <option value="BOM">Bom</option>
                      <option value="CHUVA_LEVE">Chuva Leve</option>
                      <option value="CHUVA_FORTE">Chuva Forte</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Clima Tarde</label>
                    <select value={climaTarde} onChange={e => setClimaTarde(e.target.value)} className="w-full border rounded p-2 text-sm">
                      <option value="BOM">Bom</option>
                      <option value="CHUVA_LEVE">Chuva Leve</option>
                      <option value="CHUVA_FORTE">Chuva Forte</option>
                    </select>
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-[#191c1e] mb-3">Produção e Apontamentos</h4>
              <div className="border rounded-lg overflow-hidden mb-6">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f8fafc] border-b">
                    <tr>
                      <th className="p-3 text-xs uppercase text-[#707785]">Item (EAP)</th>
                      <th className="p-3 text-xs uppercase text-[#707785] w-32">Qtd Medida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map(lanc => (
                      <tr key={lanc.id} className="border-b last:border-0">
                        <td className="p-3 text-[#191c1e] font-medium">
                          {ordensServico.find(o => o.id === selectedOsId)?.itens_eap?.descricao_servico}
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" step="0.01" min="0" 
                            value={lanc.qtd_medida_hoje} 
                            onChange={e => handleUpdateLancamento(lanc.id, 'qtd_medida_hoje', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded p-1.5 text-right font-bold text-[#005daa]" 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setIsCreating(false)} className="px-4 py-2 border rounded font-bold text-[#707785]">Cancelar</button>
                <button onClick={handleSalvarNovoRdo} disabled={saving} className="px-4 py-2 bg-[#005daa] text-white rounded font-bold">{saving ? 'Salvando...' : 'Salvar RDO'}</button>
              </div>
            </div>
          )}

          {/* VIEW: VISUALIZAÇÃO DE RDO */}
          {!isCreating && selectedRdo && (
            <div className="p-6">
              <div className="flex justify-between items-start border-b pb-4 mb-5">
                <div>
                  <h3 className="text-xl font-bold text-[#191c1e]">{selectedRdo.numero_rdo}</h3>
                  <p className="text-sm text-[#707785] flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    {new Date(selectedRdo.data_rdo).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className={`px-3 py-1 font-bold text-xs rounded-full ${selectedRdo.status === 'Rascunho' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {selectedRdo.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8 bg-[#f8fafc] p-4 rounded-lg border border-[#e1e2e8]">
                <div>
                  <p className="text-xs uppercase text-[#707785] font-bold">Clima Manhã</p>
                  <p className="font-medium">{selectedRdo.clima_manha}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-[#707785] font-bold">Clima Tarde</p>
                  <p className="font-medium">{selectedRdo.clima_tarde}</p>
                </div>
              </div>

              <h4 className="font-bold text-[#191c1e] mb-3 border-b pb-2">Apontamentos Realizados</h4>
              <div className="space-y-3">
                {selectedRdo.rdo_items?.map(item => (
                  <div key={item.id} className="p-4 border border-[#e1e2e8] rounded-lg shadow-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-[#191c1e]">{item.itens_eap?.descricao_servico || 'Serviço'}</p>
                      <p className="text-xs text-[#707785] uppercase mt-1">Unidade: {item.itens_eap?.unidade_medida || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#005daa]">{item.qtd_medida}</p>
                      <p className="text-[10px] uppercase font-bold text-[#707785]">Qtd Executada</p>
                    </div>
                  </div>
                ))}
                {(!selectedRdo.rdo_items || selectedRdo.rdo_items.length === 0) && (
                  <p className="text-sm text-[#707785] italic">Nenhum item apontado.</p>
                )}
              </div>
            </div>
          )}

          {/* VIEW: NADA SELECIONADO (E NÃO CRIANDO) */}
          {!isCreating && !selectedRdo && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <span className="material-symbols-outlined text-[64px] text-[#e1e2e8] mb-4">fact_check</span>
              <h3 className="text-lg font-bold text-[#404753]">Nenhum RDO selecionado</h3>
              <p className="text-[#707785] text-sm max-w-md mt-2">
                Selecione um Relatório Diário de Obra na lista ao lado para visualizar seus detalhes, ou clique em "Novo RDO" para cadastrar o dia atual.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
