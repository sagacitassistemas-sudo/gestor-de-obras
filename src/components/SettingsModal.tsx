import React from 'react';
import { UserProfile } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
  authSession?: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  authSession
}) => {
  const [newPassword, setNewPassword] = React.useState('');
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordMessage, setPasswordMessage] = React.useState<{type: 'success'|'error', text: string} | null>(null);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    
    setIsChangingPassword(true);
    setPasswordMessage(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.idToken}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setNewPassword('');
      } else {
        setPasswordMessage({ type: 'error', text: data.error || 'Erro ao alterar senha.' });
      }
    } catch (err) {
      setPasswordMessage({ type: 'error', text: 'Erro de conexão.' });
    }
    setIsChangingPassword(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#c0c7d6] shadow-xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#005daa] text-2xl">account_circle</span>
            <div>
              <h3 className="font-headline-sm text-[#005daa]">Configurações do Portal</h3>
              <p className="text-[11px] text-[#707785]">Consulta de Status e Identidade do Usuário</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#707785] hover:text-[#191c1e] cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Read-Only Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">
              Nome / Razão Social
            </label>
            <input
              type="text"
              readOnly
              value={user.name}
              className="w-full px-3.5 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-md font-body-md text-[#475569] font-bold outline-none"
            />
          </div>

          <div>
            <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">
              E-mail de Cadastro
            </label>
            <input
              type="email"
              readOnly
              value={user.email}
              className="w-full px-3.5 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-md font-body-md text-[#475569] font-bold outline-none font-mono"
            />
          </div>

          <div>
            <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">
              Cargo / Papel Atribuído
            </label>
            <input
              type="text"
              readOnly
              value={user.role}
              className="w-full px-3.5 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-md font-body-md text-[#475569] font-bold outline-none"
            />
          </div>

          {/* Status Badge Info Card */}
          <div className="p-3.5 bg-[#eff6ff] rounded-md border border-[#bfdbfe] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#1e40af] uppercase">Status de Autenticação</p>
              <p className="font-bold text-[#005daa] text-xs flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">verified</span>
                Usuário Autenticado no Tenant
              </p>
            </div>
            <span className="px-2.5 py-1 bg-[#005daa] text-white font-bold text-[10px] rounded uppercase tracking-wider">
              {user.role}
            </span>
          </div>

          <p className="text-[11px] text-[#707785] italic text-center mb-6">
            * Estes dados são de leitura exclusiva para consulta de credenciais ativas.
          </p>

          {/* Trocar Senha */}
          <div className="pt-4 border-t border-[#e2e8f0]">
            <h4 className="font-headline-sm text-[#005daa] text-sm mb-3">Alterar Senha</h4>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="font-label-bold text-[11px] uppercase text-[#404753] block mb-1">Nova Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full px-3.5 py-2 border border-[#cbd5e1] rounded-md font-body-md text-[#475569] outline-none focus:border-[#005daa] focus:ring-1 focus:ring-[#005daa]"
                />
              </div>
              {passwordMessage && (
                <div className={`p-2 text-xs font-bold rounded ${passwordMessage.type === 'success' ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-red-50 text-red-600'}`}>
                  {passwordMessage.text}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 bg-slate-800 text-white rounded-md font-label-bold hover:bg-slate-900 transition-colors cursor-pointer text-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {isChangingPassword && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                  Atualizar Senha
                </button>
              </div>
            </form>
          </div>

          {/* Footer Action */}
          <div className="flex justify-end pt-3 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#0075d5] transition-colors cursor-pointer text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
