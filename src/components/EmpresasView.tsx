import React, { useState, useEffect } from 'react';
import { AuthSession, EmpresaItem } from '../types';
import { supabase } from '../lib/supabaseClient';
import { formatCpfCnpj, isValidCpfCnpj } from '../utils/documentUtils';

interface EmpresasViewProps {
  authSession?: AuthSession | null;
  empresas: EmpresaItem[];
  setEmpresas: React.Dispatch<React.SetStateAction<EmpresaItem[]>>;
}

export const EmpresasView: React.FC<EmpresasViewProps> = ({ authSession, empresas, setEmpresas }) => {
  const contratoId = authSession?.customClaims?.contrato_id || 'CTR-2026-SYS';

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');

  // Sub-tabs in EmpresasView
  const [activeSubTab, setActiveSubTab] = useState<'LISTA' | 'CONTRATANTE'>('LISTA');

  // Empresa Contratante (Proprietária) State - Initialized empty to eliminate mock data as requested
  const [empresaContratante, setEmpresaContratante] = useState({
    natureza: 'Publica' as 'Privada' | 'Publica', // Radiobutton inicial: Privada ou Publica
    nome: '',
    area: '',
    departamento: '',
    cnpj: '',
    email: '',
    telefone: '',
    gestorResponsavel: '',
    unidadeAdministrativa: ''
  });

  const [isEditingContratante, setIsEditingContratante] = useState(false);
  const [tempContratante, setTempContratante] = useState({ ...empresaContratante });

  // Supabase Database Sync Status State
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseSynced, setSupabaseSynced] = useState<boolean | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [showSqlHelp, setShowSqlHelp] = useState(false);

  // Gestora Confirmation Email State
  const [sendingGestoraEmail, setSendingGestoraEmail] = useState<string | null>(null);
  const [gestoraFeedback, setGestoraFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const handleSendGestoraConfirmation = async (empresa: EmpresaItem) => {
    setSendingGestoraEmail(empresa.id);
    setGestoraFeedback(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      const res = await fetch('/api/gestora/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          empresa_id: empresa.id,
          email: empresa.emailContato
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGestoraFeedback({
          id: empresa.id,
          success: true,
          message: data.message || `E-mail de confirmação e recuperação enviado com sucesso!`
        });
      } else {
        setGestoraFeedback({
          id: empresa.id,
          success: false,
          message: data.error || 'Erro ao disparar e-mail de confirmação da Gestora.'
        });
      }
    } catch (err: any) {
      setGestoraFeedback({
        id: empresa.id,
        success: false,
        message: err.message || 'Erro de conexão ao enviar e-mail.'
      });
    } finally {
      setSendingGestoraEmail(null);
    }
  };

  // Load contracting company data from Supabase (Full stack backend client proxy)
  useEffect(() => {
    const fetchContratante = async () => {
      setSupabaseLoading(true);
      try {
        const response = await fetch(`/api/contratante?contrato_id=${encodeURIComponent(contratoId)}`, {
          headers: {
            'Authorization': `Bearer ${authSession?.idToken || ''}`
          }
        });
        const json = await response.json();
        if (json.success && json.data) {
          setEmpresaContratante(json.data);
          setTempContratante(json.data);
          setSupabaseSynced(json.synced);
          setSupabaseError(json.error || null);
        } else {
          setSupabaseSynced(false);
          setSupabaseError(json.error || 'Erro desconhecido');
        }
      } catch (err: any) {
        console.error("Fetch contratante failed:", err);
        setSupabaseSynced(false);
        setSupabaseError(err.message || 'Erro de conexão');
      } finally {
        setSupabaseLoading(false);
      }
    };
    fetchContratante();
  }, [contratoId]);

  // Load supplier/client/partner companies from Supabase
  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token || authSession?.idToken;
        const response = await fetch(`/api/empresas?contrato_id=${encodeURIComponent(contratoId)}`, {
          headers: {
            'Authorization': `Bearer ${token || ''}`
          }
        });
        const json = await response.json();
        if (json.success && json.data) {
          setEmpresas(json.data);
        }
      } catch (err) {
        console.error("Fetch companies failed:", err);
      }
    };
    fetchEmpresas();
  }, [contratoId, authSession, setEmpresas]);

  const handleStartEditingContratante = () => {
    setTempContratante({ ...empresaContratante });
    setIsEditingContratante(true);
  };

  const handleSaveContratante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempContratante.nome.trim()) {
      showNotification('error', 'O Nome da Empresa Contratante é obrigatório.');
      return;
    }
    if (tempContratante.cnpj && !isValidCpfCnpj(tempContratante.cnpj)) {
      showNotification('error', 'O CNPJ/CPF informado é inválido. Verifique os dígitos.');
      return;
    }

    setSupabaseLoading(true);
    try {
      const response = await fetch('/api/contratante', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.idToken || ''}`
        },
        body: JSON.stringify({
          contrato_id: contratoId,
          ...tempContratante
        })
      });
      const json = await response.json();
      if (json.success) {
        setEmpresaContratante(json.data);
        setSupabaseSynced(json.synced);
        setSupabaseError(json.error || null);
        setIsEditingContratante(false);

        if (json.synced) {
          showNotification(
            'success',
            `Cadastro da Empresa Contratante salvo no Supabase com sucesso!`
          );
        } else {
          showNotification(
            'info',
            `Cadastro atualizado localmente. (Supabase sem tabela ou offline)`
          );
        }
      } else {
        showNotification('error', `Falha ao salvar: ${json.error || 'erro desconhecido'}`);
      }
    } catch (err: any) {
      console.error("Save contratante failed:", err);
      // Local fallback
      setEmpresaContratante({ ...tempContratante });
      setIsEditingContratante(false);
      setSupabaseSynced(false);
      setSupabaseError(err.message || 'Erro de rede');
      showNotification(
        'info',
        'Salvo em memória devido a um erro de conexão.'
      );
    } finally {
      setSupabaseLoading(false);
    }
  };

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaItem | null>(null);
  const [viewingEmpresa, setViewingEmpresa] = useState<EmpresaItem | null>(null);
  const [deletingEmpresa, setDeletingEmpresa] = useState<EmpresaItem | null>(null);

  // Toast Notification State
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Form State
  const [formData, setFormData] = useState({
    idPrefix: 'SUP',
    idCustom: '',
    nome: '',
    cnpj_cpf: '',
    tipo: 'FORNECEDOR' as 'FORNECEDOR' | 'CLIENTE' | 'PARCEIRO' | 'GESTORA' | 'CONTRATANTE',
    emailContato: '',
    telefone: '',
    status: 'ATIVO' as 'ATIVO' | 'BLOQUEADO' | 'EM_ANALISE',
    totalFaturado: 0
  });

  // Sanitizer gegen XSS
  const sanitizeInput = (str: string | null | undefined) => (str || '').replace(/[<>]/g, '').trim();

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setActiveSubTab('LISTA');
    setEditingEmpresa(null);
    setFormData({
      idPrefix: 'SUP',
      idCustom: '',
      nome: '',
      cnpj_cpf: '',
      tipo: 'FORNECEDOR',
      emailContato: '',
      telefone: '',
      status: 'ATIVO',
      totalFaturado: 0
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (empresa: EmpresaItem) => {
    setActiveSubTab('LISTA');
    setEditingEmpresa(empresa);
    setFormData({
      idPrefix: empresa.id.startsWith('CLI') ? 'CLI' : empresa.id.startsWith('PAR') ? 'PAR' : empresa.id.startsWith('GER') ? 'GER' : 'SUP',
      idCustom: empresa.id,
      nome: empresa.nome,
      cnpj_cpf: empresa.cnpj_cpf,
      tipo: empresa.tipo,
      emailContato: empresa.emailContato,
      telefone: empresa.telefone,
      status: empresa.status,
      totalFaturado: empresa.totalFaturado
    });
    setIsModalOpen(true);
  };

  // Submit Handler for Create or Edit (C and U)
  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanNome = sanitizeInput(formData.nome);
    const cleanCnpj = sanitizeInput(formData.cnpj_cpf);

    if (!cleanNome || !cleanCnpj) {
      showNotification('error', 'Preencha a Razão Social/Nome e o CNPJ/CPF.');
      return;
    }
    if (!isValidCpfCnpj(cleanCnpj)) {
      showNotification('error', 'O CNPJ/CPF informado é inválido. Verifique os dígitos.');
      return;
    }

    setSupabaseLoading(true);

    let finalId = '';
    let isNew = true;

    if (editingEmpresa) {
      finalId = editingEmpresa.id;
      isNew = false;
    } else {
      finalId = formData.idCustom
        ? sanitizeInput(formData.idCustom).toUpperCase()
        : `${formData.idPrefix}-${Math.floor(1000 + Math.random() * 9000)}-${cleanNome
            .substring(0, 7)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')}`;
    }

    const payload: EmpresaItem = {
      id: finalId,
      nome: cleanNome,
      cnpj_cpf: cleanCnpj,
      tipo: formData.tipo,
      contrato_id: contratoId,
      emailContato: sanitizeInput(formData.emailContato),
      telefone: sanitizeInput(formData.telefone),
      status: formData.status,
      totalFaturado: Number(formData.totalFaturado) || 0,
      createdAt: editingEmpresa?.createdAt || new Date().toISOString().split('T')[0]
    };

    try {
      const response = await fetch('/api/empresas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.idToken || ''}`
        },
        body: JSON.stringify(payload)
      });
      const json = await response.json();

      if (json.success) {
        if (isNew) {
          setEmpresas([json.data, ...empresas]);
          showNotification('success', `Nova empresa "${cleanNome}" cadastrada com sucesso.`);
        } else {
          const updatedList = empresas.map((item) => (item.id === finalId ? json.data : item));
          setEmpresas(updatedList);
          showNotification('success', `Empresa "${cleanNome}" atualizada com sucesso.`);
        }
      } else {
        showNotification('error', `Falha ao salvar empresa: ${json.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      console.error("Save company failed:", err);
      // Fallback in memory
      if (isNew) {
        setEmpresas([payload, ...empresas]);
      } else {
        const updatedList = empresas.map((item) => (item.id === finalId ? payload : item));
        setEmpresas(updatedList);
      }
      showNotification('info', `Salvo temporariamente na memória local devido a um erro de conexão.`);
    } finally {
      setSupabaseLoading(false);
      setIsModalOpen(false);
    }
  };

  // DELETE (D)
  const handleConfirmDelete = async () => {
    if (!deletingEmpresa) return;
    const companyName = deletingEmpresa.nome;
    const companyId = deletingEmpresa.id;

    setSupabaseLoading(true);
    try {
      const response = await fetch(`/api/empresas?id=${encodeURIComponent(companyId)}&contrato_id=${encodeURIComponent(contratoId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authSession?.idToken || ''}`
        }
      });
      const json = await response.json();

      if (json.success) {
        setEmpresas(empresas.filter((item) => item.id !== companyId));
        showNotification('info', `Empresa "${companyName}" (${companyId}) foi removida do cadastro.`);
      } else {
        showNotification('error', `Falha ao excluir empresa: ${json.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      console.error("Delete company failed:", err);
      // Fallback local
      setEmpresas(empresas.filter((item) => item.id !== companyId));
      showNotification('info', `Removido localmente devido a um erro de conexão.`);
    } finally {
      setSupabaseLoading(false);
      setDeletingEmpresa(null);
    }
  };

  // Quick Status Toggle (ATIVO <-> BLOQUEADO)
  const handleToggleStatus = async (empresa: EmpresaItem) => {
    const nextStatus: 'ATIVO' | 'BLOQUEADO' = empresa.status === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO';
    const updatedPayload = { ...empresa, status: nextStatus };

    setSupabaseLoading(true);
    try {
      const response = await fetch('/api/empresas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.idToken || ''}`
        },
        body: JSON.stringify(updatedPayload)
      });
      const json = await response.json();

      if (json.success) {
        setEmpresas(empresas.map((item) => (item.id === empresa.id ? json.data : item)));
        showNotification('info', `Status da empresa "${empresa.nome}" alterado para ${nextStatus}.`);
      } else {
        showNotification('error', `Falha ao alterar status: ${json.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      console.error("Toggle company status failed:", err);
      // Fallback local
      setEmpresas(empresas.map((item) => (item.id === empresa.id ? updatedPayload : item)));
      showNotification('info', `Status alterado localmente devido a um erro de conexão.`);
    } finally {
      setSupabaseLoading(false);
    }
  };

  // Export List as CSV
  const handleExportCSV = () => {
    const headers = ['ID_Empresa', 'Razao_Social', 'CNPJ_CPF', 'Tipo', 'Contrato_ID', 'Email_Contato', 'Telefone', 'Status', 'Total_Faturado_R$', 'Criado_Em'];
    const rows = filteredEmpresas.map((e) => [
      e.id,
      `"${e.nome}"`,
      e.cnpj_cpf,
      e.tipo,
      e.contrato_id,
      e.emailContato,
      e.telefone,
      e.status,
      e.totalFaturado,
      e.createdAt
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `empresas_tenant_${contratoId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('success', 'Relatório CSV de empresas gerado com sucesso.');
  };

  // Filter Computation (R)
  const filteredEmpresas = (empresas || []).map((item) => ({
    ...item,
    id: item.id || '',
    nome: item.nome || '',
    cnpj_cpf: item.cnpj_cpf || '',
    emailContato: item.emailContato || '',
    tipo: item.tipo || 'FORNECEDOR',
    status: item.status || 'ATIVO',
    totalFaturado: Number(item.totalFaturado || 0)
  })).filter((item) => {
    const s = (search || '').toLowerCase();
    const matchesSearch =
      item.nome.toLowerCase().includes(s) ||
      item.cnpj_cpf.includes(s) ||
      item.emailContato.toLowerCase().includes(s) ||
      item.id.toLowerCase().includes(s);

    const matchesTipo = filterTipo === 'TODOS' || item.tipo === filterTipo;
    const matchesStatus = filterStatus === 'TODOS' || item.status === filterStatus;

    return matchesSearch && matchesTipo && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-md border flex items-center justify-between shadow-2xs text-xs font-bold transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {notification.type === 'success'
                ? 'check_circle'
                : notification.type === 'error'
                ? 'error'
                : 'info'}
            </span>
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-md border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1890ff] text-2xl">domain</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Módulo Container: Cadastro de Empresas (CRUD Complianced)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Isolamento de empresas, fornecedores e parceiros por Contrato Tenant:{' '}
            <strong className="text-slate-800 font-mono font-bold">{contratoId}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer border border-slate-200"
            title="Exportar lista de empresas em CSV"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#1890ff] text-white font-bold text-xs rounded-md hover:bg-[#096dd9] transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_business</span>
            <span>Cadastrar Nova Empresa</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 bg-white px-4 pt-2 rounded-t-md border-x border-t">
        <button
          onClick={() => setActiveSubTab('CONTRATANTE')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'CONTRATANTE'
              ? 'border-[#005daa] text-[#005daa] bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">domain</span>
          <span>Empresa Contratante (Proprietária)</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
              empresaContratante.natureza === 'Publica'
                ? 'bg-[#005daa] text-white'
                : 'bg-indigo-600 text-white'
            }`}
          >
            {empresaContratante.natureza === 'Publica' ? 'Pública' : 'Privada'}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('LISTA')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'LISTA'
              ? 'border-[#005daa] text-[#005daa] bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">badge</span>
          <span>Empresas Cadastradas & Fornecedores</span>
          <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-full">
            {empresas.length}
          </span>
        </button>
      </div>

      {/* Sub-Tab 1: Cadastro da Empresa Contratante (Proprietária) */}
      {activeSubTab === 'CONTRATANTE' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-b-md border-x border-b border-slate-200 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#005daa] text-2xl">apartment</span>
                  <h3 className="text-lg font-bold text-slate-800">
                    Cadastro da Empresa Contratante (Proprietária)
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                      empresaContratante.natureza === 'Publica'
                        ? 'bg-blue-50 text-[#005daa] border-blue-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {empresaContratante.natureza === 'Publica' ? 'Órgão / Entidade Pública' : 'Empresa Privada'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Empresa titular da contratação associada ao Contrato Tenant:{' '}
                  <strong className="text-slate-800 font-mono font-bold">{contratoId}</strong>
                </p>
              </div>

              {!isEditingContratante && (
                <button
                  onClick={handleStartEditingContratante}
                  className="px-4 py-2 bg-[#005daa] hover:bg-[#004884] text-white text-xs font-bold rounded-md shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  <span>Editar Cadastro da Contratante</span>
                </button>
              )}
            </div>



            {/* Form Section */}
            {isEditingContratante ? (
              <form onSubmit={handleSaveContratante} className="space-y-6">
                {/* Radiobutton Inicial: Privada e Publica */}
                <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Natureza da Empresa Contratante (Radiobutton Inicial) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option Privada */}
                    <label
                      className={`p-3.5 rounded-md border flex items-start gap-3 cursor-pointer transition-all ${
                        tempContratante.natureza === 'Privada'
                          ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="naturezaContratante"
                        value="Privada"
                        checked={tempContratante.natureza === 'Privada'}
                        onChange={() => setTempContratante({ ...tempContratante, natureza: 'Privada' })}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                          <span className="material-symbols-outlined text-base text-indigo-600">business</span>
                          <span>Privada</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Empresas privadas, sociedades anônimas, concessionárias ou consórcios privados.
                        </p>
                      </div>
                    </label>

                    {/* Option Publica */}
                    <label
                      className={`p-3.5 rounded-md border flex items-start gap-3 cursor-pointer transition-all ${
                        tempContratante.natureza === 'Publica'
                          ? 'bg-white border-[#005daa] ring-2 ring-[#005daa]/20 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="naturezaContratante"
                        value="Publica"
                        checked={tempContratante.natureza === 'Publica'}
                        onChange={() => setTempContratante({ ...tempContratante, natureza: 'Publica' })}
                        className="mt-1 text-[#005daa] focus:ring-[#005daa]"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                          <span className="material-symbols-outlined text-base text-[#005daa]">account_balance</span>
                          <span>Pública</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Autarquias estaduais/federais (ex: DER-SP), órgãos governamentais ou empresas públicas.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Main Required Fields: Nome, Área, Departamento */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Nome */}
                  <div className="md:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nome (Empresa Contratante / Razão Social / Órgão) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Digite o nome da empresa contratante ou órgão público"
                      value={tempContratante.nome}
                      onChange={(e) => setTempContratante({ ...tempContratante, nome: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-md font-bold text-slate-800 focus:border-[#005daa] outline-none"
                    />
                  </div>

                  {/* Área */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Área (Setor de Atuação / Atividade) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Infraestrutura, Tecnologia, Logística"
                      value={tempContratante.area}
                      onChange={(e) => setTempContratante({ ...tempContratante, area: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-md focus:border-[#005daa] outline-none"
                    />
                  </div>

                  {/* Departamento */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Departamento *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Diretoria de Engenharia / Operações"
                      value={tempContratante.departamento}
                      onChange={(e) => setTempContratante({ ...tempContratante, departamento: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-md focus:border-[#005daa] outline-none"
                    />
                  </div>

                  {/* CNPJ */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">CNPJ / Registro</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={tempContratante.cnpj}
                      onChange={(e) => setTempContratante({ ...tempContratante, cnpj: formatCpfCnpj(e.target.value) })}
                      className="w-full p-2.5 border border-slate-200 rounded-md font-mono focus:border-[#005daa] outline-none"
                    />
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">E-mail Institucional</label>
                    <input
                      type="email"
                      placeholder="contato@contratante.com"
                      value={tempContratante.email}
                      onChange={(e) => setTempContratante({ ...tempContratante, email: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-md focus:border-[#005daa] outline-none"
                    />
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Telefone / Ramal</label>
                    <input
                      type="text"
                      placeholder="(11) 3311-0000"
                      value={tempContratante.telefone}
                      onChange={(e) => setTempContratante({ ...tempContratante, telefone: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-md font-mono focus:border-[#005daa] outline-none"
                    />
                  </div>

                  {/* Gestor Responsável */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Gestor Responsável</label>
                    <input
                      type="text"
                      placeholder="Nome do Gestor"
                      value={tempContratante.gestorResponsavel}
                      onChange={(e) => setTempContratante({ ...tempContratante, gestorResponsavel: e.target.value })}
                      className="w-full p-2.5 border border-slate-200 rounded-md focus:border-[#005daa] outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsEditingContratante(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#005daa] hover:bg-[#004884] text-white font-bold text-xs rounded-md shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>Salvar Empresa Contratante</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Display Profile View */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Main Company Card */}
                  <div className="md:col-span-8 bg-slate-50/80 p-5 rounded-lg border border-slate-200 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Empresa Proprietária
                        </span>
                        <h4 className="text-xl font-bold text-slate-800">
                          {empresaContratante.nome || 'Nenhum cadastro de empresa contratante encontrado'}
                        </h4>
                        {!empresaContratante.nome && (
                          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 font-medium">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            Clique no botão "Editar Cadastro" acima para configurar a empresa contratante.
                          </p>
                        )}
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                          empresaContratante.natureza === 'Publica'
                            ? 'bg-blue-100 text-[#005daa] border border-blue-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          {empresaContratante.natureza === 'Publica' ? 'account_balance' : 'business'}
                        </span>
                        <span>{empresaContratante.natureza === 'Publica' ? 'Pública' : 'Privada'}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs">
                      <div className="p-3 bg-white rounded-md border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Área</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">{empresaContratante.area || 'Não cadastrado'}</span>
                      </div>

                      <div className="p-3 bg-white rounded-md border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Departamento</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">{empresaContratante.departamento || 'Não cadastrado'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">CNPJ / Registro</span>
                        <strong className="font-mono text-slate-700">{empresaContratante.cnpj || 'Não informado'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Gestor Responsável</span>
                        <strong className="text-slate-700">{empresaContratante.gestorResponsavel || 'Não informado'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">E-mail Institucional</span>
                        <strong className="text-slate-700">{empresaContratante.email || 'Não informado'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Tenant Summary Card */}
                  <div className="md:col-span-4 bg-gradient-to-br from-[#005daa]/5 to-blue-50 p-5 rounded-lg border border-blue-200 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-[#005daa] font-bold text-xs uppercase tracking-wide mb-2">
                        <span className="material-symbols-outlined text-base">verified</span>
                        <span>Contrato Tenant</span>
                      </div>
                      <div className="text-lg font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-md border border-blue-200 inline-block shadow-2xs">
                        {contratoId}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Empresa contratante máster responsável pelo gerenciamento de fornecedores e prestadores de serviço neste contrato.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-blue-200/60 text-[11px] text-slate-600 flex items-center justify-between">
                      <span>Status do Cadastro:</span>
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        ATIVO & HOMOLOGADO
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Lista de Empresas (Fornecedores, Clientes e Parceiros) */}
      {activeSubTab === 'LISTA' && !isModalOpen && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 bg-white p-5 rounded-md border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Empresas</span>
              <div className="text-2xl font-bold text-slate-800 mt-1 font-mono">{empresas.length}</div>
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Todas com isolamento por tenant ativo
              </span>
            </div>

            <div className="md:col-span-4 bg-white p-5 rounded-md border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fornecedores Ativos</span>
              <div className="text-2xl font-bold text-[#1890ff] mt-1 font-mono">
                {empresas.filter((e) => e.tipo === 'FORNECEDOR' && e.status === 'ATIVO').length}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Acesso com restrição de empresa_id</span>
            </div>

            <div className="md:col-span-4 bg-white p-5 rounded-md border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volume Faturado Global</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                R${' '}
                {empresas
                  .reduce((acc, curr) => acc + curr.totalFaturado, 0)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Sumarização intra-contrato</span>
            </div>
          </div>

      {/* Filter and Table Container (Read View) */}
      <div className="bg-white p-6 rounded-md border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ/CPF, e-mail ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1890ff]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Tipo:</span>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="p-2 border border-slate-200 rounded-md text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todos os Tipos</option>
                <option value="GESTORA">Gestora do Sistema</option>
                <option value="FORNECEDOR">Fornecedores</option>
                <option value="CLIENTE">Clientes</option>
                <option value="PARCEIRO">Parceiros</option>
                <option value="CONTRATANTE">Contratante</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="p-2 border border-slate-200 rounded-md text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="ATIVO">Ativos</option>
                <option value="EM_ANALISE">Em Análise</option>
                <option value="BLOQUEADO">Bloqueados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">ID Empresa</th>
                <th className="p-3">Razão Social / Contato</th>
                <th className="p-3">CNPJ / CPF</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Contrato ID</th>
                <th className="p-3 text-right">Volume Faturado</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações (CRUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEmpresas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    Nenhuma empresa encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEmpresas.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#1890ff]">{item.id}</td>

                    <td className="p-3">
                      <div className="font-bold text-slate-800">{item.nome}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.emailContato || 'Sem e-mail'} {item.telefone ? `• ${item.telefone}` : ''}
                      </div>
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-700">{item.cnpj_cpf}</td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.tipo === 'GESTORA'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit'
                            : item.tipo === 'FORNECEDOR'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.tipo === 'CLIENTE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {item.tipo === 'GESTORA' && <span className="material-symbols-outlined text-[12px]">shield_person</span>}
                        {item.tipo}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-[#1890ff] font-mono font-bold rounded-md text-[10px]">
                        {item.contrato_id}
                      </span>
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      R$ {item.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          item.status === 'ATIVO'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : item.status === 'EM_ANALISE'
                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Send Gestora Master Confirmation Email */}
                        {item.tipo === 'GESTORA' && (
                          <button
                            onClick={() => handleSendGestoraConfirmation(item)}
                            disabled={sendingGestoraEmail === item.id}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-all cursor-pointer disabled:opacity-50"
                            title="Disparar e-mail de reconhecimento de acesso & contingência master"
                          >
                            <span className={`material-symbols-outlined text-base ${sendingGestoraEmail === item.id ? 'animate-spin' : ''}`}>
                              {sendingGestoraEmail === item.id ? 'sync' : 'mark_email_read'}
                            </span>
                          </button>
                        )}

                        {/* View Details Modal */}
                        <button
                          onClick={() => setViewingEmpresa(item)}
                          className="p-1.5 text-slate-500 hover:text-[#1890ff] hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                          title="Visualizar detalhes da empresa"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>

                        {/* Edit Empresa */}
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                          title="Editar cadastro da empresa"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>

                        {/* Toggle Status */}
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`p-1.5 rounded-md transition-all cursor-pointer ${
                            item.status === 'ATIVO'
                              ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={item.status === 'ATIVO' ? 'Bloquear Empresa' : 'Ativar Empresa'}
                        >
                          <span className="material-symbols-outlined text-base">
                            {item.status === 'ATIVO' ? 'block' : 'check_circle'}
                          </span>
                        </button>

                        {/* Delete Empresa */}
                        <button
                          onClick={() => setDeletingEmpresa(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                          title="Excluir Empresa"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}

      {/* INLINE FORM: Create / Edit Empresa (C and U) */}
      {activeSubTab === 'LISTA' && isModalOpen && (
        <div className="bg-white p-6 rounded-b-md border-x border-b border-slate-200 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa] text-2xl">
                  {editingEmpresa ? 'edit_square' : 'domain_add'}
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingEmpresa ? `Editar Cadastro: ${editingEmpresa.id}` : 'Cadastrar Nova Empresa, Cliente ou Fornecedor'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Integre fornecedores e parceiros ao ecossistema do contrato.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md shadow-2xs flex items-center gap-2 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Voltar para Lista</span>
            </button>
          </div>

          <form onSubmit={handleSaveEmpresa} className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Razão Social - Full Width like Contratante */}
              <div className="md:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">Razão Social / Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tech Solutions & Services Ltda"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-md font-bold text-slate-800 focus:border-[#005daa] outline-none"
                />
              </div>

              {/* CNPJ */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">CNPJ ou CPF *</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  value={formData.cnpj_cpf}
                  onChange={(e) => setFormData({ ...formData, cnpj_cpf: formatCpfCnpj(e.target.value) })}
                  className="w-full p-2.5 border border-slate-200 rounded-md font-mono focus:border-[#005daa] outline-none"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Empresa *</label>
                <select
                  value={formData.tipo}
                  onChange={(e: any) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-md font-bold text-slate-700 bg-white"
                >
                  <option value="FORNECEDOR">Fornecedor</option>
                  <option value="CLIENTE">Cliente</option>
                  <option value="PARCEIRO">Parceiro</option>
                  <option value="CONTRATANTE">Empresa Contratante</option>
                  <option value="GESTORA">Gestora (Gestão do Sistema)</option>
                </select>
              </div>
              
              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Cadastral</label>
                <select
                  value={formData.status}
                  onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-md font-bold text-slate-700 bg-white"
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="EM_ANALISE">EM ANÁLISE</option>
                  <option value="BLOQUEADO">BLOQUEADO</option>
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  placeholder="financeiro@empresa.com"
                  value={formData.emailContato}
                  onChange={(e) => setFormData({ ...formData, emailContato: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-md focus:border-[#005daa] outline-none"
                />
              </div>

              {/* Telefone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Telefone</label>
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-md font-mono focus:border-[#005daa] outline-none"
                />
              </div>
              
              {/* Total Faturado */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Faturado Acumulado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.totalFaturado}
                  onChange={(e) => setFormData({ ...formData, totalFaturado: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 border border-slate-200 rounded-md font-mono focus:border-[#005daa] outline-none"
                />
              </div>

            </div>

            {!editingEmpresa && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2 mt-2">
                <label className="block font-bold text-slate-700">Configuração de ID (Personalizado ou Prefixo)</label>
                <div className="flex gap-2">
                  <select
                    value={formData.idPrefix}
                    onChange={(e) => setFormData({ ...formData, idPrefix: e.target.value })}
                    className="p-2.5 border border-slate-200 rounded-md font-mono font-bold bg-white text-slate-700"
                  >
                     <option value="SUP">SUP- (Fornecedor)</option>
                     <option value="CLI">CLI- (Cliente)</option>
                     <option value="PAR">PAR- (Parceiro)</option>
                     <option value="GER">GER- (Gestora)</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Ex: SUP-9900-TECH (Opcional)"
                    value={formData.idCustom}
                    onChange={(e) => setFormData({ ...formData, idCustom: e.target.value })}
                    className="flex-1 p-2.5 border border-slate-200 rounded-md font-mono focus:border-[#005daa] outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Deixe o campo em branco para o sistema gerar automaticamente com o prefixo escolhido.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#005daa] hover:bg-[#004884] text-white font-bold text-xs rounded-md shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>{editingEmpresa ? 'Salvar Alterações' : 'Salvar Nova Empresa'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: View Empresa Details (R) */}
      {viewingEmpresa && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-md max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1890ff]">domain</span>
                Detalhes da Empresa: {viewingEmpresa.id}
              </h3>
              <button
                onClick={() => setViewingEmpresa(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Razão Social / Nome</div>
                <div className="text-slate-800 font-bold text-sm">{viewingEmpresa.nome}</div>
                <div className="text-slate-600 font-mono">CNPJ/CPF: {viewingEmpresa.cnpj_cpf}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tipo</span>
                  <span className="block font-bold text-slate-800 mt-0.5">{viewingEmpresa.tipo}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span className="block font-bold text-slate-800 mt-0.5">{viewingEmpresa.status}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Dados de Contato</span>
                <div className="text-slate-700">E-mail: <strong>{viewingEmpresa.emailContato || 'Não informado'}</strong></div>
                <div className="text-slate-700">Telefone: <strong className="font-mono">{viewingEmpresa.telefone || 'Não informado'}</strong></div>
              </div>

              {/* Empresa Gestora Master Recognition & Recovery Section */}
              {viewingEmpresa.tipo === 'GESTORA' && (
                <div className="p-3.5 bg-amber-50 rounded-md border border-amber-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-600 text-base">shield_person</span>
                      <span className="font-bold text-amber-900 text-xs uppercase">Gestora do Sistema (Acesso Master)</span>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded">19 Permissões Ativas</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Esta é a empresa administradora global do sistema. Em caso de perda de senha, falha no login ou necessidade de troca, envie o certificado de contingência com link de redefinição imediata.
                  </p>
                  {gestoraFeedback && gestoraFeedback.id === viewingEmpresa.id && (
                    <div className={`p-2 rounded text-[11px] font-bold ${gestoraFeedback.success ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                      {gestoraFeedback.message}
                    </div>
                  )}
                  <button
                    onClick={() => handleSendGestoraConfirmation(viewingEmpresa)}
                    disabled={sendingGestoraEmail === viewingEmpresa.id}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all disabled:opacity-60"
                  >
                    <span className={`material-symbols-outlined text-sm ${sendingGestoraEmail === viewingEmpresa.id ? 'animate-spin' : ''}`}>
                      {sendingGestoraEmail === viewingEmpresa.id ? 'sync' : 'outgoing_mail'}
                    </span>
                    {sendingGestoraEmail === viewingEmpresa.id ? 'Disparando Certificado...' : 'Enviar E-mail de Reconhecimento & Recuperação Master'}
                  </button>
                </div>
              )}

              <div className="p-3 bg-blue-50/60 rounded-md border border-blue-200 space-y-1">
                <span className="text-[10px] font-bold text-blue-800 uppercase block">
                  Referência de Claims e Isolamento
                </span>
                <pre className="text-[11px] font-mono text-slate-800 p-2 bg-slate-900 text-emerald-400 rounded-md overflow-x-auto">
{JSON.stringify(
  {
    empresa_id: viewingEmpresa.id,
    contrato_id: viewingEmpresa.contrato_id,
    tipo: viewingEmpresa.tipo,
    totalFaturado: viewingEmpresa.totalFaturado
  },
  null,
  2
)}
                </pre>
              </div>

              <div className="text-[11px] text-slate-400 flex justify-between pt-2 border-t">
                <span>Cadastrado em: {viewingEmpresa.createdAt}</span>
                <span>Tenant: {viewingEmpresa.contrato_id}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewingEmpresa(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-md hover:bg-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation (D) */}
      {deletingEmpresa && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-md max-w-md w-full p-6 space-y-4 border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600 border-b pb-3">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="font-bold text-base text-slate-800">Confirmar Exclusão de Empresa</h3>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>
                Você está prestes a excluir a empresa{' '}
                <strong className="text-slate-800">{deletingEmpresa.nome}</strong> ({deletingEmpresa.id}).
              </p>
              <div className="p-3 bg-rose-50 text-rose-800 font-bold rounded-md border border-rose-200">
                Atenção: Os usuários vinculados a esta empresa (<span className="font-mono">empresa_id</span>) perderão a referência cadastral de fornecedor/parceiro no Tenant <span className="font-mono">{deletingEmpresa.contrato_id}</span>.
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
              <button
                onClick={() => setDeletingEmpresa(null)}
                className="px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-md hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-md hover:bg-rose-700 cursor-pointer shadow-2xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
