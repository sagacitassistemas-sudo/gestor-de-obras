import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Clock, AlertTriangle, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { AuthSession, AuditLogEntry, SystemErrorEntry } from '../types';

interface AuditLogViewProps {
  authSession: AuthSession | null;
}

export function AuditLogView({ authSession }: AuditLogViewProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'errors'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [systemErrors, setSystemErrors] = useState<SystemErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagResult, setDiagResult] = useState<{ success: boolean; logs?: string[]; error?: string } | null>(null);
  const [runningDiag, setRunningDiag] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    if (!authSession?.idToken) return;
    setLoading(true);
    try {
      const endpoint = activeTab === 'audit' ? '/api/audit-log' : '/api/system-errors';
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
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
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
    </div>
  );
}
