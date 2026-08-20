import React, { useState, useEffect } from 'react';
import { AuthSession } from '../types';

interface OSViewProps {
  authSession: AuthSession | null;
}

interface Projeto {
  id: string;
  nome_projeto: string;
  codigo_contrato: string;
}

interface ItemEAP {
  id: string;
  eap_codigo: string;
  descricao_servico: string;
  unidade_medida: string;
}

interface OS {
  id: string;
  numero_os: string;
  descricao: string;
  status: string;
  item_eap_id: string;
  equipe_id?: string;
  data_emissao: string;
  materiais?: string;
  valor_materiais?: number;
  ferramentas?: string;
  valor_ferramentas?: number;
  equipamentos?: string;
  valor_equipamentos?: number;
  responsavel_rdo_id?: string;
  created_at: string;
  itens_eap?: {
    descricao_servico: string;
    unidade_medida: string;
  };
  equipes?: {
    id: string;
    nome: string;
  };
  responsavel_rdo?: {
    id: string;
    nome: string;
  };
}

export const OSView: React.FC<OSViewProps> = ({ authSession }) => {
  // Filtros Globais
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>('');
  
  // Lista Master e Estado
  const [ordensServico, setOrdensServico] = useState<OS[]>([]);
  const [selectedOs, setSelectedOs] = useState<OS | null>(null);

  // EAP e Equipes Disponíveis (para dropdown de criação)
  const [itensEap, setItensEap] = useState<ItemEAP[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);

  // Controle de Visualização
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Estados do Formulário de Criação
  const [dataEmissao, setDataEmissao] = useState<string>(new Date().toISOString().split('T')[0]);
  const [numeroOs, setNumeroOs] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [selectedEapId, setSelectedEapId] = useState<string>('');
  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('');
  const [materiais, setMateriais] = useState<string>('');
  const [valorMateriais, setValorMateriais] = useState<string>('');
  const [ferramentas, setFerramentas] = useState<string>('');
  const [valorFerramentas, setValorFerramentas] = useState<string>('');
  const [equipamentos, setEquipamentos] = useState<string>('');
  const [valorEquipamentos, setValorEquipamentos] = useState<string>('');
  const [responsavelRdoId, setResponsavelRdoId] = useState<string>('');
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Carregar Projetos Iniciais e Equipes
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

    fetch('/api/equipes', {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setEquipes(data.data);
        }
      });
  }, [authSession]);

  // Carregar OS e itens EAP ao selecionar Projeto
  useEffect(() => {
    setOrdensServico([]);
    setSelectedOs(null);
    setIsCreating(false);
    setItensEap([]);
    if (!authSession || !selectedProjetoId) return;
    
    // Fetch OS
    fetch(`/api/ordens-servico?projeto_id=${selectedProjetoId}`, {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setOrdensServico(data.data);
        }
      });

    // Fetch EAP
    fetch(`/api/itens-eap?projeto_id=${selectedProjetoId}`, {
      headers: { Authorization: `Bearer ${authSession.idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items) {
          const analiticos = data.items.filter((item: any) => item.e_analitico);
          setItensEap(analiticos);
        }
      });
  }, [selectedProjetoId, authSession]);

  const handleCadastrarOs = () => {
    if (!selectedProjetoId) return alert('Selecione um Projeto primeiro.');
    setIsCreating(true);
    setIsEditing(false);
    setSelectedOs(null);
    setDataEmissao(new Date().toISOString().split('T')[0]);
    setNumeroOs('');
    setDescricao('');
    setSelectedEapId('');
    setSelectedEquipeId('');
    setMateriais('');
    setValorMateriais('');
    setFerramentas('');
    setValorFerramentas('');
    setEquipamentos('');
    setValorEquipamentos('');
    setResponsavelRdoId('');
  };

  const handleSalvarNovaOs = async () => {
    if (!selectedProjetoId) return alert('Projeto não selecionado.');
    if (!selectedEapId) return alert('Selecione um item da EAP.');
    
    setSaving(true);
    try {
      const payload = {
        projeto_id: selectedProjetoId,
        item_eap_id: selectedEapId,
        equipe_id: selectedEquipeId || undefined,
        numero_os: numeroOs.trim() || undefined,
        descricao: descricao,
        materiais: materiais || undefined,
        valor_materiais: valorMateriais || undefined,
        ferramentas: ferramentas || undefined,
        valor_ferramentas: valorFerramentas || undefined,
        equipamentos: equipamentos || undefined,
        valor_equipamentos: valorEquipamentos || undefined,
        responsavel_rdo_id: responsavelRdoId || undefined,
        data_emissao: dataEmissao
      };

      const response = await fetch('/api/ordens-servico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      
      if (resData.success) {
        alert('Ordem de Serviço criada com sucesso!');
        // Reload OS list
        fetch(`/api/ordens-servico?projeto_id=${selectedProjetoId}`, {
          headers: { Authorization: `Bearer ${authSession?.idToken}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) setOrdensServico(data.data);
        });
        setIsCreating(false);
      } else {
        alert(`Erro: ${resData.error}`);
      }
    } catch (err) {
      alert('Erro ao salvar OS');
    } finally {
      setSaving(false);
    }
  };

  const handleAtualizarOs = async () => {
    if (!selectedOs) return;
    if (!selectedEapId) return alert('Selecione um item da EAP.');
    
    setSaving(true);
    try {
      const payload = {
        item_eap_id: selectedEapId,
        equipe_id: selectedEquipeId || undefined,
        descricao: descricao,
        materiais: materiais || undefined,
        valor_materiais: valorMateriais || undefined,
        ferramentas: ferramentas || undefined,
        valor_ferramentas: valorFerramentas || undefined,
        equipamentos: equipamentos || undefined,
        valor_equipamentos: valorEquipamentos || undefined,
        responsavel_rdo_id: responsavelRdoId || undefined,
        data_emissao: dataEmissao
      };

      const response = await fetch(`/api/ordens-servico/${selectedOs.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      
      if (resData.success) {
        alert('Ordem de Serviço atualizada com sucesso!');
        fetch(`/api/ordens-servico?projeto_id=${selectedProjetoId}`, {
          headers: { Authorization: `Bearer ${authSession?.idToken}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setOrdensServico(data.data);
            setSelectedOs(resData.data);
          }
        });
        setIsEditing(false);
      } else {
        alert(`Erro: ${resData.error}`);
      }
    } catch (err) {
      alert('Erro ao atualizar OS');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletarOs = async () => {
    if (!selectedOs) return;
    const confirmDelete = window.confirm(`ATENÇÃO: Deseja realmente excluir a Ordem de Serviço ${selectedOs.numero_os}?\n\nEsta operação não pode ser desfeita e será registrada na auditoria.`);
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`/api/ordens-servico/${selectedOs.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authSession?.idToken}`
        }
      });
      const resData = await response.json();
      
      if (resData.success) {
        alert('Ordem de Serviço excluída com sucesso!');
        fetch(`/api/ordens-servico?projeto_id=${selectedProjetoId}`, {
          headers: { Authorization: `Bearer ${authSession?.idToken}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setOrdensServico(data.data);
            setSelectedOs(null);
          }
        });
      } else {
        alert(`Erro: ${resData.error}`);
      }
    } catch (err) {
      alert('Erro ao excluir OS');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-80px)] space-y-4">
      
      {/* ── HEADER / FILTROS GLOBAIS ── */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e1e2e8] flex flex-wrap gap-4 items-center">
        <h2 className="text-xl font-bold text-[#005daa] flex items-center gap-2 pr-6 border-r border-[#e1e2e8]">
          <span className="material-symbols-outlined">assignment</span>
          Ordens de Serviço
        </h2>
        
        <div className="flex-1 min-w-[300px] flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-[#707785]">1. Selecione o Projeto</label>
          <select
            value={selectedProjetoId}
            onChange={(e) => setSelectedProjetoId(e.target.value)}
            className="flex-1 max-w-md bg-[#f8fafc] border border-[#c0c7d6] text-[#191c1e] text-sm rounded-lg px-3 py-2 outline-none font-medium"
          >
            <option value="">Selecione um projeto...</option>
            {projetos.map(p => (
              <option key={p.id} value={p.id}>{p.nome_projeto} {p.codigo_contrato ? `(${p.codigo_contrato})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── SPLIT VIEW (MASTER / DETAIL) ── */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        
        {/* COLUNA ESQUERDA: LISTA DE OS (MASTER) */}
        <div className="w-1/3 bg-white rounded-xl shadow-sm border border-[#e1e2e8] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#e1e2e8] flex items-center justify-between bg-[#f8fafc]">
            <h3 className="font-bold text-[#191c1e]">Ordens Emitidas</h3>
            <button
              onClick={handleCadastrarOs}
              disabled={!selectedProjetoId}
              className="bg-[#005daa] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 hover:bg-[#004a88] transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nova OS
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {!selectedProjetoId ? (
              <p className="text-center text-sm text-[#707785] p-6">Selecione um projeto acima.</p>
            ) : ordensServico.length === 0 ? (
              <p className="text-center text-sm text-[#707785] p-6">Nenhuma OS encontrada para este projeto.</p>
            ) : (
              ordensServico.map(os => (
                <div
                  key={os.id}
                  onClick={() => { 
                    setSelectedOs(os); 
                    setIsCreating(false); 
                    setIsEditing(false); 
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedOs?.id === os.id
                      ? 'border-[#005daa] bg-[#eff6ff] shadow-sm'
                      : 'border-[#e1e2e8] hover:border-[#c0c7d6] hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[#191c1e] text-sm">{os.numero_os}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      os.status === 'Emitida' ? 'bg-sky-100 text-sky-800' : 
                      os.status === 'Em Andamento' ? 'bg-amber-100 text-amber-800' : 
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {os.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#707785] mb-2 truncate">
                    {os.itens_eap?.descricao_servico || 'Serviço'}
                  </div>
                  <div className="text-xs text-[#707785] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                    {new Date(os.data_emissao).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHE OU CRIAÇÃO */}
        <div className="w-2/3 bg-white rounded-xl shadow-sm border border-[#e1e2e8] flex flex-col overflow-y-auto">
          
          {/* VIEW: CRIAÇÃO OU EDIÇÃO DE OS */}
          {(isCreating || isEditing) && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#191c1e] border-b pb-3 mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa]">
                  {isEditing ? 'edit_document' : 'post_add'}
                </span>
                {isEditing ? `Editar Ordem de Serviço: ${selectedOs?.numero_os}` : 'Emitir Nova Ordem de Serviço'}
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Número da OS</label>
                  <input 
                    type="text" 
                    disabled
                    value={isEditing ? selectedOs?.numero_os : ''}
                    placeholder={isEditing ? '' : "Gerado Automaticamente"}
                    className="w-full border border-[#e1e2e8] bg-[#f8fafc] text-[#707785] rounded-lg p-2.5 outline-none text-sm cursor-not-allowed font-medium italic" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Data de Emissão *</label>
                  <input 
                    type="date" 
                    value={dataEmissao} 
                    onChange={e => setDataEmissao(e.target.value)} 
                    className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm" 
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Item da EAP (Atividade) *</label>
                <select 
                  value={selectedEapId} 
                  onChange={e => setSelectedEapId(e.target.value)} 
                  className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm"
                >
                  <option value="">Selecione o serviço a ser executado...</option>
                  {itensEap.map((item: any) => {
                      const uid = item.id || item.item_eap_id;
                      const linkedOs = ordensServico.find(os => os.item_eap_id === uid);
                      const isLinkedToCurrentEditing = isEditing && selectedOs?.item_eap_id === uid;
                      return (
                        <option key={uid} value={uid} disabled={!!linkedOs && !isLinkedToCurrentEditing} className={linkedOs && !isLinkedToCurrentEditing ? 'text-gray-400 italic' : ''}>
                          {item.eap_codigo} - {item.descricao_servico} ({item.unidade_medida})
                          {(linkedOs && !isLinkedToCurrentEditing) ? ` [VINCULADA: ${linkedOs.numero_os} - ${linkedOs.status}]` : ''}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Equipe Responsável de Execução (Opcional)</label>
                <select 
                  value={selectedEquipeId} 
                  onChange={e => {
                    setSelectedEquipeId(e.target.value);
                    setResponsavelRdoId(''); // Reset RDO responsible when team changes
                  }} 
                  className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm"
                >
                  <option value="">Selecione a equipe alocada...</option>
                  {equipes.map((eq: any) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nome} ({eq.empresa_nome})
                    </option>
                  ))}
                </select>
              </div>

              {selectedEquipeId && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Responsável pelo RDO (Opcional)</label>
                  <select 
                    value={responsavelRdoId} 
                    onChange={e => setResponsavelRdoId(e.target.value)} 
                    className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm"
                  >
                    <option value="">Selecione quem emitirá os relatórios (RDO)...</option>
                    {equipes.find(eq => eq.id === selectedEquipeId)?.membros?.map((m: any) => (
                      <option key={m.funcionario_id} value={m.funcionario_id}>
                        {m.nome} - {m.cargo} ({m.funcao_na_equipe})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Materiais</label>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="number" 
                      step="0.01"
                      value={valorMateriais} 
                      onChange={e => setValorMateriais(e.target.value)} 
                      className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm font-medium"
                      placeholder="Valor Estimado (R$)"
                    />
                    <textarea 
                      rows={2}
                      value={materiais} 
                      onChange={e => setMateriais(e.target.value)} 
                      className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm resize-none"
                      placeholder="Descrição dos Materiais..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Ferramentas</label>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="number" 
                      step="0.01"
                      value={valorFerramentas} 
                      onChange={e => setValorFerramentas(e.target.value)} 
                      className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm font-medium"
                      placeholder="Valor Estimado (R$)"
                    />
                    <textarea 
                      rows={2}
                      value={ferramentas} 
                      onChange={e => setFerramentas(e.target.value)} 
                      className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm resize-none"
                      placeholder="Descrição das Ferramentas..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Equipamentos</label>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="number" 
                      step="0.01"
                      value={valorEquipamentos} 
                      onChange={e => setValorEquipamentos(e.target.value)} 
                      className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm font-medium"
                      placeholder="Valor Estimado (R$)"
                    />
                    <textarea 
                      rows={2}
                      value={equipamentos} 
                      onChange={e => setEquipamentos(e.target.value)} 
                      className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm resize-none"
                      placeholder="Descrição dos Equipamentos..."
                    />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-bold text-[#707785] uppercase mb-1">Descrição / Instruções (Opcional)</label>
                <textarea 
                  rows={4}
                  value={descricao} 
                  onChange={e => setDescricao(e.target.value)} 
                  className="w-full border border-[#c0c7d6] rounded-lg p-2.5 outline-none focus:border-[#005daa] text-sm resize-none"
                  placeholder="Detalhes ou instruções para a equipe de execução..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#e1e2e8]">
                <button onClick={() => { setIsCreating(false); setIsEditing(false); }} className="px-5 py-2.5 border border-[#c0c7d6] rounded-lg font-bold text-[#707785] hover:bg-[#f8fafc]">Cancelar</button>
                <button onClick={isEditing ? handleAtualizarOs : handleSalvarNovaOs} disabled={saving} className="px-5 py-2.5 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold transition-colors">
                  {isEditing 
                    ? (saving ? 'Salvando...' : 'Salvar Alterações') 
                    : (saving ? 'Emitindo...' : 'Emitir Ordem de Serviço')}
                </button>
              </div>
            </div>
          )}

          {/* VIEW: VISUALIZAÇÃO DE OS */}
          {!isCreating && !isEditing && selectedOs && (
            <div className="p-6">
              <div className="flex justify-between items-start border-b border-[#e1e2e8] pb-4 mb-5">
                <div>
                  <h3 className="text-2xl font-bold text-[#191c1e]">{selectedOs.numero_os}</h3>
                  <p className="text-sm text-[#707785] flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    Emitida em: {new Date(selectedOs.data_emissao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 font-bold text-xs rounded-full uppercase ${
                    selectedOs.status === 'Emitida' ? 'bg-sky-100 text-sky-800' : 
                    selectedOs.status === 'Em Andamento' ? 'bg-amber-100 text-amber-800' : 
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedOs.status}
                  </span>
                  <button 
                    onClick={() => {
                      setDataEmissao(selectedOs.data_emissao.split('T')[0]);
                      setDescricao(selectedOs.descricao || '');
                      setSelectedEapId(selectedOs.item_eap_id);
                      setSelectedEquipeId(selectedOs.equipe_id || '');
                      setMateriais(selectedOs.materiais || '');
                      setValorMateriais(selectedOs.valor_materiais ? selectedOs.valor_materiais.toString() : '');
                      setFerramentas(selectedOs.ferramentas || '');
                      setValorFerramentas(selectedOs.valor_ferramentas ? selectedOs.valor_ferramentas.toString() : '');
                      setEquipamentos(selectedOs.equipamentos || '');
                      setValorEquipamentos(selectedOs.valor_equipamentos ? selectedOs.valor_equipamentos.toString() : '');
                      setResponsavelRdoId(selectedOs.responsavel_rdo_id || '');
                      setIsEditing(true);
                    }} 
                    className="p-1.5 text-slate-400 hover:text-[#005daa] hover:bg-blue-50 rounded-md transition-all cursor-pointer" 
                    title="Editar OS"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  {(authSession?.decodedToken?.role === 'GESTOR' || authSession?.decodedToken?.role === 'ADMIN') && (
                    <button 
                      onClick={handleDeletarOs} 
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer ml-1 border-l border-slate-200 pl-2" 
                      title="Excluir OS"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-[#e1e2e8] rounded-xl p-5 mb-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-[#707785] uppercase tracking-wider mb-1">Serviço Autorizado (EAP)</p>
                  <p className="text-lg font-bold text-[#005daa] mb-1">
                    {selectedOs.itens_eap?.descricao_servico || 'N/A'}
                  </p>
                  <p className="text-sm font-medium text-[#404753] bg-white border border-[#e1e2e8] inline-block px-2 py-0.5 rounded">
                    Unidade: {selectedOs.itens_eap?.unidade_medida || '-'}
                  </p>
                </div>

                {selectedOs.equipes && (
                  <div className="pt-3 border-t border-[#e1e2e8] grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-[#707785] uppercase tracking-wider mb-1">Equipe Executora Designada</p>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-[#005daa] font-bold text-xs rounded-lg flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">groups</span>
                          {selectedOs.equipes.nome}
                        </span>
                      </div>
                    </div>
                    {selectedOs.responsavel_rdo && (
                      <div>
                        <p className="text-xs font-bold text-[#707785] uppercase tracking-wider mb-1">Responsável pelo RDO</p>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs rounded-lg flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">person</span>
                            {selectedOs.responsavel_rdo.nome}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-[#e1e2e8] rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-[#191c1e] text-xs uppercase tracking-wide flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-slate-500">inventory_2</span> Materiais</h4>
                    <span className="font-bold text-[#005daa] text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedOs.valor_materiais || 0)}</span>
                  </div>
                  <div className="text-sm text-[#404753] whitespace-pre-wrap">{selectedOs.materiais || <span className="italic text-[#a0a5b1]">Não definido.</span>}</div>
                </div>
                <div className="bg-white border border-[#e1e2e8] rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-[#191c1e] text-xs uppercase tracking-wide flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-slate-500">handyman</span> Ferramentas</h4>
                    <span className="font-bold text-[#005daa] text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedOs.valor_ferramentas || 0)}</span>
                  </div>
                  <div className="text-sm text-[#404753] whitespace-pre-wrap">{selectedOs.ferramentas || <span className="italic text-[#a0a5b1]">Não definido.</span>}</div>
                </div>
                <div className="bg-white border border-[#e1e2e8] rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-[#191c1e] text-xs uppercase tracking-wide flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-slate-500">precision_manufacturing</span> Equipamentos</h4>
                    <span className="font-bold text-[#005daa] text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedOs.valor_equipamentos || 0)}</span>
                  </div>
                  <div className="text-sm text-[#404753] whitespace-pre-wrap">{selectedOs.equipamentos || <span className="italic text-[#a0a5b1]">Não definido.</span>}</div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-bold text-[#191c1e] text-sm uppercase tracking-wide mb-2 text-[#707785]">Instruções / Descrição</h4>
                <div className="p-4 bg-white border border-[#e1e2e8] rounded-lg text-sm text-[#404753] min-h-[100px] whitespace-pre-wrap">
                  {selectedOs.descricao || <span className="italic text-[#a0a5b1]">Nenhuma descrição detalhada.</span>}
                </div>
              </div>

              {/* Mocking a space where linked RDOs could be listed inside the OS view if needed, 
                  but the RDO tab already handles this perfectly. */}
              <div className="mt-8 pt-6 border-t border-[#e1e2e8]">
                <div className="flex items-center gap-2 text-[#005daa]">
                  <span className="material-symbols-outlined">info</span>
                  <p className="text-sm font-medium">Os registros diários (RDO) desta OS devem ser lançados na aba <strong>RDO's</strong>.</p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: NADA SELECIONADO (E NÃO CRIANDO NEM EDITANDO) */}
          {!isCreating && !isEditing && !selectedOs && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <span className="material-symbols-outlined text-[64px] text-[#e1e2e8] mb-4">assignment</span>
              <h3 className="text-lg font-bold text-[#404753]">Nenhuma OS selecionada</h3>
              <p className="text-[#707785] text-sm max-w-md mt-2">
                Selecione uma Ordem de Serviço na lista ao lado para visualizar os detalhes e o serviço vinculado, ou clique em "Nova OS" para autorizar uma atividade.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
