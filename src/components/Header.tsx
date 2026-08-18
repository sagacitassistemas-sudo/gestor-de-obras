import React from 'react';
import { UserProfile, NavigationTab } from '../types';

interface HeaderProps {
  activeTab: NavigationTab;
  user: UserProfile;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onToggleMobileMenu: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  user,
  searchQuery,
  onSearchChange,
  onOpenNotifications,
  onOpenSettings,
  onToggleMobileMenu,
  unreadNotificationsCount = 2
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Visão Geral Operacional';
      case 'financeiro':
        return 'Consolidado Financeiro';
      case 'contratos':
        return 'Gestão de Contratos';
      case 'alertas':
        return 'Alertas e Notificações';
      default:
        return 'Works Manager';
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'financeiro':
        return 'Buscar relatório...';
      case 'contratos':
        return 'Pesquisar contrato ou objeto...';
      default:
        return 'Pesquisar contratos, notas ou alertas...';
    }
  };

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center w-full px-4 md:px-8 h-16 bg-white border-b border-[#c0c7d6] shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-[#005daa] hover:bg-[#f2f4f6] rounded-md transition-colors"
          aria-label="Abrir menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <h2 className="font-headline-sm text-headline-sm text-[#005daa] truncate">
          {getTabTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {/* Search Input (Desktop/Tablet) */}
        <div className="hidden sm:flex items-center bg-[#f2f4f6] rounded-full px-3.5 py-1.5 border border-[#c0c7d6]/40 focus-within:border-[#005daa] focus-within:ring-2 focus-within:ring-[#005daa]/20 transition-all w-52 md:w-80">
          <span className="material-symbols-outlined text-[#707785] text-sm mr-2 select-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={getSearchPlaceholder()}
            className="bg-transparent border-none outline-none focus:ring-0 text-body-sm text-[#191c1e] w-full placeholder:text-[#707785]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-[#707785] hover:text-[#191c1e]"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={onOpenNotifications}
            className="p-2 text-[#404753] hover:text-[#005daa] hover:bg-[#f2f4f6] rounded-full transition-colors relative"
            title="Notificações"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ef4444] rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 text-[#404753] hover:text-[#005daa] hover:bg-[#f2f4f6] rounded-full transition-colors"
            title="Configurações do Portal"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>

          <div className="hidden sm:block h-6 w-[1px] bg-[#c0c7d6]" />

          {/* User Profile Chip */}
          <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity" onClick={onOpenSettings}>
            <div className="text-right hidden md:block">
              <p className="font-label-bold text-label-bold text-[#191c1e] leading-tight">
                {user.name}
              </p>
              <p className="text-[10px] text-[#707785] font-semibold uppercase tracking-wider">
                {user.role}
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-[#d4e3ff] p-0.5 border border-[#005daa]/20 overflow-hidden shadow-2xs flex-shrink-0 flex items-center justify-center">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span className="font-bold text-[#005daa] text-sm uppercase">
                  {user.name ? user.name.charAt(0) : '?'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
