import React, { useState, useEffect } from 'react';
import { AuthSession, DispositivoItem } from '../types';

interface DispositivosViewProps {
  authSession: AuthSession | null;
  contratoId: string;
}

export const DispositivosView: React.FC<DispositivosViewProps> = ({ authSession, contratoId }) => {
  const [dispositivos, setDispositivos] = useState<DispositivoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('TODOS');

  const fetchData = async () => {
    if (!authSession?.idToken) return;
    try {
      setLoading(true);
      const res = await fetch('/api/dispositivos', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setDispositivos(json.data || []);
      } else {
        showNotification('error', json.error || 'Erro ao carregar dispositivos.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authSession?.idToken, contratoId]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleUpdateStatus = async (device: DispositivoItem, newStatus: 'APROVADO' | 'BLOQUEADO' | 'PENDENTE') => {
    const actionName = newStatus === 'APROVADO' ? 'aprovar' : newStatus === 'BLOQUEADO' ? 'bloquear' : 'reverter para pendente';
    if (!window.confirm(`Tem certeza que deseja ${actionName} o dispositivo do funcionário ${device.funcionario_nome || 'Desconhecido'}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/dispositivos/${device.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showNotification('success', `Dispositivo atualizado para ${newStatus}.`);
        fetchData();
      } else {
        showNotification('error', json.error || 'Erro ao atualizar status.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    }
  };

  const handleDelete = async (device: DispositivoItem) => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR o dispositivo do funcionário ${device.funcionario_nome || 'Desconhecido'}? O aparelho precisará ser registrado novamente.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/dispositivos/${device.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authSession?.idToken}`
        }
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showNotification('success', 'Dispositivo excluído com sucesso.');
        fetchData();
      } else {
        showNotification('error', json.error || 'Erro ao excluir dispositivo.');
      }
    } catch (err) {
      showNotification('error', 'Erro de conexão.');
    }
  };

  const filteredDispositivos = dispositivos.filter(d => {
    const matchesSearch = 
      (d.funcionario_nome && d.funcionario_nome.toLowerCase().includes(search.toLowerCase())) ||
      (d.funcionario_cpf && d.funcionario_cpf.includes(search)) ||
      (d.empresa_nome && d.empresa_nome.toLowerCase().includes(search.toLowerCase())) ||
      (d.device_id && d.device_id.toLowerCase().includes(search.toLowerCase())) ||
      (d.modelo && d.modelo.toLowerCase().includes(search.toLowerCase()));
      
    const matchesStatus = filterStatus === 'TODOS' || d.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = dispositivos.filter(d => d.status === 'PENDENTE').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-md border flex items-center justify-between shadow-2xs text-xs font-bold transition-all ${
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
            <span className="material-symbols-outlined text-[#005daa] text-2xl">devices</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Gestão de Dispositivos Mobile
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de acesso Zero Trust para o aplicativo de campo. Aprovação e bloqueio de aparelhos.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors border border-slate-200 shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Atualizar Lista
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Registrados</span>
          <div className="text-2xl font-bold text-slate-800 mt-1 font-mono">{dispositivos.length}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Aparelhos vinculados</span>
        </div>

        <div className="md:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden">
          {pendingCount > 0 && (
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-100 rounded-bl-full flex items-start justify-end p-2">
               <span className="relative flex h-3 w-3 mt-1 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>
          )}
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Aguardando Aprovação</span>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">{pendingCount}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Dispositivos novos (Pendente)</span>
        </div>

        <div className="md:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Acesso Liberado</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
            {dispositivos.filter(d => d.status === 'APROVADO').length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Dispositivos ativos em campo</span>
        </div>
      </div>

      {/* Tabela e Filtros */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Buscar por funcionário, CPF, empresa ou aparelho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#005daa]"
            />
          </div>

          <div className="flex items-center gap-3">
             <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-700"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="APROVADO">Aprovados</option>
                <option value="BLOQUEADO">Bloqueados</option>
              </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Funcionário</th>
                <th className="p-3">Empresa Fornecedora</th>
                <th className="p-3">Dispositivo (Modelo)</th>
                <th className="p-3">Último Login</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">Carregando dispositivos...</td>
                </tr>
              ) : filteredDispositivos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">Nenhum dispositivo encontrado.</td>
                </tr>
              ) : (
                filteredDispositivos.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{item.funcionario_nome || 'Desconhecido'}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.funcionario_cargo ? `${item.funcionario_cargo} • ` : ''} 
                        {item.funcionario_cpf ? `CPF: ${item.funcionario_cpf}` : ''}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-[#005daa]">domain</span>
                        {item.empresa_nome || item.empresa_id || 'Sem Vínculo'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800 truncate max-w-[150px]" title={item.modelo}>
                        {item.modelo || 'Modelo Desconhecido'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400" title={item.device_id}>
                        ID: {item.device_id.substring(0, 16)}...
                      </div>
                    </td>
                    <td className="p-3">
                       <span className="text-slate-600 font-mono">
                         {item.last_login ? new Date(item.last_login).toLocaleString('pt-BR') : 'Nunca acessou'}
                       </span>
                    </td>
                    <td className="p-3 text-center">
                       <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          item.status === 'APROVADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          item.status === 'PENDENTE' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          'bg-rose-50 text-rose-600 border-rose-200'
                       }`}>
                         {item.status}
                       </span>
                    </td>
                    <td className="p-3 text-right">
                       <div className="flex items-center justify-end gap-1">
                          {item.status !== 'APROVADO' && (
                            <button
                              onClick={() => handleUpdateStatus(item, 'APROVADO')}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all cursor-pointer"
                              title="Aprovar Acesso"
                            >
                              <span className="material-symbols-outlined text-base">check_circle</span>
                            </button>
                          )}
                          {item.status !== 'BLOQUEADO' && (
                            <button
                              onClick={() => handleUpdateStatus(item, 'BLOQUEADO')}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                              title="Bloquear Acesso"
                            >
                              <span className="material-symbols-outlined text-base">block</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer ml-2 border-l border-slate-200 pl-2"
                            title="Excluir Registro de Dispositivo"
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
  );
};
