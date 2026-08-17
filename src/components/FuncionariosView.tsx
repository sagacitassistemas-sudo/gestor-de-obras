import React, { useState, useEffect } from 'react';
import { AuthSession, EspecialidadeItem, FuncionarioItem } from '../types';
import { PerfilCompetenciasView } from './PerfilCompetenciasView';
import { GestaoCompetenciasModal } from './GestaoCompetenciasModal';

interface FuncionariosViewProps {
  authSession: AuthSession | null;
}

export const FuncionariosView: React.FC<FuncionariosViewProps> = ({ authSession }) => {
  const [activeTab, setActiveTab] = useState<'funcionarios' | 'especialidades'>('funcionarios');

  // Data States
  const [funcionarios, setFuncionarios] = useState<FuncionarioItem[]>([]);
  const [especialidades, setEspecialidades] = useState<EspecialidadeItem[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('TODOS');
  const [filterEspecialidade, setFilterEspecialidade] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');

  // Modals State
  const [isFuncModalOpen, setIsFuncModalOpen] = useState(false);
  const [editingFunc, setEditingFunc] = useState<FuncionarioItem | null>(null);

  const [isEspModalOpen, setIsEspModalOpen] = useState(false);
  const [editingEsp, setEditingEsp] = useState<EspecialidadeItem | null>(null);

  const [viewingCompetencias, setViewingCompetencias] = useState<FuncionarioItem | null>(null);
  const [gestaoCompetenciasEsp, setGestaoCompetenciasEsp] = useState<EspecialidadeItem | null>(null);

  // Form States
  const [funcFormData, setFuncFormData] = useState({
    nome: '',
    cpf: '',
    cargo: '',
    telefone: '',
    email: '',
    empresa_id: '',
    especialidade_id: '',
    data_admissao: '',
    status: 'ATIVO' as 'ATIVO' | 'INATIVO' | 'AFASTADO'
  });

  const [espFormData, setEspFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#005daa',
    icone: 'engineering',
    status: 'ATIVO' as 'ATIVO' | 'INATIVO'
  });

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch Data
  const fetchData = async () => {
    if (!authSession?.idToken) return;
    setLoading(true);
    try {
      // 1. Fetch Especialidades
      const resEsp = await fetch('/api/especialidades', {
        headers: { Authorization: `Bearer ${authSession.idToken}` },
        cache: 'no-store'
      });
      if (resEsp.ok) {
        const json = await resEsp.json();
        if (json.success) setEspecialidades(json.data || []);
      }

      // 2. Fetch Funcionarios
      const resFunc = await fetch('/api/funcionarios', {
        headers: { Authorization: `Bearer ${authSession.idToken}` },
        cache: 'no-store'
      });
      if (resFunc.ok) {
        const json = await resFunc.json();
        if (json.success) setFuncionarios(json.data || []);
      }

      // 3. Fetch Empresas
      const resEmp = await fetch('/api/empresas', {
        headers: { Authorization: `Bearer ${authSession.idToken}` },
        cache: 'no-store'
      });
      if (resEmp.ok) {
        const json = await resEmp.json();
        if (json.success) setEmpresas(json.data || []);
      }
    } catch (err) {
      console.error("[FuncionariosView] Error fetching data:", err);
      showNotification('error', 'Erro ao carregar dados do servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authSession]);

  // Handlers for Funcionários Modal
  const handleOpenFuncModal = (func?: FuncionarioItem) => {
    if (func) {
      setEditingFunc(func);
      setFuncFormData({
        nome: func.nome,
        cpf: func.cpf || '',
        cargo: func.cargo || '',
        telefone: func.telefone || '',
        email: func.email || '',
        empresa_id: func.empresa_id || '',
        especialidade_id: func.especialidade_id || '',
        data_admissao: func.data_admissao || '',
        status: func.status || 'ATIVO'
      });
    } else {
      setEditingFunc(null);
      setFuncFormData({
        nome: '',
        cpf: '',
        cargo: '',
        telefone: '',
        email: '',
        empresa_id: empresas[0]?.id || '',
        especialidade_id: especialidades[0]?.id || '',
        data_admissao: new Date().toISOString().split('T')[0],
        status: 'ATIVO'
      });
    }
    setIsFuncModalOpen(true);
  };

  const handleSaveFunc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funcFormData.nome.trim() || !funcFormData.empresa_id) {
      showNotification('error', 'Preencha o Nome e a Empresa Fornecedora.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...funcFormData,
        id: editingFunc ? editingFunc.id : undefined
      };

      const res = await fetch('/api/funcionarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showNotification('success', editingFunc ? `Funcionário "${funcFormData.nome}" atualizado.` : `Funcionário "${funcFormData.nome}" cadastrado.`);
        setIsFuncModalOpen(false);
        fetchData();
      } else {
        showNotification('error', json.error || 'Erro ao salvar funcionário.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFunc = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o funcionário "${nome}"?`)) return;
    try {
      const res = await fetch('/api/funcionarios', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showNotification('info', `Funcionário "${nome}" removido.`);
        fetchData();
      } else {
        showNotification('error', 'Erro ao excluir funcionário.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    }
  };

  // Handlers for Especialidades Modal
  const handleOpenEspModal = (esp?: EspecialidadeItem) => {
    if (esp) {
      setEditingEsp(esp);
      setEspFormData({
        nome: esp.nome,
        descricao: esp.descricao || '',
        cor: esp.cor || '#005daa',
        icone: esp.icone || 'engineering',
        status: esp.status || 'ATIVO'
      });
    } else {
      setEditingEsp(null);
      setEspFormData({
        nome: '',
        descricao: '',
        cor: '#005daa',
        icone: 'engineering',
        status: 'ATIVO'
      });
    }
    setIsEspModalOpen(true);
  };

  const handleSaveEsp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!espFormData.nome.trim()) {
      showNotification('error', 'Preencha o Nome da Especialidade.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...espFormData,
        id: editingEsp ? editingEsp.id : undefined
      };

      const res = await fetch('/api/especialidades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showNotification('success', editingEsp ? `Especialidade "${espFormData.nome}" atualizada.` : `Especialidade "${espFormData.nome}" criada.`);
        setIsEspModalOpen(false);
        fetchData();
      } else {
        showNotification('error', json.error || 'Erro ao salvar especialidade.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEsp = async (id: string, nome: string) => {
    if (!window.confirm(`Excluir a especialidade "${nome}"?`)) return;
    try {
      const res = await fetch('/api/especialidades', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showNotification('info', `Especialidade "${nome}" removida.`);
        fetchData();
      } else {
        showNotification('error', 'Erro ao excluir.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    }
  };

  // Filtered Funcionários
  const filteredFuncionarios = funcionarios.filter(f => {
    const matchesSearch =
      f.nome.toLowerCase().includes(search.toLowerCase()) ||
      (f.cpf && f.cpf.includes(search)) ||
      (f.cargo && f.cargo.toLowerCase().includes(search.toLowerCase())) ||
      (f.empresa_nome && f.empresa_nome.toLowerCase().includes(search.toLowerCase()));

    const matchesEmpresa = filterEmpresa === 'TODOS' || f.empresa_id === filterEmpresa;
    const matchesEspecialidade = filterEspecialidade === 'TODOS' || f.especialidade_id === filterEspecialidade;
    const matchesStatus = filterStatus === 'TODOS' || f.status === filterStatus;

    return matchesSearch && matchesEmpresa && matchesEspecialidade && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-md border flex items-center justify-between shadow-xs text-xs font-bold transition-all ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005daa] text-2xl">badge</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Gestão de Mão de Obra & Especialidades
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cadastro de trabalhadores vinculados às Empresas Fornecedoras e alocados em múltiplas equipes operacionais.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('funcionarios')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'funcionarios'
                ? 'bg-white text-[#005daa] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">groups</span>
            Funcionários ({funcionarios.length})
          </button>
          <button
            onClick={() => setActiveTab('especialidades')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'especialidades'
                ? 'bg-white text-[#005daa] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">engineering</span>
            Especialidades ({especialidades.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Mão de Obra</span>
          <div className="text-2xl font-bold text-slate-800 mt-1 font-mono">{funcionarios.length}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Funcionários registrados</span>
        </div>

        <div className="md:col-span-3 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ativos em Campo</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
            {funcionarios.filter(f => f.status === 'ATIVO').length}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Prontos para alocação
          </span>
        </div>

        <div className="md:col-span-3 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alocados em Equipes</span>
          <div className="text-2xl font-bold text-[#005daa] mt-1 font-mono">
            {funcionarios.filter(f => f.equipes && f.equipes.length > 0).length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Compõem 1 ou + equipes</span>
        </div>

        <div className="md:col-span-3 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catálogo de Especialidades</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1 font-mono">{especialidades.length}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Categorias cadastradas</span>
        </div>
      </div>

      {/* ABA 1: FUNCIONÁRIOS */}
      {activeTab === 'funcionarios' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Quadro de Funcionários</h3>
              <p className="text-xs text-slate-500 mt-0.5">Gerencie os trabalhadores por empresa fornecedora e acompanhe suas especialidades e equipes.</p>
            </div>
            <button
              onClick={() => handleOpenFuncModal()}
              className="px-4 py-2 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Novo Funcionário
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar por nome, CPF, cargo ou fornecedora..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#005daa]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterEmpresa}
                onChange={(e) => setFilterEmpresa(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todas as Fornecedoras</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>

              <select
                value={filterEspecialidade}
                onChange={(e) => setFilterEspecialidade(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todas as Especialidades</option>
                {especialidades.map(esp => (
                  <option key={esp.id} value={esp.id}>{esp.nome}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="AFASTADO">Afastado</option>
              </select>
            </div>
          </div>

          {/* Tabela de Funcionários */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Funcionário</th>
                  <th className="p-3">Empresa Fornecedora</th>
                  <th className="p-3">Especialidade (1)</th>
                  <th className="p-3">Equipes Alocadas (N:N)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredFuncionarios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      Nenhum funcionário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredFuncionarios.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.nome}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.cargo ? `${item.cargo} • ` : ''} 
                          <span className="font-bold">{item.especialidade_nome !== 'Sem Especialidade' ? item.especialidade_nome : 'Mão de Obra'}</span>
                          {item.cpf ? ` • CPF: ${item.cpf}` : ''}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-[#005daa]">local_shipping</span>
                          {item.empresa_nome || item.empresa_id}
                        </span>
                      </td>

                      <td className="p-3">
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white inline-flex items-center gap-1"
                          style={{ backgroundColor: item.especialidade_cor || '#005daa' }}
                        >
                          <span className="material-symbols-outlined text-xs">{item.especialidade_icone || 'engineering'}</span>
                          {item.especialidade_nome}
                        </span>
                      </td>

                      <td className="p-3">
                        {item.equipes && item.equipes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.equipes.map((eq, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-[#005daa] text-[10px] font-bold rounded-md flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">groups</span>
                                {eq.equipe_nome} <span className="text-slate-400">({eq.funcao_na_equipe})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sem equipe alocada</span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === 'ATIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.status === 'AFASTADO' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingCompetencias(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                            title="Perfil de Competências"
                          >
                            <span className="material-symbols-outlined text-base">radar</span>
                          </button>
                          <button
                            onClick={() => handleOpenFuncModal(item)}
                            className="p-1.5 text-slate-500 hover:text-[#005daa] hover:bg-slate-100 rounded-md transition-all"
                            title="Editar Funcionário"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteFunc(item.id, item.nome)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                            title="Excluir"
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
      )}

      {/* ABA 2: ESPECIALIDADES */}
      {activeTab === 'especialidades' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Catálogo de Especialidades de Mão de Obra</h3>
              <p className="text-xs text-slate-500 mt-0.5">Cadastre e padronize as especialidades associadas aos funcionários da obra.</p>
            </div>
            <button
              onClick={() => handleOpenEspModal()}
              className="px-4 py-2 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nova Especialidade
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {especialidades.map(esp => (
              <div key={esp.id} className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-2xs"
                      style={{ backgroundColor: esp.cor || '#005daa' }}
                    >
                      <span className="material-symbols-outlined text-lg">{esp.icone || 'engineering'}</span>
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{esp.nome}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {funcionarios.filter(f => f.especialidade_id === esp.id).length} funcionários vinculados
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    esp.status === 'ATIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {esp.status}
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 min-h-[32px]">
                  {esp.descricao || <span className="italic text-slate-400">Sem descrição.</span>}
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setGestaoCompetenciasEsp(esp)}
                    className="flex-1 py-1.5 text-blue-600 hover:bg-blue-50 text-xs font-bold rounded-md transition-all border border-blue-200"
                  >
                    Competências
                  </button>
                  <button
                    onClick={() => handleOpenEspModal(esp)}
                    className="p-1.5 text-slate-500 hover:text-[#005daa] rounded-md transition-all bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteEsp(esp.id, esp.nome)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-all bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Cadastro / Edição de Funcionário */}
      {isFuncModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-md max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa]">badge</span>
                {editingFunc ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
              </h3>
              <button onClick={() => setIsFuncModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveFunc} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Empresa Fornecedora *</label>
                <select
                  required
                  value={funcFormData.empresa_id}
                  onChange={(e) => setFuncFormData({ ...funcFormData, empresa_id: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                >
                  <option value="">Selecione a empresa fornecedora...</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nome} ({emp.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={funcFormData.nome}
                  onChange={(e) => setFuncFormData({ ...funcFormData, nome: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CPF</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={funcFormData.cpf}
                    onChange={(e) => setFuncFormData({ ...funcFormData, cpf: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Encarregado de Obras"
                    value={funcFormData.cargo}
                    onChange={(e) => setFuncFormData({ ...funcFormData, cargo: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Especialidade (1 por Funcionário)</label>
                  <select
                    value={funcFormData.especialidade_id}
                    onChange={(e) => setFuncFormData({ ...funcFormData, especialidade_id: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  >
                    <option value="">Selecione uma especialidade...</option>
                    {especialidades.map(esp => (
                      <option key={esp.id} value={esp.id}>{esp.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={funcFormData.status}
                    onChange={(e) => setFuncFormData({ ...funcFormData, status: e.target.value as any })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="AFASTADO">Afastado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={funcFormData.telefone}
                    onChange={(e) => setFuncFormData({ ...funcFormData, telefone: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="joao@fornecedor.com"
                    value={funcFormData.email}
                    onChange={(e) => setFuncFormData({ ...funcFormData, email: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFuncModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold"
                >
                  {saving ? 'Salvando...' : 'Salvar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Cadastro / Edição de Especialidade */}
      {isEspModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-md max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa]">engineering</span>
                {editingEsp ? 'Editar Especialidade' : 'Nova Especialidade'}
              </h3>
              <button onClick={() => setIsEspModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEsp} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome da Especialidade *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Armador de Ferragens"
                  value={espFormData.nome}
                  onChange={(e) => setEspFormData({ ...espFormData, nome: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Descrição do papel técnico desta especialidade..."
                  value={espFormData.descricao}
                  onChange={(e) => setEspFormData({ ...espFormData, descricao: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cor do Badge</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={espFormData.cor}
                      onChange={(e) => setEspFormData({ ...espFormData, cor: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <span className="font-mono text-slate-500 uppercase">{espFormData.cor}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ícone Material Symbol</label>
                  <select
                    value={espFormData.icone}
                    onChange={(e) => setEspFormData({ ...espFormData, icone: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  >
                    <option value="engineering">engineering (Padrão)</option>
                    <option value="construction">construction (Pedreiro)</option>
                    <option value="bolt">bolt (Eletricista)</option>
                    <option value="plumbing">plumbing (Encanador)</option>
                    <option value="format_paint">format_paint (Pintor)</option>
                    <option value="hardware">hardware (Soldador)</option>
                    <option value="carpentry">carpentry (Carpinteiro)</option>
                    <option value="grid_view">grid_view (Armador)</option>
                    <option value="supervisor_account">supervisor_account (Mestre)</option>
                    <option value="health_and_safety">health_and_safety (Segurança)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEspModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold"
                >
                  {saving ? 'Salvando...' : 'Salvar Especialidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Perfil de Competências (Matriz 360) */}
      {viewingCompetencias && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8 relative">
            <button 
              onClick={() => setViewingCompetencias(null)} 
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-800 bg-slate-100 rounded-full p-2"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="p-2">
              <PerfilCompetenciasView 
                funcionarioId={viewingCompetencias.id} 
                especialidadeId={viewingCompetencias.especialidade_id!} 
                authSession={authSession}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Gestão do Catálogo de Competências por Especialidade */}
      {gestaoCompetenciasEsp && (
        <GestaoCompetenciasModal 
          especialidade={gestaoCompetenciasEsp} 
          authSession={authSession}
          onClose={() => setGestaoCompetenciasEsp(null)} 
        />
      )}
    </div>
  );
};
