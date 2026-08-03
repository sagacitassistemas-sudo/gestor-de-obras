import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ProjetosEapViewProps {
  authSession?: any;
}

export const ProjetosEapView: React.FC<ProjetosEapViewProps> = ({ authSession }) => {
  // Estados para Projetos
  const [projetos, setProjetos] = useState<any[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<any>(null);
  const [projetoForm, setProjetoForm] = useState({ nome_projeto: '', data_inicio: '' });

  // Estados para EAP
  const [eapData, setEapData] = useState<any[]>([]);
  const [eapItemIds, setEapItemIds] = useState<Record<string, string>>({}); // codigo -> id
  const [editingEap, setEditingEap] = useState<any>(null);
  const [eapForm, setEapForm] = useState({
    eap_codigo: '',
    descricao_servico: '',
    unidade_medida: '',
    preco_unitario: '',
    quantidade_contratada: '',
    e_analitico: false,
    ordem: 0
  });

  // Pipeline State
  const [pipelineState, setPipelineState] = useState<'idle' | 'editing_project' | 'editing_eap'>('idle');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'projeto' | 'eap'; id: string } | null>(null);

  useEffect(() => {
    fetchProjetos();
  }, []);

  const fetchProjetos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('projetos').select('*').order('created_at', { ascending: false });
    if (!error) {
      setProjetos(data || []);
      if (data && data.length > 0 && !selectedProjetoId) {
        setSelectedProjetoId(data[0].id);
        fetchEap(data[0].id);
      } else if (selectedProjetoId) {
        fetchEap(selectedProjetoId);
      }
    }
    setLoading(false);
  };

  const fetchEap = async (projetoId: string) => {
    setLoading(true);
    const viewReq = supabase.from('v_resumo_eap_medicao').select('*').eq('projeto_id', projetoId);
    const tableReq = supabase.from('itens_eap').select('*').eq('projeto_id', projetoId);

    const [viewRes, tableRes] = await Promise.all([viewReq, tableReq]);
    
    if (viewRes.data && tableRes.data) {
      const idsMap: Record<string, string> = {};
      tableRes.data.forEach(t => {
        idsMap[t.eap_codigo] = t.id;
      });
      setEapItemIds(idsMap);
      setEapData(viewRes.data);
    }
    setLoading(false);
  };

  const handleProjetoClick = (id: string) => {
    setSelectedProjetoId(id);
    fetchEap(id);
    if (pipelineState !== 'idle') {
      setPipelineState('idle');
    }
  };

  const getDepth = (codigo: string) => {
    if (!codigo) return 0;
    return codigo.split('.').length - 1;
  };

  const formatCurrency = (val: number) => {
    if (val == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const parseEapMask = (val: string) => {
    let cleaned = val.replace(/[^\d.]/g, '');
    cleaned = cleaned.replace(/\.+/g, '.');
    if (cleaned.startsWith('.')) cleaned = cleaned.substring(1);
    const parts = cleaned.split('.');
    if (parts.length > 3) {
      cleaned = parts.slice(0, 3).join('.');
    }
    return cleaned;
  };

  // ----- CRUD PROJETO -----
  const openNewProjeto = () => {
    setEditingProjeto(null);
    setProjetoForm({ nome_projeto: '', data_inicio: new Date().toISOString().split('T')[0] });
    setPipelineState('editing_project');
  };

  const openEditProjeto = (proj: any) => {
    setEditingProjeto(proj);
    setProjetoForm({ nome_projeto: proj.nome_projeto, data_inicio: proj.data_inicio.split('T')[0] });
    setPipelineState('editing_project');
  };

  const saveProjeto = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || authSession?.idToken;
    
    const res = await fetch('/api/projetos', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id: editingProjeto?.id,
        nome_projeto: projetoForm.nome_projeto,
        data_inicio: projetoForm.data_inicio
      })
    });
    if (res.ok) {
      setPipelineState('idle');
      fetchProjetos();
    }
  };

  // ----- CRUD EAP -----
  const openNewEap = () => {
    setEditingEap(null);
    setEapForm({
      eap_codigo: '', descricao_servico: '', unidade_medida: '',
      preco_unitario: '', quantidade_contratada: '', e_analitico: false, ordem: 0
    });
    setPipelineState('editing_eap');
  };

  const openEditEap = async (eapCodigo: string) => {
    const id = eapItemIds[eapCodigo];
    if (!id) return;
    const { data } = await supabase.from('itens_eap').select('*').eq('id', id).single();
    if (data) {
      setEditingEap(data);
      setEapForm({
        eap_codigo: data.eap_codigo,
        descricao_servico: data.descricao_servico,
        unidade_medida: data.unidade_medida || '',
        preco_unitario: data.preco_unitario.toString(),
        quantidade_contratada: data.quantidade_contratada.toString(),
        e_analitico: data.e_analitico,
        ordem: data.ordem
      });
      setPipelineState('editing_eap');
    }
  };

  const saveEap = async () => {
    if (!selectedProjetoId) return;

    const parts = eapForm.eap_codigo.split('.');
    let eap_pai_codigo = '';
    if (parts.length > 1) {
      eap_pai_codigo = parts.slice(0, parts.length - 1).join('.');
    }

    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || authSession?.idToken;

    const res = await fetch('/api/itens-eap', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id: editingEap?.id,
        projeto_id: selectedProjetoId,
        eap_codigo: eapForm.eap_codigo,
        eap_pai_codigo,
        descricao_servico: eapForm.descricao_servico,
        unidade_medida: eapForm.unidade_medida,
        preco_unitario: eapForm.preco_unitario,
        quantidade_contratada: eapForm.quantidade_contratada,
        e_analitico: eapForm.e_analitico,
        ordem: eapForm.ordem
      })
    });
    if (res.ok) {
      setPipelineState('idle');
      fetchEap(selectedProjetoId);
    }
  };

  // ----- DELETE -----
  const confirmDelete = async () => {
    if (!deleteModal) return;
    
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || authSession?.idToken;

    if (deleteModal.type === 'projeto') {
      await fetch('/api/projetos', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: deleteModal.id })
      });
      if (selectedProjetoId === deleteModal.id) {
        setSelectedProjetoId(null);
        setPipelineState('idle');
      }
      fetchProjetos();
    } else {
      await fetch('/api/itens-eap', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: deleteModal.id })
      });
      if (selectedProjetoId) fetchEap(selectedProjetoId);
      setPipelineState('idle');
    }
    setDeleteModal(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-display text-[#191c1e]">Projetos EAP e Medições</h1>
          <p className="text-body-md text-[#707785]">Acompanhamento da Estrutura Analítica de Projetos e Execução Físico-Financeira</p>
        </div>
        <div className="flex gap-2">
          {selectedProjetoId && (
            <button 
              onClick={openNewEap} 
              className="px-4 py-2 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#004a88] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nova Etapa EAP
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${pipelineState !== 'idle' ? 'xl:grid-cols-5 lg:grid-cols-4' : 'lg:grid-cols-4'} gap-6 transition-all duration-300 items-start`}>
        {/* Sidebar Projetos */}
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden lg:col-span-1 h-fit sticky top-6">
          <div className="p-4 border-b border-[#e1e2e8] bg-[#f7f9fb] flex justify-between items-center">
            <h2 className="font-label-bold text-[#191c1e]">Projetos</h2>
            <button onClick={openNewProjeto} className="text-[#005daa] hover:bg-[#d4e3ff] p-1.5 rounded cursor-pointer transition-colors" title="Adicionar Projeto">
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
          <div className="p-2 space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto">
            {projetos.map(proj => (
              <div 
                key={proj.id} 
                className={`group p-3 rounded-lg cursor-pointer transition-colors relative ${selectedProjetoId === proj.id ? 'bg-[#eff6ff] border border-[#005daa]/30' : 'hover:bg-[#f2f4f6] border border-transparent'}`}
                onClick={() => handleProjetoClick(proj.id)}
              >
                <div>
                  <p className="text-[10px] text-[#005daa] font-bold uppercase tracking-wider">Projeto</p>
                  <p className="font-bold text-[#191c1e] text-body-sm mt-0.5 line-clamp-2 leading-tight">{proj.nome_projeto}</p>
                  <p className="text-[10px] text-[#707785] mt-2 font-mono">Início: {new Date(proj.data_inicio).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openEditProjeto(proj); }} className="text-[#005daa] bg-white border border-[#c0c7d6] rounded shadow-xs p-1 hover:bg-[#f2f4f6]">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, type: 'projeto', id: proj.id }); }} className="text-[#ba1a1a] bg-white border border-[#c0c7d6] rounded shadow-xs p-1 hover:bg-[#ffdad6]">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela da EAP */}
        <div className={`bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden ${pipelineState !== 'idle' ? 'xl:col-span-2 lg:col-span-3' : 'lg:col-span-3'} transition-all duration-300`}>
          <div className="p-4 border-b border-[#e1e2e8] bg-[#f7f9fb]">
            <h2 className="font-headline-sm text-[#191c1e] font-bold">
              {projetos.find(p => p.id === selectedProjetoId)?.nome_projeto || 'Selecione um Projeto'}
            </h2>
          </div>
          <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#f2f4f6]">
                <tr className="text-[#404753] text-[10px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 border-b border-[#c0c7d6] w-20">Item</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6]">Serviço / Descrição</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-center w-12 hidden md:table-cell">Un.</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-right w-24">Contratado</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-right w-24">Acumulado</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-center w-20">%</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-center w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {eapData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-[#707785]">Nenhuma etapa cadastrada neste projeto.</td>
                  </tr>
                )}
                {eapData.map(row => {
                  const depth = getDepth(row.eap_codigo);
                  const isSintetico = !row.e_analitico;
                  const percentual = Number(row.percentual_executado_financeiro);
                  
                  return (
                    <tr key={row.eap_codigo} className={`border-b border-[#e1e2e8] hover:bg-[#f2f4f6] transition-colors ${isSintetico ? 'bg-[#f7f9fb]' : ''}`}>
                      <td className={`px-4 py-3 ${isSintetico ? 'font-bold text-[#191c1e]' : 'text-[#707785]'} font-metric-mono`}>
                        {row.eap_codigo}
                      </td>
                      <td className={`px-4 py-3`} style={{ paddingLeft: `${Math.max(1, depth * 1.5)}rem` }}>
                        <span className={isSintetico ? 'font-bold text-[#191c1e]' : 'text-[#404753]'}>{row.descricao_servico}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-[#707785] hidden md:table-cell">{row.unidade_medida || '-'}</td>
                      <td className={`px-4 py-3 text-right font-metric-mono ${isSintetico ? 'font-bold text-[#005daa]' : 'text-[#191c1e]'}`}>
                        {formatCurrency(row.valor_total_contratado)}
                      </td>
                      <td className={`px-4 py-3 text-right font-metric-mono ${isSintetico ? 'font-bold text-[#10b981]' : 'text-[#10b981]'}`}>
                        {formatCurrency(row.medicao_acumulada_valor)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold font-metric-mono ${percentual === 100 ? 'text-[#10b981]' : 'text-[#005daa]'}`}>
                          {percentual.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => openEditEap(row.eap_codigo)} className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors cursor-pointer" title="Editar">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button onClick={() => setDeleteModal({ isOpen: true, type: 'eap', id: eapItemIds[row.eap_codigo] })} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors cursor-pointer" title="Excluir">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* PIPELINE DRAWER (SIDE PANEL) */}
        {pipelineState !== 'idle' && (
          <div className="bg-white rounded-xl shadow-2xl border border-[#005daa]/20 overflow-hidden xl:col-span-2 lg:col-span-4 animate-in slide-in-from-right-16 fade-in duration-300 h-fit sticky top-6 ring-4 ring-[#eff6ff]">
            <div className="p-5 border-b border-[#e1e2e8] bg-[#eff6ff] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#005daa] text-[24px]">
                  {pipelineState === 'editing_project' ? 'architecture' : 'account_tree'}
                </span>
                <h2 className="text-title-lg font-display text-[#005daa] font-bold">
                  {pipelineState === 'editing_project' ? (editingProjeto ? 'Editar Projeto' : 'Novo Projeto') : (editingEap ? 'Editar Etapa EAP' : 'Nova Etapa EAP')}
                </h2>
              </div>
              <button onClick={() => setPipelineState('idle')} className="text-[#005daa] hover:bg-[#d4e3ff] p-1.5 rounded-full transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6">
              {pipelineState === 'editing_project' && (
                <div className="space-y-5 animate-in fade-in duration-500">
                  <p className="text-body-sm text-[#404753] mb-4">
                    Cadastre os dados macro do projeto para então habilitar o plano da EAP.
                  </p>
                  <div>
                    <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Nome do Projeto <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={projetoForm.nome_projeto}
                      onChange={e => setProjetoForm({...projetoForm, nome_projeto: e.target.value})}
                      placeholder="Ex: Condomínio Jardim Europa"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Data de Início <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={projetoForm.data_inicio}
                      onChange={e => setProjetoForm({...projetoForm, data_inicio: e.target.value})}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                    />
                  </div>
                  
                  <div className="pt-6 mt-4 border-t border-[#e2e8f0] flex justify-end gap-3">
                    <button onClick={() => setPipelineState('idle')} className="px-5 py-2.5 border border-[#c0c7d6] text-[#404753] rounded-md font-label-bold hover:bg-[#f2f4f6] transition-colors cursor-pointer">
                      Cancelar
                    </button>
                    <button onClick={saveProjeto} className="px-5 py-2.5 bg-[#005daa] text-white font-label-bold rounded-md hover:bg-[#0075d5] transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Salvar Projeto
                    </button>
                  </div>
                </div>
              )}

              {pipelineState === 'editing_eap' && (
                <div className="space-y-5 animate-in fade-in duration-500">
                  <p className="text-body-sm text-[#404753] mb-4">
                    Cadastre agrupadores (Sintéticos) ou serviços executáveis (Analíticos).
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Código EAP <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={eapForm.eap_codigo}
                        onChange={e => setEapForm({...eapForm, eap_codigo: parseEapMask(e.target.value)})}
                        placeholder="Ex: 1 ou 1.2.1"
                        className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] font-metric-mono font-bold shadow-xs"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer bg-[#f2f4f6] px-4 py-2.5 rounded-md border border-[#c0c7d6] hover:bg-[#e2e8f0] transition-colors w-full">
                        <input
                          type="checkbox"
                          checked={eapForm.e_analitico}
                          onChange={e => setEapForm({...eapForm, e_analitico: e.target.checked})}
                          className="w-5 h-5 rounded border-[#c0c7d6] text-[#005daa] focus:ring-[#005daa]"
                        />
                        <span className="font-label-bold text-[#191c1e] text-sm">Serviço Executável?</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Descrição / Nome do Serviço <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={eapForm.descricao_servico}
                      onChange={e => setEapForm({...eapForm, descricao_servico: e.target.value})}
                      placeholder="Ex: Fundações e Estruturas"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                    />
                  </div>

                  {eapForm.e_analitico && (
                    <div className="p-5 bg-[#f7f9fb] rounded-lg border border-[#c0c7d6] space-y-4 shadow-inner">
                      <h4 className="font-label-bold text-[#005daa] uppercase text-[11px] tracking-wider mb-2">Quantitativos e Valores</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Unidade</label>
                          <input
                            type="text"
                            value={eapForm.unidade_medida}
                            onChange={e => setEapForm({...eapForm, unidade_medida: e.target.value})}
                            placeholder="Ex: m², un, vb"
                            className="w-full px-3 py-2 border border-[#c0c7d6] rounded bg-white text-[#191c1e] focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Preço Unit. (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={eapForm.preco_unitario}
                            onChange={e => setEapForm({...eapForm, preco_unitario: e.target.value})}
                            className="w-full px-3 py-2 border border-[#c0c7d6] rounded bg-white text-[#191c1e] focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Qtd</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={eapForm.quantidade_contratada}
                            onChange={e => setEapForm({...eapForm, quantidade_contratada: e.target.value})}
                            className="w-full px-3 py-2 border border-[#c0c7d6] rounded bg-white text-[#191c1e] focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] outline-none"
                          />
                        </div>
                      </div>
                      
                      <div className="pt-3 flex justify-between items-center border-t border-[#e2e8f0] mt-4">
                        <span className="text-[11px] font-label-bold text-[#707785] uppercase">Total do Serviço</span>
                        <span className="text-headline-sm text-[#005daa] font-metric-mono font-bold">
                          {formatCurrency((parseFloat(eapForm.preco_unitario || '0') * parseFloat(eapForm.quantidade_contratada || '0')))}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-6 mt-4 border-t border-[#e2e8f0] flex justify-end gap-3">
                    <button onClick={() => setPipelineState('idle')} className="px-5 py-2.5 border border-[#c0c7d6] text-[#404753] rounded-md font-label-bold hover:bg-[#f2f4f6] transition-colors cursor-pointer">
                      Cancelar
                    </button>
                    <button onClick={saveEap} className="px-5 py-2.5 bg-[#005daa] text-white font-label-bold rounded-md hover:bg-[#0075d5] transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Salvar Etapa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL EXCLUSAO */}
      {deleteModal && deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-[#c0c7d6]">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-[#ef4444]">
                <span className="material-symbols-outlined text-[32px]">warning</span>
                <h3 className="font-headline-sm text-lg font-bold text-[#191c1e]">Atenção</h3>
              </div>
              <p className="text-body-md text-[#404753] leading-relaxed">
                Tem certeza que deseja excluir este <strong className="text-[#191c1e]">{deleteModal.type === 'projeto' ? 'Projeto' : 'Item da EAP'}</strong>? 
                Esta ação não pode ser desfeita e pode apagar registros vinculados.
              </p>
            </div>
            <div className="p-4 bg-[#f2f4f6] flex justify-end gap-3 border-t border-[#e1e2e8]">
              <button onClick={() => setDeleteModal(null)} className="px-5 py-2.5 border border-[#c0c7d6] text-[#404753] font-label-bold hover:bg-[#e2e8f0] rounded-md transition-colors cursor-pointer">Cancelar</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 bg-[#ef4444] text-white font-label-bold rounded-md hover:bg-[#dc2626] transition-colors shadow-sm cursor-pointer">Confirmar Exclusão</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
