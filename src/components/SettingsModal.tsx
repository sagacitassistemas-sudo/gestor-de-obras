import React, { useState } from 'react';
import { UserProfile } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile
}) => {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [email, setEmail] = useState(user.email);
  const [tier] = useState(user.tier);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...user,
      name,
      role,
      email
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#c0c7d6] shadow-xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#005daa] text-2xl">settings</span>
            <h3 className="font-headline-sm text-[#005daa]">Configurações do Portal</h3>
          </div>
          <button onClick={onClose} className="text-[#707785] hover:text-[#191c1e]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {saved ? (
          <div className="p-4 bg-[#ecfdf5] border border-[#10b981]/30 rounded-lg text-center space-y-2">
            <span className="material-symbols-outlined text-[#10b981] text-3xl">check_circle</span>
            <p className="font-bold text-[#10b981]">Configurações atualizadas!</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="font-label-bold text-[#191c1e] block mb-1">
                Razão Social / Nome da Empresa
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 border border-[#c0c7d6] rounded-md font-body-md text-[#191c1e] outline-none focus:border-[#005daa]"
              />
            </div>

            <div>
              <label className="font-label-bold text-[#191c1e] block mb-1">Cargo do Responsável</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2 border border-[#c0c7d6] rounded-md font-body-md text-[#191c1e] outline-none focus:border-[#005daa]"
              />
            </div>

            <div>
              <label className="font-label-bold text-[#191c1e] block mb-1">E-mail de Notificações</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-[#c0c7d6] rounded-md font-body-md text-[#191c1e] outline-none focus:border-[#005daa]"
              />
            </div>

            <div className="p-3 bg-[#f2f4f6] rounded-md border border-[#c0c7d6] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-[#707785] uppercase">Perfil de Acesso</p>
                <p className="font-bold text-[#005daa]">{user.role}</p>
              </div>
              <span className="px-2.5 py-1 bg-[#d4e3ff] text-[#005daa] font-bold text-[10px] rounded">
                SLA 99.9%
              </span>
            </div>



            <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#c0c7d6] rounded-md font-label-bold text-[#404753] hover:bg-[#f2f4f6]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#005daa] text-white rounded-md font-label-bold hover:bg-[#0075d5]"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
