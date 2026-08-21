import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { EapMdImportModal } from './EapMdImportModal';
import { CadastroEtapaModal } from './CadastroEtapaModal';
import { ImportProjectXmlModal } from './ImportProjectXmlModal';
import { compareEapCodes } from '../services/eapImporter.service';

interface ProjetosEapViewProps {
  authSession?: any;
}

export const ProjetosEapView: React.FC<ProjetosEapViewProps> = ({ authSession }) => {
  // Estados para Projetos
  const [projetos, setProjetos] = useState<any[]>([]);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<any>(null);
  const [projetoForm, setProjetoForm] = useState({ nome_projeto: '', data_inicio: '', codigo_projeto: '', empresa_id: '', calendario_id: '' });
  const [calendarios, setCalendarios] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isXmlImportModalOpen, setIsXmlImportModalOpen] = useState(false);
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<any[]>([]);
  const [isCadastroEtapaOpen, setIsCadastroEtapaOpen] = useState(false);
  const [itemToEditModal, setItemToEditModal] = useState<any | null>(null);

  // Estados para EAP
  const [eapData, setEapData] = useState<any[]>([]);
  const [eapItemIds, setEapItemIds] = useState<Record<string, string>>({}); // codigo -> id
  const [editingEap, setEditingEap] = useState<any>(null);
  const [eapForm, setEapForm] = useState({
    eap_codigo: '',
    descricao_servico: '',
    unidade_medida: '',
    valor_total_contratado: '',
    valor_desembolsado: '',
    e_analitico: false,
    ordem: 0
  });

  // Pipeline State
  const [pipelineState, setPipelineState] = useState<'idle' | 'editing_project' | 'editing_eap'>('idle');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'projeto' | 'eap'; id: string } | null>(null);

  // ----- FETCH PROJETOS & EAP -----
  const fetchProjetos = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;

      const res = await fetch('/api/projetos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.projetos || json;
        if (Array.isArray(list)) {
          setProjetos(list);
          if (list.length > 0 && !selectedProjetoId) {
            setSelectedProjetoId(list[0].id);
            fetchEap(list[0].id);
          }
        }
      }
    } catch (e) {
      console.warn("[ProjetosEapView] Fallback fetchProjetos to client Supabase:", e);
      const { data } = await supabase.from('projetos').select('*').order('nome_projeto');
      if (data) {
        setProjetos(data);
        if (data.length > 0 && !selectedProjetoId) {
          setSelectedProjetoId(data[0].id);
          fetchEap(data[0].id);
        }
      }
    }
  };

  const fetchEmpresas = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      const res = await fetch('/api/empresas', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setEmpresasDisponiveis(json.data);
        }
      }
    } catch (e) {
      console.warn("Error fetching empresas:", e);
    }
  };

  const fetchCalendarios = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      const res = await fetch('/api/calendarios', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setCalendarios(json.data || []);
      }
    } catch (e) {
      console.warn("Erro ao buscar calendários:", e);
    }
  };

  useEffect(() => {
    fetchProjetos();
    fetchEmpresas();
    fetchCalendarios();
  }, []);

  const fetchEap = async (projetoId: string) => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || authSession?.idToken;

    try {
      const res = await fetch(`/api/itens-eap?projeto_id=${projetoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.items)) {
          const idsMap: Record<string, string> = {};
          (json.rawItems || json.items).forEach((t: any) => {
            if (t.eap_codigo && t.id) idsMap[t.eap_codigo] = t.id;
          });
          const sortedItems = [...json.items].sort((a: any, b: any) => compareEapCodes(a.eap_codigo, b.eap_codigo));
          setEapItemIds(idsMap);
          setEapData(sortedItems);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("[ProjetosEapView] API fetchEap failed, using fallback:", e);
    }

    const viewReq = supabase.from('v_resumo_eap_medicao').select('*').eq('projeto_id', projetoId);
    const tableReq = supabase.from('itens_eap').select('*').eq('projeto_id', projetoId);

    const [viewRes, tableRes] = await Promise.all([viewReq, tableReq]);
    
    if (viewRes.data && tableRes.data) {
      const idsMap: Record<string, string> = {};
      tableRes.data.forEach(t => {
        idsMap[t.eap_codigo] = t.id;
      });
      const sortedView = [...viewRes.data].sort((a: any, b: any) => compareEapCodes(a.eap_codigo, b.eap_codigo));
      setEapItemIds(idsMap);
      setEapData(sortedView);
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
    if (parts.length > 4) {
      cleaned = parts.slice(0, 4).join('.');
    }
    return cleaned;
  };

  // ----- CRUD PROJETO -----
  const openNewProjeto = () => {
    setEditingProjeto(null);
    setProjetoForm({ nome_projeto: '', data_inicio: new Date().toISOString().split('T')[0], codigo_projeto: '', empresa_id: '', calendario_id: '' });
    setPipelineState('editing_project');
  };

  const openEditProjeto = (proj: any) => {
    setEditingProjeto(proj);
    setProjetoForm({ nome_projeto: proj.nome_projeto, data_inicio: proj.data_inicio.split('T')[0], codigo_projeto: proj.codigo_projeto || '', empresa_id: proj.empresa_id || '', calendario_id: proj.calendario_id || '' });
    setPipelineState('editing_project');
  };

  const saveProjeto = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || authSession?.idToken;
    
    try {
      const res = await fetch('/api/projetos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingProjeto?.id,
          nome_projeto: projetoForm.nome_projeto,
          data_inicio: projetoForm.data_inicio,
          codigo_projeto: projetoForm.codigo_projeto || undefined,
          empresa_id: projetoForm.empresa_id || null,
          calendario_id: projetoForm.calendario_id || null
        })
      });
      if (res.ok) {
        alert('Projeto salvo com sucesso!');
        setPipelineState('idle');
        fetchProjetos();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(`Falha ao salvar projeto: ${json.error || res.statusText}`);
      }
    } catch (e) {
      alert('Erro inesperado ao salvar projeto.');
    }
  };

  // ----- CRUD EAP -----
  const openNewEap = () => {
    setItemToEditModal(null);
    setIsCadastroEtapaOpen(true);
  };

  const openEditEap = (eapCodigo: string) => {
    const id = eapItemIds[eapCodigo];
    const itemInState = eapData.find(i => i.eap_codigo === eapCodigo);

    if (itemInState) {
      setItemToEditModal({ id: id || itemInState.id, ...itemInState });
      setIsCadastroEtapaOpen(true);
    }
  };

  const saveEap = async () => {
    if (!selectedProjetoId) {
      alert('Selecione um projeto para cadastrar a etapa.');
      return;
    }
    if (!eapForm.eap_codigo.trim() || !eapForm.descricao_servico.trim()) {
      alert('Campos "Código EAP" e "Descrição / Nome do Serviço" são obrigatórios.');
      return;
    }
    if (eapForm.eap_codigo.split('.').length >= 3 && !eapForm.data_execucao) {
      alert('Data de Execução é obrigatória para itens executáveis (Níveis 3 e 4).');
      return;
    }

    const parts = eapForm.eap_codigo.split('.');
    let eap_pai_codigo = '';
    if (parts.length > 1) {
      eap_pai_codigo = parts.slice(0, parts.length - 1).join('.');
    }

    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || authSession?.idToken;

    try {
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
          preco_unitario: eapForm.valor_total_contratado,
          quantidade_contratada: 1,
          valor_desembolsado: eapForm.valor_desembolsado,
          e_analitico: eapForm.e_analitico,
          ordem: eapForm.ordem,
          data_execucao: eapForm.data_execucao,
          duracao_dias: eapForm.duracao_dias
        })
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setPipelineState('idle');
        fetchEap(selectedProjetoId);
      } else {
        alert(`Erro ao salvar etapa: ${json.error || res.statusText || 'Falha na requisição'}`);
      }
    } catch (e: any) {
      alert(`Erro de conexão ao salvar etapa: ${e.message}`);
    }
  };

  // ----- DELETE -----
  const confirmDelete = async () => {
    if (!deleteModal) return;
    
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || authSession?.idToken;

    try {
      if (deleteModal.type === 'projeto') {
        const res = await fetch('/api/projetos', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ id: deleteModal.id })
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          if (selectedProjetoId === deleteModal.id) {
            setSelectedProjetoId(null);
            setPipelineState('idle');
          }
          fetchProjetos();
        } else {
          alert(`Erro ao excluir projeto: ${json.error || res.statusText}`);
        }
      } else {
        const res = await fetch('/api/itens-eap', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ id: deleteModal.id })
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          if (selectedProjetoId) fetchEap(selectedProjetoId);
          setPipelineState('idle');
        } else {
          alert(`Erro ao excluir etapa: ${json.error || res.statusText}`);
        }
      }
    } catch (e: any) {
      alert(`Erro inesperado ao excluir: ${e.message}`);
    }
    setDeleteModal(null);
  };

  const selectedProj = projetos.find(p => p.id === selectedProjetoId);

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA TELA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm font-display text-[#191c1e]">Projetos EAP e Medições</h1>
          <p className="text-body-md text-[#707785]">Acompanhamento da Estrutura Analítica de Projetos e Execução Físico-Financeira</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={openNewProjeto} 
            className="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-md font-label-bold hover:bg-slate-200 flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
            Novo Projeto
          </button>
          <button 
            onClick={() => setIsXmlImportModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md font-label-bold hover:bg-indigo-700 flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Importar MS Project (.xml / .mpp)
          </button>
          {selectedProjetoId && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md font-label-bold hover:bg-emerald-700 flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Importar EAP (.md)
              </button>
              <button 
                onClick={openNewEap} 
                className="px-4 py-2 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#004a88] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Nova Etapa EAP
              </button>
              {eapData.length > 0 && (
                <button
                  onClick={async () => {
                    try {
                      const { data: session } = await supabase.auth.getSession();
                      const token = session?.session?.access_token || authSession?.idToken;
                      const res = await fetch('/api/cronograma/financeiro/gerar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ projeto_id: selectedProjetoId })
                      });
                      const json = await res.json();
                      if (res.ok && json.success) {
                        alert(`✅ ${json.message}\nNavegue até a aba "Físico-Financeiro" no menu lateral para visualizar a matriz.`);
                      } else {
                        alert(`❌ ${json.error || 'Erro ao gerar cronograma financeiro.'}`);
                      }
                    } catch (err: any) {
                      alert(`❌ Erro: ${err.message}`);
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-md font-label-bold hover:from-emerald-700 hover:to-teal-700 flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Gerar Cronograma Financeiro
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* CARD SUPERIOR DE PROJETOS (SELETOR DROPDOWN & DETALHES) */}
      <div className="bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden">
        <div className="p-5 bg-[#f7f9fb] border-b border-[#e1e2e8] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-[280px]">
            <div className="p-2.5 bg-[#005daa]/10 text-[#005daa] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">architecture</span>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-[#005daa] uppercase tracking-wider mb-1">
                Selecione o Projeto (Código)
              </label>
              <select
                value={selectedProjetoId || ''}
                onChange={(e) => handleProjetoClick(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-[#c0c7d6] rounded-lg text-[#191c1e] font-bold text-sm focus:outline-none focus:border-[#005daa] focus:ring-2 focus:ring-[#005daa]/20 shadow-xs cursor-pointer"
              >
                {projetos.length === 0 && <option value="">Nenhum projeto cadastrado</option>}
                {projetos.map(proj => {
                  const code = proj.codigo_contrato || proj.tenant_id;
                  return (
                    <option key={proj.id} value={proj.id}>
                      {proj.codigo_projeto ? `[${proj.codigo_projeto}] ` : ''}{proj.nome_projeto} {code ? `(${code})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* DETALHES E AÇÕES DO PROJETO ATIVO */}
          {selectedProj && (
            <div className="flex flex-wrap items-center justify-between flex-1 gap-4 pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-[#e1e2e8] pt-3 md:pt-0">
              <div>
                <span className="text-[10px] text-[#707785] font-mono block">Data de Início: {new Date(selectedProj.data_inicio).toLocaleDateString('pt-BR')}</span>
                <div className="flex items-center gap-2 mt-1">
                  <h3 className="text-title-lg font-bold text-[#191c1e] line-clamp-1">{selectedProj.nome_projeto}</h3>
                  {selectedProj.codigo_projeto && (
                    <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider">
                      CÓD: {selectedProj.codigo_projeto}
                    </span>
                  )}
                  {selectedProj.empresa_nome && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">domain</span>
                      {selectedProj.empresa_nome}
                    </span>
                  )}
                  {selectedProj.codigo_contrato && (
                    <span className="bg-[#eff6ff] text-[#005daa] border border-[#005daa]/20 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider">
                      Contrato: {selectedProj.codigo_contrato}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditProjeto(selectedProj)}
                  className="px-3 py-1.5 bg-white border border-[#c0c7d6] text-[#005daa] rounded-md font-label-bold hover:bg-[#eff6ff] transition-colors flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
                  title="Editar Projeto"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Editar
                </button>
                <button
                  onClick={() => setDeleteModal({ isOpen: true, type: 'projeto', id: selectedProj.id })}
                  className="px-3 py-1.5 bg-white border border-[#c0c7d6] text-[#ba1a1a] rounded-md font-label-bold hover:bg-red-50 transition-colors flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
                  title="Excluir Projeto"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ÁREA CENTRAL: TABELA DE ETAPAS EAP & DRAWER LATERAL */}
      <div className={`grid grid-cols-1 ${pipelineState === 'editing_eap' ? 'xl:grid-cols-5 lg:grid-cols-4' : ''} gap-6 transition-all duration-300 items-start`}>
        
        {/* TABELA DE ETAPAS EAP (APROVEITA LARGURA TOTAL DA ÁREA CENTRAL) */}
        <div className={`bg-white rounded-xl shadow-xs border border-[#c0c7d6] overflow-hidden ${pipelineState === 'editing_eap' ? 'xl:col-span-3 lg:col-span-2' : 'w-full'} transition-all duration-300`}>
          <div className="p-4 border-b border-[#e1e2e8] bg-[#f7f9fb] flex justify-between items-center">
            <h2 className="font-headline-sm text-[#191c1e] font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[#005daa] text-[20px]">format_list_bulleted</span>
              Etapas da EAP e Execução Físico-Financeira
            </h2>
            <span className="text-xs font-mono font-bold text-[#707785] bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              {eapData.length} {eapData.length === 1 ? 'etapa' : 'etapas'}
            </span>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#f2f4f6]">
                <tr className="text-[#404753] text-[10px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 border-b border-[#c0c7d6] w-24">EAP</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6]">Serviço / Descrição</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-center w-16 hidden md:table-cell">Un.</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-right w-32">Contratado</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-right w-32">Desembolsado</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-right w-32">Acumulado</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-center w-24">% Exec.</th>
                  <th className="px-4 py-3 border-b border-[#c0c7d6] text-center w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {eapData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center p-12 text-[#707785]">
                      <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-2">grid_off</span>
                      Nenhuma etapa cadastrada neste projeto. Clique em <strong>Nova Etapa EAP</strong> ou <strong>Importar EAP (.md)</strong>.
                    </td>
                  </tr>
                )}
                {eapData.map(row => {
                  const depth = getDepth(row.eap_codigo);
                  const isSintetico = !row.e_analitico;
                  const valTotalContratado = Number(row.valor_total_contratado || 0);
                  const valDesembolsado = Number(row.valor_desembolsado || 0);
                  const percentual = valTotalContratado > 0 ? (valDesembolsado / valTotalContratado) * 100 : 0;
                  
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
                      <td className={`px-4 py-3 text-right font-metric-mono ${isSintetico ? 'font-bold text-[#d97706]' : 'text-[#d97706]'}`}>
                        {formatCurrency(row.valor_desembolsado)}
                      </td>
                      <td className={`px-4 py-3 text-right font-metric-mono ${isSintetico ? 'font-bold text-[#10b981]' : 'text-[#10b981]'}`}>
                        {formatCurrency(valTotalContratado - valDesembolsado)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold font-metric-mono px-2 py-0.5 rounded text-[11px] ${percentual === 100 ? 'bg-emerald-100 text-[#10b981]' : 'bg-blue-50 text-[#005daa]'}`}>
                          {percentual.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => openEditEap(row.eap_codigo)} className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors cursor-pointer" title="Editar Etapa">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button onClick={() => setDeleteModal({ isOpen: true, type: 'eap', id: eapItemIds[row.eap_codigo] })} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors cursor-pointer" title="Excluir Etapa">
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

        {/* PIPELINE DRAWER (PAINEL DE EDIÇÃO DE ETAPA DA EAP) */}
        {pipelineState === 'editing_eap' && (
          <div className="bg-white rounded-xl shadow-2xl border border-[#005daa]/20 overflow-hidden xl:col-span-2 lg:col-span-2 animate-in slide-in-from-right-16 fade-in duration-300 h-fit sticky top-6 ring-4 ring-[#eff6ff]">
            <div className="p-5 bg-[#005daa] text-white flex justify-between items-center">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-blue-200 block">Pipeline de Edição</span>
                <h3 className="font-title-lg font-bold">
                  {editingEap ? `Editar Etapa: ${editingEap.eap_codigo}` : 'Nova Etapa da EAP'}
                </h3>
              </div>
              <button 
                onClick={() => setPipelineState('idle')} 
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6">
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

                {eapForm.eap_codigo.split('.').length >= 3 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Data Início (Nível 3/4) <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={eapForm.data_execucao || ''}
                        onChange={e => setEapForm({...eapForm, data_execucao: e.target.value})}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Duração (Dias)</label>
                      <input
                        type="number"
                        min="1"
                        value={eapForm.duracao_dias || 1}
                        onChange={e => setEapForm({...eapForm, duracao_dias: parseInt(e.target.value) || 1})}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#c0c7d6] rounded-md text-[#191c1e] focus:outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] shadow-xs"
                      />
                    </div>
                  </div>
                )}

                {eapForm.e_analitico && (
                  <div className="p-5 bg-[#f7f9fb] rounded-lg border border-[#c0c7d6] space-y-4 shadow-inner">
                    <h4 className="font-label-bold text-[#005daa] uppercase text-[11px] tracking-wider mb-2">Quantitativos e Valores</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Contratado (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={eapForm.valor_total_contratado}
                          onChange={e => setEapForm({...eapForm, valor_total_contratado: e.target.value})}
                          placeholder="0,00"
                          className="w-full px-3 py-2 border border-[#c0c7d6] rounded bg-white text-[#191c1e] focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] outline-none font-metric-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-label-bold text-[#191c1e] mb-1">Desembolsado (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={eapForm.valor_desembolsado}
                          onChange={e => setEapForm({...eapForm, valor_desembolsado: e.target.value})}
                          placeholder="0,00"
                          className="w-full px-3 py-2 border border-[#c0c7d6] rounded bg-white text-[#191c1e] focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa] outline-none font-metric-mono"
                        />
                      </div>
                    </div>
                    
                    <div className="pt-3 flex justify-between items-center border-t border-[#e2e8f0] mt-4">
                      <span className="text-[11px] font-label-bold text-[#707785] uppercase">Saldo Acumulado</span>
                      <span className="text-headline-sm text-[#005daa] font-metric-mono font-bold">
                        {formatCurrency((parseFloat(eapForm.valor_total_contratado || '0') - parseFloat(eapForm.valor_desembolsado || '0')))}
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

      {/* MODAL PROJETO */}
      {pipelineState === 'editing_project' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191c1e]/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#e1e2e8] bg-[#eff6ff] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#005daa] text-[24px]">architecture</span>
                <h2 className="text-title-lg font-display text-[#005daa] font-bold">
                  {editingProjeto ? 'Editar Projeto' : 'Novo Projeto'}
                </h2>
              </div>
              <button onClick={() => setPipelineState('idle')} className="text-[#005daa] hover:bg-[#d4e3ff] p-1.5 rounded-full transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-5">
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
                  <label className="block text-[#404753] text-sm font-bold mb-1.5">Código do Projeto</label>
                  <input
                    type="text"
                    disabled
                    value={projetoForm.codigo_projeto}
                    placeholder="Gerado Automaticamente (P-SEQ-ANO)"
                    className="w-full px-3.5 py-2.5 border border-[#e1e2e8] bg-[#f8fafc] text-[#707785] rounded-md outline-none text-sm cursor-not-allowed font-medium italic shadow-xs"
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
                <div>
                  <label className="block text-[#404753] text-sm font-bold mb-1.5">Fornecedor / Empresa <span className="text-slate-400 font-normal text-xs">(Opcional)</span></label>
                  <select
                    value={projetoForm.empresa_id || ''}
                    onChange={(e) => setProjetoForm({ ...projetoForm, empresa_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-[#e1e2e8] bg-white text-[#191c1e] rounded-md outline-none text-sm focus:border-[#005daa] shadow-xs"
                  >
                    <option value="">-- Gestão Direta (Sem Fornecedor) --</option>
                    {empresasDisponiveis.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome} ({emp.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#404753] text-sm font-bold mb-1.5">Calendário (Dias Úteis) <span className="text-slate-400 font-normal text-xs">(Opcional)</span></label>
                  <select
                    value={projetoForm.calendario_id || ''}
                    onChange={(e) => setProjetoForm({ ...projetoForm, calendario_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-[#e1e2e8] bg-white text-[#191c1e] rounded-md outline-none text-sm focus:border-[#005daa] shadow-xs"
                  >
                    <option value="">-- Sem Calendário (7 dias/semana) --</option>
                    {calendarios.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.nome}
                      </option>
                    ))}
                  </select>
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
            </div>
          </div>
        </div>
      )}
      {/* MODAL IMPORTACAO EAP .MD */}
      {selectedProjetoId && (
        <EapMdImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          projetoId={selectedProjetoId}
          projetoNome={projetos.find(p => p.id === selectedProjetoId)?.nome_projeto || ''}
          authSession={authSession}
          onSuccess={() => fetchEap(selectedProjetoId)}
        />
      )}

      {/* MODAL IMPORTACAO XML */}
      <ImportProjectXmlModal
        isOpen={isXmlImportModalOpen}
        onClose={() => setIsXmlImportModalOpen(false)}
        authSession={authSession}
        onSuccess={(newProjetoId) => {
          fetchProjetos().then(() => {
            setSelectedProjetoId(newProjetoId);
            fetchEap(newProjetoId);
          });
        }}
      />

      {/* MODAL CADASTRO / EDIÇÃO DE ETAPA (EAP) */}
      {selectedProjetoId && (
        <CadastroEtapaModal
          isOpen={isCadastroEtapaOpen}
          onClose={() => setIsCadastroEtapaOpen(false)}
          projetoId={selectedProjetoId}
          projetoDataInicio={selectedProj?.data_inicio}
          existingItems={eapData}
          itemToEdit={itemToEditModal}
          authSession={authSession}
          onSuccess={() => fetchEap(selectedProjetoId)}
        />
      )}
    </div>
  );
};
