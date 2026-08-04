import React, { useState, useEffect, useCallback } from 'react';
import { AuthSession } from '../types';

interface ParametrosViewProps {
  authSession: AuthSession | null;
}

interface SystemParams {
  JWT_SESSION_TTL: string;
  JWT_MFA_TICKET_TTL: string;
  AUDIT_LOG_RETENTION_DAYS: number;
  ERROR_LOG_RETENTION_DAYS: number;
  CLAIMS_SYNC_ENABLED: boolean;
}

const PARAM_LABELS: Record<keyof SystemParams, { label: string; desc: string; group: string }> = {
  JWT_SESSION_TTL:             { label: "Duração da Sessão (JWT)",       desc: "Tempo de validade do token de sessão do usuário. Ex: 4h, 8h, 24h",         group: "Autenticação" },
  JWT_MFA_TICKET_TTL:          { label: "Validade do Ticket MFA",        desc: "Tempo de validade do desafio de autenticação MFA/2FA. Ex: 10m, 15m",       group: "Autenticação" },
  AUDIT_LOG_RETENTION_DAYS:    { label: "Retenção Audit Log (dias)",     desc: "Dias de retenção do registro de eventos de auditoria (CRUD/Acessos)",      group: "Compliance / Logs" },
  ERROR_LOG_RETENTION_DAYS:    { label: "Retenção Error Log (dias)",     desc: "Dias de retenção dos registros de falhas de backend",                      group: "Compliance / Logs" },
  CLAIMS_SYNC_ENABLED:         { label: "Sincronismo Claims Automático", desc: "Sincroniza o perfil do Supabase com o Firebase a cada login do usuário",   group: "Sincronismo" },
};

const PARAM_GROUPS = ["Autenticação", "Compliance / Logs", "Sincronismo"];

export const ParametrosView: React.FC<ParametrosViewProps> = ({ authSession }) => {
  const [params, setParams] = useState<SystemParams | null>(null);
  const [editParams, setEditParams] = useState<SystemParams | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showNotif = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadParams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/parametros', {
        headers: { Authorization: `Bearer ${authSession?.idToken}` }
      });
      if (!res.ok) throw new Error('Sem permissão ou erro na API.');
      const { parametros } = await res.json();
      setParams(parametros);
      setEditParams(parametros);
    } catch (e: any) {
      showNotif('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [authSession?.idToken]);

  useEffect(() => { loadParams(); }, [loadParams]);

  const handleChange = (key: keyof SystemParams, value: string | number | boolean) => {
    setEditParams(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const hasChanges = JSON.stringify(params) !== JSON.stringify(editParams);

  const handleSave = async () => {
    if (!editParams) return;
    setSaving(true);
    try {
      const res = await fetch('/api/parametros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.idToken}` },
        body: JSON.stringify(editParams)
      });
      if (!res.ok) throw new Error('Falha ao salvar parâmetros.');
      const { parametros } = await res.json();
      setParams(parametros);
      setEditParams(parametros);
      showNotif('success', 'Parâmetros atualizados com sucesso!');
    } catch (e: any) {
      showNotif('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => { setEditParams(params); };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#707785]">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        Carregando parâmetros...
      </div>
    );
  }

  if (!editParams) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-[#eff6ff] rounded-xl border border-[#bfdbfe]">
          <span className="material-symbols-outlined text-[#005daa] text-2xl">tune</span>
        </div>
        <div>
          <h2 className="font-headline-sm text-[#191c1e] font-extrabold">Parâmetros do Sistema</h2>
          <p className="text-[12px] text-[#707785]">Configurações globais de tempos, compliance e sincronismo — exclusivo para Administradores.</p>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-semibold border ${
          notification.type === 'success'
            ? 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]'
            : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {notification.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {notification.msg}
        </div>
      )}

      {/* Parameter Groups */}
      <div className="space-y-6">
        {PARAM_GROUPS.map(group => {
          const groupKeys = (Object.keys(PARAM_LABELS) as (keyof SystemParams)[])
            .filter(k => PARAM_LABELS[k].group === group);

          return (
            <div key={group} className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#005daa] text-[18px]">
                  {group === 'Autenticação' ? 'lock' : group === 'Compliance / Logs' ? 'policy' : 'sync'}
                </span>
                <span className="font-bold text-sm text-[#191c1e] uppercase tracking-wide">{group}</span>
              </div>

              <div className="divide-y divide-[#f1f5f9]">
                {groupKeys.map(key => {
                  const meta = PARAM_LABELS[key];
                  const val = editParams[key];
                  const isBool = typeof val === 'boolean';
                  const isNum = typeof val === 'number';

                  return (
                    <div key={key} className="px-5 py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#191c1e]">{meta.label}</p>
                        <p className="text-[11px] text-[#707785] mt-0.5">{meta.desc}</p>
                        <code className="text-[10px] text-[#94a3b8] font-mono mt-1 block">{key}</code>
                      </div>

                      <div className="flex-shrink-0">
                        {isBool ? (
                          <button
                            id={`param-toggle-${key}`}
                            onClick={() => handleChange(key, !val)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                              val ? 'bg-[#005daa]' : 'bg-[#cbd5e1]'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              val ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        ) : isNum ? (
                          <input
                            id={`param-input-${key}`}
                            type="number"
                            min={1}
                            max={365}
                            value={val as number}
                            onChange={e => handleChange(key, parseInt(e.target.value, 10) || 1)}
                            className="w-24 px-3 py-1.5 border border-[#cbd5e1] rounded-lg text-sm text-center font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#005daa] focus:border-transparent"
                          />
                        ) : (
                          <input
                            id={`param-input-${key}`}
                            type="text"
                            value={val as string}
                            onChange={e => handleChange(key, e.target.value)}
                            className="w-28 px-3 py-1.5 border border-[#cbd5e1] rounded-lg text-sm text-center font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#005daa] focus:border-transparent"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#e2e8f0]">
        <p className="text-[11px] text-[#94a3b8] italic">
          * Alterações são aplicadas em tempo real no servidor. Reinicie os serviços se necessário.
        </p>
        <div className="flex gap-2">
          <button
            id="btn-reset-params"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="px-4 py-2 border border-[#cbd5e1] text-[#404753] rounded-lg text-sm font-semibold hover:bg-[#f8fafc] disabled:opacity-40 transition-colors"
          >
            Desfazer
          </button>
          <button
            id="btn-save-params"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-5 py-2 bg-[#005daa] text-white rounded-lg text-sm font-semibold hover:bg-[#0075d5] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {saving ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">save</span>}
            Salvar Parâmetros
          </button>
        </div>
      </div>
    </div>
  );
};
