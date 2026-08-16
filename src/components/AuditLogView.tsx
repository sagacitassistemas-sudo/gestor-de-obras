import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Clock, AlertTriangle, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { AuthSession, AuditLogEntry, SystemErrorEntry, ValidacaoTarefaEntry } from '../types';

interface AuditLogViewProps {
  authSession: AuthSession | null;
}

export function AuditLogView({ authSession }: AuditLogViewProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'errors' | 'validacoes'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [systemErrors, setSystemErrors] = useState<SystemErrorEntry[]>([]);
  const [validacoes, setValidacoes] = useState<ValidacaoTarefaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagResult, setDiagResult] = useState<{ success: boolean; logs?: string[]; error?: string } | null>(null);
  const [runningDiag, setRunningDiag] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedValidacao, setSelectedValidacao] = useState<ValidacaoTarefaEntry | null>(null);
  const [notasValidacao, setNotasValidacao] = useState('');
  const [novoStatus, setNovoStatus] = useState<'VALIDADO' | 'FALHOU'>('VALIDADO');

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    if (!authSession?.idToken) return;
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'audit') endpoint = '/api/audit-log';
      else if (activeTab === 'errors') endpoint = '/api/system-errors';
      else endpoint = '/api/validacoes';

      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${authSession.idToken}`
        }
      });
      const data = await res.json();
      if (activeTab === 'audit' && data.success) {
        setAuditLogs(data.logs || []);
      } else if (activeTab === 'errors' && data.success) {
        setSystemErrors(data.errors || []);
      } else if (activeTab === 'validacoes' && data.success) {
        setValidacoes(data.validacoes || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidacaoSubmit = async () => {
    if (!authSession?.idToken || !selectedValidacao) return;
    try {
      const res = await fetch(`/api/validacoes/${selectedValidacao.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authSession.idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: novoStatus, notas_validacao: notasValidacao })
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchLogs();
      }
    } catch (e) {
      console.error("Erro ao validar:", e);
    }
  };

  const runDiagnostic = async () => {
    if (!authSession?.idToken) return;
    setRunningDiag(true);
    setDiagResult(null);
    try {
      const res = await fetch('/api/diagnostic/persistence', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.idToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      setDiagResult(data);
    } catch (err: any) {
      setDiagResult({ success: false, error: err.message });
    } finally {
      setRunningDiag(false);
    }
  };

  const getEventBadge = (categoria: string, descricao: string) => {
    switch (categoria) {
      case 'ACESSO':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Activity className="w-3 h-3 mr-1"/>{descricao}</span>;
      case 'CRUD':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><FileText className="w-3 h-3 mr-1"/>{descricao}</span>;
      case 'FALHA':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3 mr-1"/>{descricao}</span>;
      case 'FALHA_SYS':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1"/>{descricao}</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{descricao}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-[#005daa]" />
            Compliance & Auditoria
          </h1>
          <p className="text-gray-500 mt-2 text-lg">Registro inalterável de atividades e falhas do sistema</p>
        </div>
        
        <button
          onClick={runDiagnostic}
          disabled={runningDiag}
          className="bg-[#005daa] text-white px-5 py-2.5 rounded-md font-label-bold flex items-center justify-center gap-2 hover:bg-[#0075d5] transition-colors shadow-sm disabled:opacity-50"
        >
          {runningDiag ? (
            <Clock className="w-5 h-5 animate-spin" />
          ) : (
            <Activity className="w-5 h-5" />
          )}
          <span>{runningDiag ? 'Executando Pipeline...' : 'Testar Persistência (Diagnóstico)'}</span>
        </button>
      </div>

      {diagResult && (
        <div className={`mb-6 p-6 rounded-xl border shadow-sm ${diagResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            {diagResult.success ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-600" />
            )}
            <h3 className={`font-bold text-lg ${diagResult.success ? 'text-green-900' : 'text-red-900'}`}>
              Resultado do Pipeline de Diagnóstico
            </h3>
            <button onClick={() => setDiagResult(null)} className="ml-auto text-gray-500 hover:text-gray-700">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          
          <div className="space-y-2 bg-white/50 rounded-lg p-4 font-mono text-sm">
            {diagResult.logs ? (
              diagResult.logs.map((log, i) => (
                <div key={i} className={`flex items-start gap-2 ${log.startsWith('SUCESSO') ? 'text-green-700 font-bold' : log.startsWith('Falha') ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                  <span className="text-gray-400 select-none">[{String(i+1).padStart(2, '0')}]</span>
                  {log}
                </div>
              ))
            ) : (
              <div className="text-red-600 font-bold">Erro de Execução: {diagResult.error}</div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-4 px-8 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'audit'
                  ? 'border-[#005daa] text-[#005daa]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Trilha de Auditoria (Eventos)
              </div>
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`py-4 px-8 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'errors'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Registro de Falhas (Erros do Sistema)
              </div>
            </button>
            <button
              onClick={() => setActiveTab('validacoes')}
              className={`py-4 px-8 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'validacoes'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Pendências de Validação
                {validacoes.filter(v => v.status === 'PENDENTE').length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1 font-bold">
                    {validacoes.filter(v => v.status === 'PENDENTE').length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <Clock className="w-8 h-8 animate-spin" />
            </div>
          ) : activeTab === 'audit' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data / Hora</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição Detalhada</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {new Date(log.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getEventBadge(log.sistema_eventos_catalogo?.categoria || '', log.sistema_eventos_catalogo?.descricao || log.cod_evento)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.usuario_email || log.usuario_uid || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.descricao || '-'}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p>Nenhum evento registrado ainda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'validacoes' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-orange-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">Criado em</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">Título / Agente</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">Descrição / Notas</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-orange-800 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-orange-800 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {validacoes.map((val) => (
                    <tr key={val.id} className="hover:bg-orange-50/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {new Date(val.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-sm mb-1">{val.titulo}</div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                          🤖 {val.agente}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="mb-2 whitespace-pre-wrap">{val.descricao}</div>
                        {val.notas_validacao && (
                          <div className="bg-gray-50 p-2 rounded text-xs border border-gray-100">
                            <strong>Notas do Validador:</strong><br />
                            {val.notas_validacao}
                          </div>
                        )}
                        {val.link_referencia && (
                          <a href={val.link_referencia} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs mt-1 block">
                            Link Referência
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {val.status === 'PENDENTE' && <span className="text-orange-600 font-bold">Pendente</span>}
                        {val.status === 'VALIDADO' && <span className="text-green-600 font-bold">Validado</span>}
                        {val.status === 'FALHOU' && <span className="text-red-600 font-bold">Falhou</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {val.status === 'PENDENTE' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setSelectedValidacao(val); setNovoStatus('VALIDADO'); setIsModalOpen(true); }}
                              className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded"
                            >
                              Validar
                            </button>
                            <button
                              onClick={() => { setSelectedValidacao(val); setNovoStatus('FALHOU'); setIsModalOpen(true); }}
                              className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded"
                            >
                              Falhar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {validacoes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p>Nenhuma pendência de validação registrada.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Data / Hora</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Falha</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Rota</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Detalhe / Mensagem</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {systemErrors.map((err) => (
                    <tr key={err.id} className="hover:bg-red-50/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {new Date(err.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getEventBadge(err.sistema_eventos_catalogo?.categoria || 'FALHA_SYS', err.sistema_eventos_catalogo?.descricao || err.cod_evento)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 bg-gray-50 rounded px-2">
                        {err.rota || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {err.mensagem}
                      </td>
                    </tr>
                  ))}
                  {systemErrors.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p>Nenhuma falha de sistema registrada.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && selectedValidacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className={`p-4 border-b ${novoStatus === 'VALIDADO' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <h3 className={`font-bold text-lg ${novoStatus === 'VALIDADO' ? 'text-green-800' : 'text-red-800'}`}>
                {novoStatus === 'VALIDADO' ? 'Registrar Validação' : 'Registrar Falha na Validação'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{selectedValidacao.titulo}</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas de Auditoria (Obrigatório para Falhas)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#005daa] focus:border-[#005daa] h-32"
                  placeholder="Descreva o que foi testado, evidências, resultados..."
                  value={notasValidacao}
                  onChange={(e) => setNotasValidacao(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setIsModalOpen(false); setSelectedValidacao(null); setNotasValidacao(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleValidacaoSubmit}
                disabled={novoStatus === 'FALHOU' && notasValidacao.trim().length === 0}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors disabled:opacity-50 ${
                  novoStatus === 'VALIDADO' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirmar {novoStatus === 'VALIDADO' ? 'Validação' : 'Falha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
