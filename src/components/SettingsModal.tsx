import React from 'react';
import { UserProfile } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  if (!isOpen) return null;

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

          <p className="text-[11px] text-[#707785] italic text-center">
            * Estes dados são de leitura exclusiva para consulta de credenciais ativas.
          </p>

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
