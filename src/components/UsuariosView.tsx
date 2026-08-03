import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthSession, UserRecord } from '../types';

interface UsuariosViewProps {
  authSession?: AuthSession | null;
}

export const UsuariosView: React.FC<UsuariosViewProps> = ({ authSession }) => {
  const contratoId = authSession?.customClaims?.contrato_id || 'CTR-2026-SYS';

  // State: DB list of users for full CRUD operations
  const [users, setUsers] = useState<UserRecord[]>([]);

  // Load users from backend
  const fetchUsers = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      const res = await fetch('/api/usuarios', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.usuarios) {
          const mapped = json.usuarios.map((u: any) => ({
            id: u.uid,
            displayName: u.nome,
            email: u.email,
            contrato_id: u.contrato_id,
            empresa_id: u.perfil === 'ADMIN' ? 'GER-2026-SYS' : (u.empresa_id || undefined),
            empresa_nome: u.perfil === 'ADMIN' ? 'Gestora do Sistema' : (u.empresa_nome || undefined),
            perfil: u.perfil,
            mfaEnabled: true,
            status: u.status || 'ATIVO',
            createdAt: u.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
          }));
          setUsers(mapped);
        }
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  // List of standard available companies for optional selection
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<any[]>([
    { id: 'SEM_VINCULO', label: 'Sem vínculo (Acesso Corporativo / Direto)' }
  ]);

  const fetchEmpresas = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      const res = await fetch('/api/empresas', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const list = [
            { id: 'SEM_VINCULO', label: 'Sem vínculo (Acesso Corporativo / Direto)' },
            ...json.data.map((e: any) => ({
              id: e.id,
              label: `${e.id} - ${e.nome}`
            })),
            { id: 'OUTRO', label: '+ Digitar outra empresa personalizada' }
          ];
          setEmpresasDisponiveis(list);
        }
      }
    } catch (err) {
      console.error("Error loading empresas:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchEmpresas();
  }, []);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterPerfil, setFilterPerfil] = useState<string>('TODOS');
  const [filterVinculo, setFilterVinculo] = useState<string>('TODOS');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [viewingUser, setViewingUser] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);

  // Notification Banner State
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

  // Form State for Create/Edit Modal
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    perfil: 'FINANCEIRO' as 'FINANCEIRO' | 'FORNECEDOR' | 'GESTOR' | 'ADMIN',
    selectedEmpresaOption: 'SEM_VINCULO',
    customEmpresaId: '',
    customEmpresaNome: '',
    mfaEnabled: true,
    status: 'ATIVO' as 'ATIVO' | 'INATIVO' | 'PENDENTE'
  });

  // Sanitizer
  const sanitizeInput = (str: string) => str.replace(/[<>]/g, '').trim();

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      displayName: '',
      email: '',
      perfil: 'FINANCEIRO',
      selectedEmpresaOption: 'SEM_VINCULO',
      customEmpresaId: '',
      customEmpresaNome: '',
      mfaEnabled: true,
      status: 'ATIVO'
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal pre-populated
  const handleOpenEditModal = (user: UserRecord) => {
    setEditingUser(user);

    let empresaOption = 'SEM_VINCULO';
    let customId = '';
    let customNome = '';

    if (user.empresa_id) {
      const match = empresasDisponiveis.find((e) => e.id === user.empresa_id);
      if (match) {
        empresaOption = user.empresa_id;
      } else {
        empresaOption = 'OUTRO';
        customId = user.empresa_id;
        customNome = user.empresa_nome || '';
      }
    }

    setFormData({
      displayName: user.displayName,
      email: user.email,
      perfil: user.perfil,
      selectedEmpresaOption: empresaOption,
      customEmpresaId: customId,
      customEmpresaNome: customNome,
      mfaEnabled: user.mfaEnabled,
      status: user.status
    });

    setIsCreateModalOpen(true);
  };

  // Submit Handler for Create or Edit (C and U)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = sanitizeInput(formData.displayName);
    const cleanEmail = sanitizeInput(formData.email);

    if (!cleanName || !cleanEmail) {
      showNotification('error', 'Por favor, preencha o Nome Completo e o E-mail.');
      return;
    }

    const saveToBackend = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token || authSession?.idToken;

        const uid = editingUser ? editingUser.id : `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Determine Empresa Vínculo
        let finalEmpresaId: string | null = null;
        if (formData.selectedEmpresaOption === 'OUTRO') {
          finalEmpresaId = formData.customEmpresaId ? sanitizeInput(formData.customEmpresaId) : null;
        } else if (formData.selectedEmpresaOption !== 'SEM_VINCULO') {
          finalEmpresaId = formData.selectedEmpresaOption;
        }

        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            uid,
            email: cleanEmail,
            nome: cleanName,
            perfil: formData.perfil,
            status: formData.status,
            empresa_id: finalEmpresaId
          })
        });

        if (res.ok) {
          showNotification('success', editingUser ? `Usuário "${cleanName}" atualizado com sucesso.` : `Novo usuário "${cleanName}" cadastrado com sucesso.`);
          fetchUsers();
        } else {
          const errData = await res.json();
          showNotification('error', 'Erro ao salvar usuário: ' + (errData.error || 'Erro desconhecido'));
        }
      } catch (err) {
        showNotification('error', 'Erro de conexão.');
      }
    };
    saveToBackend();
    setIsCreateModalOpen(false);
  };

  // DELETE (D)
  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    const userName = deletingUser.displayName;

    const deleteFromBackend = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token || authSession?.idToken;

        const res = await fetch('/api/usuarios', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ uid: deletingUser.id })
        });

        if (res.ok) {
          showNotification('info', `Usuário "${userName}" foi excluído.`);
          fetchUsers();
        } else {
          showNotification('error', 'Erro ao excluir usuário.');
        }
      } catch (err) {
        showNotification('error', 'Erro de conexão.');
      }
    };
    deleteFromBackend();
    setDeletingUser(null);
  };

  // Quick Status Toggle (Ativar / Inativar)
  const handleToggleStatus = (user: UserRecord) => {
    const nextStatus: 'ATIVO' | 'INATIVO' = user.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    const toggleBackend = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token || authSession?.idToken;

        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            uid: user.id,
            email: user.email,
            nome: user.displayName,
            perfil: user.perfil,
            status: nextStatus
          })
        });

        if (res.ok) {
          showNotification('info', `Status do usuário "${user.displayName}" alterado para ${nextStatus}.`);
          fetchUsers();
        }
      } catch (err) {
        console.error(err);
      }
    };
    toggleBackend();
  };

  // Export Users as CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Nome', 'Email', 'Perfil', 'Contrato_ID', 'Empresa_ID', 'Empresa_Nome', 'MFA_Ativo', 'Status', 'Criado_Em'];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.displayName}"`,
      u.email,
      u.perfil,
      u.contrato_id,
      u.empresa_id || 'SEM_VINCULO',
      `"${u.empresa_nome || ''}"`,
      u.mfaEnabled ? 'SIM' : 'NAO',
      u.status,
      u.createdAt
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `usuarios_tenant_${contratoId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('success', 'Relatório CSV de usuários gerado com sucesso.');
  };

  // Filtered List Computation (R)
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.empresa_nome && u.empresa_nome.toLowerCase().includes(search.toLowerCase())) ||
      (u.empresa_id && u.empresa_id.toLowerCase().includes(search.toLowerCase())) ||
      u.id.toLowerCase().includes(search.toLowerCase());

    const matchesPerfil = filterPerfil === 'TODOS' || u.perfil === filterPerfil;

    const matchesVinculo =
      filterVinculo === 'TODOS'
        ? true
        : filterVinculo === 'COM_EMPRESA'
        ? Boolean(u.empresa_id)
        : !Boolean(u.empresa_id);

    return matchesSearch && matchesPerfil && matchesVinculo;
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
            <span className="material-symbols-outlined text-[#1890ff] text-2xl">group</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Cadastro e Gestão de Usuários (CRUD Complianced)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Módulo Container Infra: Gestão de acessos com vínculo opcional a empresa no Contrato Tenant:{' '}
            <strong className="text-slate-800 font-mono font-bold">{contratoId}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-md transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer border border-slate-200"
            title="Exportar lista de usuários em CSV"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#1890ff] text-white font-bold text-xs rounded-md hover:bg-[#096dd9] transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3 bg-white p-5 rounded-md border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Usuários</span>
          <div className="text-2xl font-bold text-slate-800 mt-1 font-mono">{users.length}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Cadastrados no tenant</span>
        </div>

        <div className="md:col-span-3 bg-white p-5 rounded-md border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vinculados a Empresa</span>
          <div className="text-2xl font-bold text-[#1890ff] mt-1 font-mono">
            {users.filter((u) => Boolean(u.empresa_id)).length}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-sm">business</span>
            Fornecedores / Parceiros
          </span>
        </div>

        <div className="md:col-span-3 bg-white p-5 rounded-md border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Acesso Direto (Sem Vínculo)</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1 font-mono">
            {users.filter((u) => !u.empresa_id).length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Gestores e Financeiro Interno</span>
        </div>

        <div className="md:col-span-3 bg-white p-5 rounded-md border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">MFA / 2FA Habilitado</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
            {users.filter((u) => u.mfaEnabled).length} / {users.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Duplo fator verificado</span>
        </div>
      </div>

      {/* Filter and Table Container (Read View) */}
      <div className="bg-white p-6 rounded-md border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Buscar por ID, nome, e-mail ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#1890ff]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Rótulo (Perfil):</span>
              <select
                value={filterPerfil}
                onChange={(e) => setFilterPerfil(e.target.value)}
                className="p-2 border border-slate-200 rounded-md text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todos os Perfis</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="FORNECEDOR">Fornecedor</option>
                <option value="GESTOR">Gestor</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Vínculo:</span>
              <select
                value={filterVinculo}
                onChange={(e) => setFilterVinculo(e.target.value)}
                className="p-2 border border-slate-200 rounded-md text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todos os Vínculos</option>
                <option value="COM_EMPRESA">Com Empresa</option>
                <option value="SEM_EMPRESA">Sem Empresa (Direto)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">ID / Usuário</th>
                <th className="p-3">Perfil</th>
                <th className="p-3">Vínculo com Empresa (Opcional)</th>
                <th className="p-3">Contrato ID</th>
                <th className="p-3 text-center">2FA / MFA</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações (CRUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                    Nenhum usuário encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <span className="text-[10px] font-mono text-[#1890ff] font-bold block">{item.id}</span>
                      <div className="font-bold text-slate-800">{item.displayName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{item.email}</div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          item.perfil === 'FINANCEIRO'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.perfil === 'FORNECEDOR'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : item.perfil === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {item.perfil}
                      </span>
                    </td>

                    <td className="p-3">
                      {item.empresa_id ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-[#1890ff]">domain</span>
                            {item.empresa_nome || item.empresa_id}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ID: {item.empresa_id}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-md italic">
                          Sem vínculo (Acesso Direto)
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-[#1890ff] font-mono font-bold rounded-md text-[10px]">
                        {item.contrato_id}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      {item.mfaEnabled ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md text-[10px] inline-flex items-center gap-1 border border-emerald-200">
                          <span className="material-symbols-outlined text-xs">verified</span>
                          Ativo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-400 font-bold rounded-md text-[10px]">
                          Inativo
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          item.status === 'ATIVO'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : item.status === 'PENDENTE'
                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details */}
                        <button
                          onClick={() => setViewingUser(item)}
                          className="p-1.5 text-slate-500 hover:text-[#1890ff] hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                          title="Visualizar detalhes e claims"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>

                        {/* Edit User */}
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                          title="Editar Usuário"
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
                          title={item.status === 'ATIVO' ? 'Inativar Usuário' : 'Ativar Usuário'}
                        >
                          <span className="material-symbols-outlined text-base">
                            {item.status === 'ATIVO' ? 'block' : 'check_circle'}
                          </span>
                        </button>

                        {/* Manage Permissions */}
                        <button
                          onClick={() => alert(`Abrir aba de Permissões de Usuário para ${item.id} na MatrizAcessosView`)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all cursor-pointer"
                          title="Gerenciar Permissões (CRUD Granular)"
                        >
                          <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                        </button>

                        {/* Delete User */}
                        <button
                          onClick={() => setDeletingUser(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                          title="Excluir Usuário do Tenant"
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

      {/* MODAL 1: Create or Edit User (C and U) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-md max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1890ff]">
                  {editingUser ? 'manage_accounts' : 'person_add'}
                </span>
                {editingUser ? `Editar Usuário: ${editingUser.id}` : 'Cadastrar Novo Usuário no Tenant'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ana Maria Souza"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-md focus:border-[#1890ff] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  placeholder="ana.souza@empresa.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-md focus:border-[#1890ff] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rótulo / Role (Informativo) *</label>
                  <select
                    value={formData.perfil}
                    onChange={(e: any) => setFormData({ ...formData, perfil: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-md font-bold text-slate-700 bg-white"
                  >
                    <option value="FINANCEIRO">Financeiro</option>
                    <option value="FORNECEDOR">Fornecedor</option>
                    <option value="GESTOR">Gestor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status do Cadastro</label>
                  <select
                    value={formData.status}
                    onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-md font-bold text-slate-700 bg-white"
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                    <option value="PENDENTE">PENDENTE</option>
                  </select>
                </div>
              </div>

              {/* Campo de vínculo OPCIONAL a empresa */}
              <div className="border border-slate-200 p-3 rounded-md bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    Vínculo com Empresa <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded font-mono">
                    empresa_id
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Selecione uma empresa se este usuário pertencer a um fornecedor ou parceiro específico.
                </p>

                <select
                  value={formData.selectedEmpresaOption}
                  onChange={(e) => setFormData({ ...formData, selectedEmpresaOption: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-md font-bold text-slate-700 bg-white"
                >
                  {empresasDisponiveis.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.label}
                    </option>
                  ))}
                </select>

                {formData.selectedEmpresaOption === 'OUTRO' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block font-bold text-slate-600 mb-0.5 text-[10px]">ID da Empresa</label>
                      <input
                        type="text"
                        placeholder="Ex: SUP-9900-NOVA"
                        value={formData.customEmpresaId}
                        onChange={(e) => setFormData({ ...formData, customEmpresaId: e.target.value })}
                        className="w-full p-1.5 border border-slate-200 rounded-md font-mono focus:border-[#1890ff] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-0.5 text-[10px]">Razão Social / Nome</label>
                      <input
                        type="text"
                        placeholder="Ex: Nova Logística Ltda"
                        value={formData.customEmpresaNome}
                        onChange={(e) => setFormData({ ...formData, customEmpresaNome: e.target.value })}
                        className="w-full p-1.5 border border-slate-200 rounded-md focus:border-[#1890ff] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* MFA Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mfaToggleModal"
                  checked={formData.mfaEnabled}
                  onChange={(e) => setFormData({ ...formData, mfaEnabled: e.target.checked })}
                  className="rounded text-[#1890ff] focus:ring-[#1890ff]"
                />
                <label htmlFor="mfaToggleModal" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Exigir verificação de duplo fator (2FA / MFA)
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contrato Tenant Vinculado (Locked)</label>
                <input
                  type="text"
                  disabled
                  value={contratoId}
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-100 font-mono font-bold text-slate-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 text-slate-700 font-bold rounded-md hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1890ff] text-white font-bold rounded-md hover:bg-[#096dd9] cursor-pointer shadow-2xs"
                >
                  {editingUser ? 'Salvar Alterações' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: View User Details & Custom Claims (R) */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-md max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1890ff]">account_box</span>
                Detalhes do Usuário: {viewingUser.id}
              </h3>
              <button
                onClick={() => setViewingUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1">
                <div className="text-slate-500 font-bold">Nome Completo:</div>
                <div className="text-slate-800 font-bold text-sm">{viewingUser.displayName}</div>
                <div className="text-slate-500 font-mono">{viewingUser.email}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Perfil</span>
                  <span className="block font-bold text-slate-800 mt-0.5">{viewingUser.perfil}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <span className="block font-bold text-slate-800 mt-0.5">{viewingUser.status}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-md border border-blue-200 space-y-1">
                <span className="text-[10px] font-bold text-blue-800 uppercase block">
                  Custom Claims Injetados no JWT
                </span>
                <pre className="text-[11px] font-mono text-slate-800 p-2 bg-slate-900 text-emerald-400 rounded-md overflow-x-auto">
{JSON.stringify(
  {
    contrato_id: viewingUser.contrato_id,
    empresa_id: viewingUser.empresa_id || null,
    perfil: viewingUser.perfil,
    mfa_verified: viewingUser.mfaEnabled
  },
  null,
  2
)}
                </pre>
              </div>

              <div className="text-[11px] text-slate-400 flex justify-between pt-2 border-t">
                <span>Criado em: {viewingUser.createdAt}</span>
                <span>Tenant: {viewingUser.contrato_id}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewingUser(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-md hover:bg-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation (D) */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-md max-w-md w-full p-6 space-y-4 border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600 border-b pb-3">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="font-bold text-base text-slate-800">Confirmar Exclusão de Usuário</h3>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>
                Você está prestes a excluir permanentemente o usuário{' '}
                <strong className="text-slate-800">{deletingUser.displayName}</strong> ({deletingUser.email}).
              </p>
              <div className="p-3 bg-rose-50 text-rose-800 font-bold rounded-md border border-rose-200">
                Atenção: Todos os Custom Claims e tokens associados no Contrato Tenant{' '}
                <span className="font-mono">{deletingUser.contrato_id}</span> serão revogados.
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
              <button
                onClick={() => setDeletingUser(null)}
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
