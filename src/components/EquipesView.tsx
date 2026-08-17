import React, { useState, useEffect } from 'react';
import { AuthSession, EquipeItem, FuncionarioItem } from '../types';
import { CessoesPessoalModal } from './CessoesPessoalModal';

interface EquipesViewProps {
  authSession: AuthSession | null;
}

export const EquipesView: React.FC<EquipesViewProps> = ({ authSession }) => {
  const [equipes, setEquipes] = useState<EquipeItem[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioItem[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);

  const [selectedEquipe, setSelectedEquipe] = useState<EquipeItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Filters
  const [filterEmpresa, setFilterEmpresa] = useState<string>('TODOS');
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCessoesModalOpen, setIsCessoesModalOpen] = useState(false);
  const [editingEquipe, setEditingEquipe] = useState<EquipeItem | null>(null);
  const [cessoes, setCessoes] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    empresa_id: '',
    nome: '',
    lider_id: '',
    status: 'ATIVA' as 'ATIVA' | 'INATIVA' | 'EM_CAMPO'
  });

  // Selected Members for current team: Array of { funcionario_id, funcao_na_equipe }
  const [selectedMembers, setSelectedMembers] = useState<Array<{ funcionario_id: string; funcao_na_equipe: string }>>([]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch Data
  const fetchData = async () => {
    if (!authSession?.idToken) return;
    setLoading(true);
    try {
      // 1. Fetch Equipes
      const resEq = await fetch('/api/equipes', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      });
      if (resEq.ok) {
        const json = await resEq.json();
        if (json.success) setEquipes(json.data || []);
      }

      // 2. Fetch Funcionarios
      const resFunc = await fetch('/api/funcionarios', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      });
      if (resFunc.ok) {
        const json = await resFunc.json();
        if (json.success) setFuncionarios(json.data || []);
      }

      // 3. Fetch Empresas
      const resEmp = await fetch('/api/empresas', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      });
      if (resEmp.ok) {
        const json = await resEmp.json();
        if (json.success) setEmpresas(json.data || []);
      }

      // 4. Fetch Cessões
      const resCessoes = await fetch('/api/cessoes-pessoal', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      });
      if (resCessoes.ok) {
        const jsonC = await resCessoes.json();
        if (jsonC.success) setCessoes(jsonC.data || []);
      }
    } catch (err) {
      console.error("[EquipesView] Error fetching data:", err);
      showNotification('error', 'Erro ao carregar dados do servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authSession]);

  // Open Modal Handler
  const handleEncerrarCessao = async (cessaoId: string) => {
    if (!authSession?.idToken) return;
    if (!confirm("Deseja realmente encerrar esta cessão e retornar o funcionário à equipe de origem?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/cessoes-pessoal/${cessaoId}/encerrar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authSession.idToken}` },
        body: JSON.stringify({ data_fim: new Date().toISOString() })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', 'Cessão encerrada com sucesso.');
        fetchData();
      } else {
        showNotification('error', data.error || 'Erro ao encerrar cessão.');
      }
    } catch (err) {
      showNotification('error', 'Erro ao processar encerramento.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCessoesModal = () => {
    if (!selectedEquipe) return;
    setIsCessoesModalOpen(true);
  };

  const handleOpenModal = (equipe?: EquipeItem) => {
    if (equipe) {
      setEditingEquipe(equipe);
      setFormData({
        empresa_id: equipe.empresa_id,
        nome: equipe.nome,
        lider_id: equipe.lider_id || '',
        status: equipe.status || 'ATIVA'
      });
      const members = (equipe.membros || []).map(m => ({
        funcionario_id: m.funcionario_id,
        funcao_na_equipe: m.funcao_na_equipe || 'MEMBRO'
      }));
      setSelectedMembers(members);
    } else {
      setEditingEquipe(null);
      const defaultEmpresaId = empresas[0]?.id || '';
      setFormData({
        empresa_id: defaultEmpresaId,
        nome: '',
        lider_id: '',
        status: 'ATIVA'
      });
      setSelectedMembers([]);
    }
    setIsModalOpen(true);
  };

  // Available employees for the selected empresa in modal
  const availableFuncs = funcionarios.filter(f => f.empresa_id === formData.empresa_id && f.status === 'ATIVO');

  // Toggle member inclusion
  const handleToggleMember = (funcId: string) => {
    const exists = selectedMembers.some(m => m.funcionario_id === funcId);
    if (exists) {
      setSelectedMembers(prev => prev.filter(m => m.funcionario_id !== funcId));
    } else {
      setSelectedMembers(prev => [...prev, { funcionario_id: funcId, funcao_na_equipe: 'MEMBRO' }]);
    }
  };

  // Change member role
  const handleMemberRoleChange = (funcId: string, role: string) => {
    setSelectedMembers(prev =>
      prev.map(m => (m.funcionario_id === funcId ? { ...m, funcao_na_equipe: role } : m))
    );
  };

  // Save Team
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.empresa_id) {
      showNotification('error', 'Nome da Equipe e Empresa Fornecedora são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...formData,
        id: editingEquipe ? editingEquipe.id : undefined,
        membros: selectedMembers
      };

      const res = await fetch('/api/equipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showNotification('success', editingEquipe ? `Equipe "${formData.nome}" atualizada.` : `Equipe "${formData.nome}" cadastrada.`);
        setIsModalOpen(false);
        fetchData();
      } else {
        showNotification('error', json.error || 'Erro ao salvar equipe.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (id: string, nome: string) => {
    if (!window.confirm(`Excluir a equipe "${nome}"?`)) return;
    try {
      const res = await fetch('/api/equipes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showNotification('info', `Equipe "${nome}" removida.`);
        if (selectedEquipe?.id === id) setSelectedEquipe(null);
        fetchData();
      } else {
        showNotification('error', 'Erro ao excluir equipe.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    }
  };

  // Filtered teams
  const filteredEquipes = equipes.filter(eq => {
    const matchesEmpresa = filterEmpresa === 'TODOS' || eq.empresa_id === filterEmpresa;
    const matchesSearch =
      eq.nome.toLowerCase().includes(search.toLowerCase()) ||
      (eq.empresa_nome && eq.empresa_nome.toLowerCase().includes(search.toLowerCase())) ||
      (eq.lider_nome && eq.lider_nome.toLowerCase().includes(search.toLowerCase()));

    return matchesEmpresa && matchesSearch;
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
            <span className="material-symbols-outlined text-[#005daa] text-2xl">engineering</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Gestão de Equipes Operacionais
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Equipes formadas por funcionários das Empresas Fornecedoras para execução das Ordens de Serviço (OS).
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold text-xs flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nova Equipe
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por nome da equipe, fornecedora ou líder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#005daa]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Filtrar Fornecedora:</span>
          <select
            value={filterEmpresa}
            onChange={(e) => setFilterEmpresa(e.target.value)}
            className="p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-700"
          >
            <option value="TODOS">Todas as Empresas Fornecedoras</option>
            {empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Master-Detail Split Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Teams List */}
        <div className="lg:w-5/12 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden min-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Equipes Cadastradas ({filteredEquipes.length})</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredEquipes.length === 0 ? (
              <p className="text-center text-xs text-slate-400 p-8 font-bold">Nenhuma equipe encontrada.</p>
            ) : (
              filteredEquipes.map(eq => (
                <div
                  key={eq.id}
                  onClick={() => setSelectedEquipe(eq)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedEquipe?.id === eq.id
                      ? 'border-[#005daa] bg-blue-50/40 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{eq.nome}</h4>
                      <span className="text-[11px] text-[#005daa] font-bold flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-xs">domain</span>
                        {eq.empresa_nome}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      eq.status === 'ATIVA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      eq.status === 'EM_CAMPO' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {eq.status === 'EM_CAMPO' ? 'Em Campo' : eq.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 mt-2">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-sm text-slate-400">group</span>
                      {eq.membros ? eq.membros.length : 0} Membros
                    </span>
                    {eq.lider_nome && (
                      <span className="flex items-center gap-1 text-slate-600 font-bold">
                        <span className="material-symbols-outlined text-sm text-amber-500">star</span>
                        Líder: {eq.lider_nome}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Selected Team Details */}
        <div className="lg:w-7/12 bg-white rounded-xl border border-slate-200 shadow-2xs p-6 flex flex-col">
          {selectedEquipe ? (
            <div className="space-y-6">
              {/* Header Details */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005daa] text-2xl">groups</span>
                    <h3 className="text-xl font-bold text-slate-800">{selectedEquipe.nome}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-[#005daa]">local_shipping</span>
                    Empresa Fornecedora: <strong className="text-slate-800">{selectedEquipe.empresa_nome}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenCessoesModal}
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#005daa] border border-sky-200 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">swap_horiz</span>
                    Ceder Funcionário
                  </button>
                  <button
                    onClick={() => handleOpenModal(selectedEquipe)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Editar Equipe
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(selectedEquipe.id, selectedEquipe.nome)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Excluir
                  </button>
                </div>
              </div>

              {/* Frente de Trabalho / OS Ativa */}
              {selectedEquipe.ordens_servico && selectedEquipe.ordens_servico.length > 0 ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-3">
                  <strong className="text-slate-800 block border-b border-slate-200 pb-2 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005daa] text-[18px]">assignment</span>
                    Ordens de Serviço (Frente de Trabalho)
                  </strong>
                  
                  {selectedEquipe.ordens_servico.map((os: any) => (
                    <div key={os.id} className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-[#005daa]">{os.numero_os}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          os.status === 'Emitida' ? 'bg-sky-100 text-sky-800' :
                          os.status === 'Em Andamento' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {os.status}
                        </span>
                      </div>
                      <div className="mb-2">
                        <strong className="text-slate-800">Serviço (EAP):</strong> {os.itens_eap?.descricao_servico || 'Não especificado'}
                      </div>
                      <div className="text-slate-600 mb-3 text-[11px] whitespace-pre-wrap">
                        {os.descricao || 'Sem descrição detalhada.'}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <strong className="block mb-1 text-slate-700">Materiais:</strong>
                          <span className="whitespace-pre-wrap">{os.materiais || '-'}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <strong className="block mb-1 text-slate-700">Equip./Ferramentas:</strong>
                          <span className="whitespace-pre-wrap">
                            {os.equipamentos ? `Eq: ${os.equipamentos}\n` : ''}
                            {os.ferramentas ? `Fe: ${os.ferramentas}` : ''}
                            {!os.equipamentos && !os.ferramentas && '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-500 text-center italic">
                  Nenhuma Ordem de Serviço vinculada a esta equipe.
                </div>
              )}

              {/* Team Members List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#005daa]">badge</span>
                    Membros da Equipe ({selectedEquipe.membros ? selectedEquipe.membros.length : 0})
                  </h4>
                  <span className="text-[11px] text-slate-400 italic">
                    Funcionários podem compor múltiplas equipes
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedEquipe.membros && selectedEquipe.membros.length > 0 ? (
                    selectedEquipe.membros.map(m => (
                      <div key={m.funcionario_id} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                            {m.funcionario_id === selectedEquipe.lider_id && (
                              <span className="material-symbols-outlined text-xs text-amber-500" title="Líder da Equipe">star</span>
                            )}
                            {m.nome}
                          </div>
                          <div className="text-[10px] text-slate-500">{m.cargo || 'Mão de Obra'}</div>
                          
                          {/* Especialidade Badge */}
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white inline-flex items-center gap-1"
                            style={{ backgroundColor: m.especialidade_cor || '#005daa' }}
                          >
                            <span className="material-symbols-outlined text-[10px]">{m.especialidade_icone || 'engineering'}</span>
                            {m.especialidade_nome}
                          </span>
                        </div>

                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                          {m.funcao_na_equipe}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-6 text-center text-xs text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl">
                      Nenhum membro alocado nesta equipe. Clique em "Editar Equipe" para adicionar.
                    </div>
                  )}
                </div>
              </div>
              {/* Seção de Cessões Ativas */}
              {(() => {
                const cessoesSaida = cessoes.filter(c => c.equipe_origem_id === selectedEquipe.id);
                const cessoesEntrada = cessoes.filter(c => c.equipe_destino_id === selectedEquipe.id);
                
                if (cessoesSaida.length === 0 && cessoesEntrada.length === 0) return null;

                return (
                  <div className="space-y-3 mt-6 pt-6 border-t border-slate-100">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-amber-500">sync_alt</span>
                      Cessões Temporárias Ativas
                    </h4>
                    
                    {cessoesSaida.length > 0 && (
                      <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 mb-2">
                        <p className="text-xs font-bold text-red-800 mb-2">Cedidos para outras equipes (Saída):</p>
                        <div className="space-y-2">
                          {cessoesSaida.map(c => (
                            <div key={c.id} className="flex items-center justify-between bg-white p-2 rounded border border-red-100 shadow-sm text-xs">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500 text-sm">logout</span>
                                <div>
                                  <strong className="text-slate-800 block">{c.funcionarios?.nome}</strong>
                                  <span className="text-slate-500">→ Cedeu para: <strong className="text-red-700">{c.equipe_destino?.nome}</strong></span>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleEncerrarCessao(c.id)}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold hover:bg-red-200 transition-colors"
                              >
                                Encerrar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cessoesEntrada.length > 0 && (
                      <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                        <p className="text-xs font-bold text-emerald-800 mb-2">Recebidos de outras equipes (Entrada):</p>
                        <div className="space-y-2">
                          {cessoesEntrada.map(c => (
                            <div key={c.id} className="flex items-center justify-between bg-white p-2 rounded border border-emerald-100 shadow-sm text-xs">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500 text-sm">login</span>
                                <div>
                                  <strong className="text-slate-800 block">{c.funcionarios?.nome}</strong>
                                  <span className="text-slate-500">← Vindo de: <strong className="text-emerald-700">{c.equipe_origem?.nome}</strong></span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 min-h-[400px]">
              <span className="material-symbols-outlined text-[64px] text-slate-200 mb-3">engineering</span>
              <h4 className="font-bold text-slate-700 text-base">Nenhuma Equipe Selecionada</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Selecione uma equipe na lista ao lado para visualizar seus membros, especialidades e alocações.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Criar / Editar Equipe */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-md max-w-2xl w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa]">groups</span>
                {editingEquipe ? `Editar Equipe: ${editingEquipe.nome}` : 'Cadastrar Nova Equipe'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Empresa Fornecedora *</label>
                  <select
                    required
                    value={formData.empresa_id}
                    onChange={(e) => {
                      setFormData({ ...formData, empresa_id: e.target.value, lider_id: '' });
                      setSelectedMembers([]);
                    }}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  >
                    <option value="">Selecione a empresa fornecedora...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome da Equipe *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Equipe Alfa - Elétrica"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Líder da Equipe (Opcional)</label>
                  <select
                    value={formData.lider_id}
                    onChange={(e) => setFormData({ ...formData, lider_id: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  >
                    <option value="">Selecione o funcionário líder...</option>
                    {availableFuncs.map(f => (
                      <option key={f.id} value={f.id}>{f.nome} ({f.especialidade_nome})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status da Equipe</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:border-[#005daa] outline-none"
                  >
                    <option value="ATIVA">Ativa</option>
                    <option value="EM_CAMPO">Em Campo</option>
                    <option value="INATIVA">Inativa</option>
                  </select>
                </div>
              </div>

              {/* Members Multi-select Section */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-800 text-xs block">
                    Alocar Funcionários na Equipe ({selectedMembers.length} selecionados)
                  </label>
                  <span className="text-[10px] text-slate-400 italic">
                    Exibindo funcionários da fornecedora selecionada
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2 divide-y divide-slate-100 space-y-1">
                  {availableFuncs.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 p-4">
                      Nenhum funcionário ativo cadastrado nesta empresa fornecedora.
                    </p>
                  ) : (
                    availableFuncs.map(f => {
                      const isSelected = selectedMembers.some(m => m.funcionario_id === f.id);
                      const currentMember = selectedMembers.find(m => m.funcionario_id === f.id);
                      const otherTeams = f.equipes ? f.equipes.filter(e => e.equipe_id !== editingEquipe?.id) : [];

                      return (
                        <div key={f.id} className={`p-2.5 rounded-lg flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleMember(f.id)}
                              className="w-4 h-4 text-[#005daa] rounded border-slate-300 focus:ring-[#005daa]"
                            />
                            <div>
                              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                {f.nome}
                                <span
                                  className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white inline-flex items-center gap-1"
                                  style={{ backgroundColor: f.especialidade_cor || '#005daa' }}
                                >
                                  <span className="material-symbols-outlined text-[10px]">{f.especialidade_icone || 'engineering'}</span>
                                  {f.especialidade_nome}
                                </span>
                              </div>
                              {otherTeams.length > 0 && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <span className="material-symbols-outlined text-[10px] text-amber-500">info</span>
                                  Também compõe: {otherTeams.map(t => t.equipe_nome).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <select
                              value={currentMember?.funcao_na_equipe || 'MEMBRO'}
                              onChange={(e) => handleMemberRoleChange(f.id, e.target.value)}
                              className="p-1 border border-slate-200 rounded text-[10px] font-bold bg-white text-slate-700"
                            >
                              <option value="MEMBRO">Membro</option>
                              <option value="LIDER">Líder</option>
                              <option value="COORDENADOR">Coordenador</option>
                              <option value="SUPORTE_TECNICO">Suporte Técnico</option>
                              <option value="AUXILIAR">Auxiliar</option>
                            </select>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#005daa] hover:bg-[#004a88] text-white rounded-lg font-bold"
                >
                  {saving ? 'Salvando...' : 'Salvar Equipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEquipe && (
        <CessoesPessoalModal
          isOpen={isCessoesModalOpen}
          onClose={() => setIsCessoesModalOpen(false)}
          equipeOrigem={selectedEquipe}
          authSession={authSession}
          onSuccess={() => {
            showNotification('success', 'Cessão de funcionário registrada com sucesso.');
            fetchData();
          }}
        />
      )}
    </div>
  );
};
