import React, { useState, useEffect } from 'react';
import { AuthSession, EmpresaItem } from '../types';
import { supabase } from '../lib/supabaseClient';
import { formatCpfCnpj, isValidCpfCnpj } from '../utils/documentUtils';

interface FornecedoresViewProps {
  authSession?: AuthSession | null;
  empresas: EmpresaItem[];
  setEmpresas: React.Dispatch<React.SetStateAction<EmpresaItem[]>>;
}

export const FornecedoresView: React.FC<FornecedoresViewProps> = ({ authSession, empresas, setEmpresas }) => {
  const contratoId = authSession?.customClaims?.contrato_id || 'CTR-2026-SYS';

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');

  // Supabase state
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<EmpresaItem | null>(null);
  const [deletingFornecedor, setDeletingFornecedor] = useState<EmpresaItem | null>(null);

  // Toast Notification State
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Advanced Form State (Cadastro Completo)
  const [formData, setFormData] = useState({
    idCustom: '',
    nome: '',
    nomeFantasia: '',
    cnpj_cpf: '',
    tipo: 'FORNECEDOR' as const,
    emailContato: '',
    telefone: '',
    status: 'EM_ANALISE' as 'ATIVO' | 'BLOQUEADO' | 'EM_ANALISE', // Requer aprovação
    totalFaturado: 0,
    // Detalhes JSONB
    detalhes: {
      inscricoes: { estadual: '', municipal: '' },
      endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
      financeiro: { banco: '', agencia: '', conta: '', tipo_conta: 'Corrente', pix: '' },
      contato: { nome: '', cargo: '', celular: '', email: '' }
    }
  });

  // Sanitizer
  const sanitizeInput = (str: string | null | undefined) => (str || '').replace(/[<>]/g, '').trim();

  const handleOpenCreateModal = () => {
    setEditingFornecedor(null);
    setFormData({
      idCustom: '',
      nome: '',
      nomeFantasia: '',
      cnpj_cpf: '',
      tipo: 'FORNECEDOR',
      emailContato: '',
      telefone: '',
      status: 'EM_ANALISE', // Approval required
      totalFaturado: 0,
      detalhes: {
        inscricoes: { estadual: '', municipal: '' },
        endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
        financeiro: { banco: '', agencia: '', conta: '', tipo_conta: 'Corrente', pix: '' },
        contato: { nome: '', cargo: '', celular: '', email: '' }
      }
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (fornecedor: EmpresaItem) => {
    setEditingFornecedor(fornecedor);
    const defaults = {
      inscricoes: { estadual: '', municipal: '' },
      endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
      financeiro: { banco: '', agencia: '', conta: '', tipo_conta: 'Corrente', pix: '' },
      contato: { nome: '', cargo: '', celular: '', email: '' }
    };
    
    // Merge existing details with defaults to avoid uncontrolled inputs
    const existingDetalhes = fornecedor.detalhes || {};
    
    setFormData({
      idCustom: fornecedor.id,
      nome: fornecedor.nome,
      nomeFantasia: existingDetalhes.nomeFantasia || '',
      cnpj_cpf: fornecedor.cnpj_cpf,
      tipo: fornecedor.tipo as 'FORNECEDOR',
      emailContato: fornecedor.emailContato,
      telefone: fornecedor.telefone,
      status: fornecedor.status,
      totalFaturado: fornecedor.totalFaturado,
      detalhes: {
        inscricoes: { ...defaults.inscricoes, ...(existingDetalhes.inscricoes || {}) },
        endereco: { ...defaults.endereco, ...(existingDetalhes.endereco || {}) },
        financeiro: { ...defaults.financeiro, ...(existingDetalhes.financeiro || {}) },
        contato: { ...defaults.contato, ...(existingDetalhes.contato || {}) }
      }
    });
    setIsModalOpen(true);
  };

  const handleSaveFornecedor = async (e: React.FormEvent) => {
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

    if (editingFornecedor) {
      finalId = editingFornecedor.id;
      isNew = false;
    } else {
      finalId = formData.idCustom
        ? sanitizeInput(formData.idCustom).toUpperCase()
        : `SUP-${Math.floor(1000 + Math.random() * 9000)}-${cleanNome.substring(0, 7).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
    }

    // Embed nomeFantasia inside detalhes
    const finalDetalhes = {
      ...formData.detalhes,
      nomeFantasia: sanitizeInput(formData.nomeFantasia)
    };

    const payload: EmpresaItem = {
      id: finalId,
      nome: cleanNome,
      cnpj_cpf: cleanCnpj,
      tipo: 'FORNECEDOR',
      contrato_id: contratoId,
      emailContato: sanitizeInput(formData.emailContato),
      telefone: sanitizeInput(formData.telefone),
      status: formData.status,
      totalFaturado: Number(formData.totalFaturado) || 0,
      createdAt: editingFornecedor?.createdAt || new Date().toISOString().split('T')[0],
      detalhes: finalDetalhes
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
          showNotification('success', `Novo fornecedor "${cleanNome}" cadastrado e enviado para análise.`);
        } else {
          const updatedList = empresas.map((item) => (item.id === finalId ? json.data : item));
          setEmpresas(updatedList);
          showNotification('success', `Fornecedor "${cleanNome}" atualizado com sucesso.`);
        }
        setIsModalOpen(false);
      } else {
        showNotification('error', `Falha ao salvar fornecedor: ${json.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      console.error("Save supplier failed:", err);
      // Fallback local memory
      if (isNew) {
        setEmpresas([payload, ...empresas]);
      } else {
        const updatedList = empresas.map((item) => (item.id === finalId ? payload : item));
        setEmpresas(updatedList);
      }
      showNotification('info', `Salvo temporariamente na memória local devido a erro de rede.`);
      setIsModalOpen(false);
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingFornecedor) return;
    const companyId = deletingFornecedor.id;

    setSupabaseLoading(true);
    try {
      const response = await fetch(`/api/empresas?id=${encodeURIComponent(companyId)}&contrato_id=${encodeURIComponent(contratoId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authSession?.idToken || ''}` }
      });
      const json = await response.json();

      if (json.success) {
        setEmpresas(empresas.filter((item) => item.id !== companyId));
        showNotification('info', `Fornecedor removido do cadastro.`);
      } else {
        showNotification('error', `Falha ao excluir: ${json.error}`);
      }
    } catch (err) {
      setEmpresas(empresas.filter((item) => item.id !== companyId));
      showNotification('info', `Removido localmente.`);
    } finally {
      setSupabaseLoading(false);
      setDeletingFornecedor(null);
    }
  };
  
  const handleAprovarFornecedor = async (fornecedor: EmpresaItem) => {
    const payload = { ...fornecedor, status: 'ATIVO' as 'ATIVO' };
    setSupabaseLoading(true);
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
        setEmpresas(empresas.map((item) => (item.id === fornecedor.id ? json.data : item)));
        showNotification('success', `Fornecedor aprovado (ATIVO).`);
      } else {
        showNotification('error', `Falha ao aprovar.`);
      }
    } catch (err) {
      setEmpresas(empresas.map((item) => (item.id === fornecedor.id ? payload : item)));
      showNotification('info', `Aprovado localmente (Offline).`);
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Razao_Social', 'Nome_Fantasia', 'CNPJ_CPF', 'Status', 'Email', 'Telefone', 'Cidade', 'UF', 'Banco', 'Agencia', 'Conta'];
    const rows = filteredFornecedores.map((f) => {
      const det = f.detalhes || {};
      return [
        f.id,
        `"${f.nome}"`,
        `"${det.nomeFantasia || ''}"`,
        f.cnpj_cpf,
        f.status,
        f.emailContato,
        f.telefone,
        `"${det.endereco?.cidade || ''}"`,
        det.endereco?.uf || '',
        `"${det.financeiro?.banco || ''}"`,
        `"${det.financeiro?.agencia || ''}"`,
        `"${det.financeiro?.conta || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fornecedores_tenant_${contratoId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Computation
  const filteredFornecedores = (empresas || [])
    .filter((e) => e.tipo === 'FORNECEDOR')
    .filter((item) => {
      const s = search.toLowerCase();
      const det = item.detalhes || {};
      const matchesSearch =
        item.nome.toLowerCase().includes(s) ||
        item.cnpj_cpf.includes(s) ||
        (det.nomeFantasia || '').toLowerCase().includes(s) ||
        item.id.toLowerCase().includes(s);

      const matchesStatus = filterStatus === 'TODOS' || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-md border flex items-center justify-between shadow-2xs text-xs font-bold transition-all ${
            notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {notification.type === 'success' ? 'check_circle' : notification.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-md border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1890ff] text-2xl">local_shipping</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Cadastro de Fornecedores</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">Gerenciamento completo de fornecedores com fluxo de aprovação.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer border border-slate-200">
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar</span>
          </button>
          <button onClick={handleOpenCreateModal} className="px-4 py-2 bg-[#1890ff] text-white font-bold text-xs rounded-md hover:bg-[#096dd9] shadow-2xs flex items-center gap-2 cursor-pointer">
            <span className="material-symbols-outlined text-base">add</span>
            <span>Novo Fornecedor</span>
          </button>
        </div>
      </div>

      {/* Filters & List */}
      <div className="bg-white rounded-md border border-slate-200 shadow-2xs">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 rounded-t-md">
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Buscar por Razão, CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md text-xs focus:border-[#1890ff] outline-none text-slate-700 font-bold shadow-inner"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2 bg-white border border-slate-200 rounded-md text-xs text-slate-700 font-bold focus:border-[#1890ff] outline-none w-full sm:w-40"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVO">Aprovados (Ativo)</option>
            <option value="EM_ANALISE">Em Análise (Pendente)</option>
            <option value="BLOQUEADO">Bloqueados</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold uppercase tracking-wider">Fornecedor</th>
                <th className="p-4 font-bold uppercase tracking-wider">CNPJ / Contato</th>
                <th className="p-4 font-bold uppercase tracking-wider">Localidade</th>
                <th className="p-4 font-bold uppercase tracking-wider">Status</th>
                <th className="p-4 font-bold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFornecedores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              ) : (
                filteredFornecedores.map((f) => {
                  const det = f.detalhes || {};
                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-[13px]">{f.nome}</div>
                        {det.nomeFantasia && <div className="text-slate-500 mt-0.5">{det.nomeFantasia}</div>}
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{f.id}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-slate-700 font-bold">{f.cnpj_cpf}</div>
                        <div className="text-slate-500 mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">mail</span> {f.emailContato || 'S/ Email'}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">call</span> {f.telefone || 'S/ Tel'}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        {det.endereco?.cidade ? (
                          <>
                            <div className="font-bold">{det.endereco.cidade} / {det.endereco.uf}</div>
                            <div className="text-[11px] truncate max-w-[150px]" title={det.endereco.logradouro}>{det.endereco.logradouro}</div>
                          </>
                        ) : 'Não informado'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1.5 w-max ${
                          f.status === 'ATIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : f.status === 'EM_ANALISE' ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          <span className="material-symbols-outlined text-[12px]">
                            {f.status === 'ATIVO' ? 'verified' : f.status === 'EM_ANALISE' ? 'hourglass_top' : 'block'}
                          </span>
                          {f.status === 'EM_ANALISE' ? 'Análise Pend.' : f.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {f.status === 'EM_ANALISE' && (
                            <button
                              onClick={() => handleAprovarFornecedor(f)}
                              className="w-7 h-7 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors"
                              title="Aprovar Fornecedor"
                            >
                              <span className="material-symbols-outlined text-sm">thumb_up</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(f)}
                            className="w-7 h-7 rounded bg-blue-50 text-[#1890ff] hover:bg-[#1890ff] hover:text-white flex items-center justify-center transition-colors"
                            title="Editar Cadastro Completo"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => setDeletingFornecedor(f)}
                            className="w-7 h-7 rounded bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal - Cadastro Completo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !supabaseLoading && setIsModalOpen(false)} />
          
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-[101] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-[#1890ff] flex items-center justify-center">
                  <span className="material-symbols-outlined">local_shipping</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingFornecedor ? 'Editar Fornecedor' : 'Cadastro Completo de Fornecedor'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingFornecedor ? `Editando registro ${editingFornecedor.id}` : 'Preencha os dados (requer aprovação posterior)'}
                  </p>
                </div>
              </div>
              <button onClick={() => !supabaseLoading && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
              <form id="fornecedor-form" onSubmit={handleSaveFornecedor} className="space-y-8">
                
                {/* 1. Dados Principais */}
                <section>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">1. Identificação Principal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Razão Social *</label>
                      <input type="text" required value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Razão Social completa" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nome Fantasia</label>
                      <input type="text" value={formData.nomeFantasia} onChange={(e) => setFormData({...formData, nomeFantasia: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Nome Fantasia" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ / CPF *</label>
                      <input type="text" required value={formData.cnpj_cpf} onChange={(e) => setFormData({...formData, cnpj_cpf: formatCpfCnpj(e.target.value)})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 font-mono focus:border-[#1890ff] outline-none" placeholder="00.000.000/0001-00" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Inscrição Estadual</label>
                      <input type="text" value={formData.detalhes.inscricoes.estadual} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, inscricoes: {...formData.detalhes.inscricoes, estadual: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 font-mono focus:border-[#1890ff] outline-none" placeholder="Opcional" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Inscrição Municipal</label>
                      <input type="text" value={formData.detalhes.inscricoes.municipal} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, inscricoes: {...formData.detalhes.inscricoes, municipal: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 font-mono focus:border-[#1890ff] outline-none" placeholder="Opcional" />
                    </div>
                  </div>
                </section>

                {/* 2. Endereço */}
                <section>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">2. Endereço Completo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                      <input type="text" value={formData.detalhes.endereco.cep} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, endereco: {...formData.detalhes.endereco, cep: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 font-mono focus:border-[#1890ff] outline-none" placeholder="00000-000" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Logradouro (Rua, Av, etc)</label>
                      <input type="text" value={formData.detalhes.endereco.logradouro} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, endereco: {...formData.detalhes.endereco, logradouro: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Rua Exemplo" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
                      <input type="text" value={formData.detalhes.endereco.numero} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, endereco: {...formData.detalhes.endereco, numero: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="123" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Complemento</label>
                      <input type="text" value={formData.detalhes.endereco.complemento} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, endereco: {...formData.detalhes.endereco, complemento: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Sala 1, Galpão..." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                      <input type="text" value={formData.detalhes.endereco.bairro} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, endereco: {...formData.detalhes.endereco, bairro: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Bairro" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                      <input type="text" value={formData.detalhes.endereco.cidade} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, endereco: {...formData.detalhes.endereco, cidade: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Cidade" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">UF</label>
                      <input type="text" value={formData.detalhes.endereco.uf} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, endereco: {...formData.detalhes.endereco, uf: e.target.value.toUpperCase()}}})} maxLength={2} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="SP" />
                    </div>
                  </div>
                </section>

                {/* 3. Contatos */}
                <section>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">3. Dados de Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Principal</label>
                      <input type="email" value={formData.emailContato} onChange={(e) => setFormData({...formData, emailContato: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="vendas@fornecedor.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / PABX</label>
                      <input type="text" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="(11) 3333-0000" />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-md border border-slate-200 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Responsável</label>
                        <input type="text" value={formData.detalhes.contato.nome} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, contato: {...formData.detalhes.contato, nome: e.target.value}}})} className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Nome" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cargo</label>
                        <input type="text" value={formData.detalhes.contato.cargo} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, contato: {...formData.detalhes.contato, cargo: e.target.value}}})} className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Ex: Vendedor" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Celular / WhatsApp</label>
                        <input type="text" value={formData.detalhes.contato.celular} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, contato: {...formData.detalhes.contato, celular: e.target.value}}})} className="w-full p-2 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:border-[#1890ff] outline-none" placeholder="(11) 99999-9999" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. Dados Bancários */}
                <section>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">4. Dados Bancários (Pagamento)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Banco</label>
                      <input type="text" value={formData.detalhes.financeiro.banco} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, financeiro: {...formData.detalhes.financeiro, banco: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none" placeholder="Ex: 341 - Itaú, 001 - Banco do Brasil" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Agência</label>
                      <input type="text" value={formData.detalhes.financeiro.agencia} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, financeiro: {...formData.detalhes.financeiro, agencia: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 font-mono focus:border-[#1890ff] outline-none" placeholder="0000" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Conta & Dígito</label>
                      <input type="text" value={formData.detalhes.financeiro.conta} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, financeiro: {...formData.detalhes.financeiro, conta: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 font-mono focus:border-[#1890ff] outline-none" placeholder="00000-0" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Chave PIX</label>
                      <input type="text" value={formData.detalhes.financeiro.pix} onChange={(e) => setFormData({...formData, detalhes: {...formData.detalhes, financeiro: {...formData.detalhes.financeiro, pix: e.target.value}}})} className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 font-mono focus:border-[#1890ff] outline-none" placeholder="CNPJ, Email, Celular ou Aleatória" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Status Interno do Fornecedor</label>
                      <select 
                        value={formData.status} 
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded text-sm text-slate-800 focus:border-[#1890ff] outline-none font-bold"
                      >
                        <option value="EM_ANALISE">Em Análise (Aguardando Aprovação)</option>
                        <option value="ATIVO">Ativo (Homologado)</option>
                        <option value="BLOQUEADO">Bloqueado</option>
                      </select>
                    </div>
                  </div>
                </section>

              </form>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={supabaseLoading}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="fornecedor-form"
                disabled={supabaseLoading}
                className="px-6 py-2 bg-[#1890ff] text-white font-bold text-xs rounded-md hover:bg-[#096dd9] shadow-2xs flex items-center gap-2 disabled:opacity-70 transition-all"
              >
                {supabaseLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>{editingFornecedor ? 'Atualizar Fornecedor' : 'Enviar para Análise'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusão Modal */}
      {deletingFornecedor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !supabaseLoading && setDeletingFornecedor(null)} />
          <div className="bg-white rounded-xl shadow-2xl p-6 relative z-[121] max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Fornecedor?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Tem certeza que deseja excluir o fornecedor <strong className="text-slate-800">{deletingFornecedor.nome}</strong>?
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeletingFornecedor(null)} className="px-4 py-2 border border-slate-300 rounded-md font-bold text-xs text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmDelete} className="px-6 py-2 bg-rose-500 rounded-md font-bold text-xs text-white hover:bg-rose-600 shadow-2xs flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">delete</span> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
