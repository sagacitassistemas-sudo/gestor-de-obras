import React from 'react';
import { NavigationTab } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenNovoChamado: () => void;
  onLogout: () => void;
  alertCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  permissions?: Record<string, boolean> | null;
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNovoChamado,
  onLogout,
  alertCount = 4,
  mobileOpen = false,
  onCloseMobile,
  permissions,
  userRole
}) => {
  const isAdmin = userRole === 'ADMIN';
  const hasAccess = (key: string) => isAdmin || (permissions && permissions[key]);
  
  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (tab: NavigationTab) => {
    const isActive = activeTab === tab;
    if (isActive) {
      return 'flex items-center gap-2 bg-[#eff6ff] text-[#005daa] rounded-lg p-3 font-bold border-l-4 border-[#005daa] shadow-2xs transition-all';
    }
    return 'flex items-center gap-2 text-[#404753] p-3 hover:bg-[#e6e8ea] hover:translate-x-1 transition-all rounded-lg group';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-[#c0c7d6] p-4 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="mb-8 px-2 flex items-center justify-between">
          <div>
            <h1 className="font-headline-sm text-headline-sm font-extrabold text-[#005daa] tracking-tight">
              Works Manager
            </h1>
            <p className="text-[10px] text-[#707785] font-label-bold uppercase tracking-wider mt-0.5">
              Supplier Portal
            </p>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-[#707785] hover:bg-[#eceef0]"
              aria-label="Fechar menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => handleNavClick('dashboard')}
            className={`w-full text-left ${navItemClass('dashboard')}`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: activeTab === 'dashboard' ? "'FILL' 1" : "'FILL' 0" }}
            >
              dashboard
            </span>
            <span className="font-label-bold text-label-bold">Dashboard</span>
          </button>

          {hasAccess('projetos_ler') && (
            <button
              onClick={() => handleNavClick('projetos_eap')}
              className={`w-full text-left ${navItemClass('projetos_eap')}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: activeTab === 'projetos_eap' ? "'FILL' 1" : "'FILL' 0" }}
              >
                account_tree
              </span>
              <span className="font-label-bold text-label-bold">Projetos (EAP)</span>
            </button>
          )}

          {hasAccess('medicoes_ler') && (
            <button
              onClick={() => handleNavClick('contratos_obra')}
              className={`w-full text-left ${navItemClass('contratos_obra')}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: activeTab === 'contratos_obra' ? "'FILL' 1" : "'FILL' 0" }}
              >
                architecture
              </span>
              <span className="font-label-bold text-label-bold">Medições</span>
            </button>
          )}

          {hasAccess('empresas_ler') && (
            <button
              onClick={() => handleNavClick('empresas')}
              className={`w-full text-left ${navItemClass('empresas')}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: activeTab === 'empresas' ? "'FILL' 1" : "'FILL' 0" }}
              >
                store
              </span>
              <span className="font-label-bold text-label-bold">Empresas</span>
            </button>
          )}

          {hasAccess('financeiro_ler') && (
            <button
              onClick={() => handleNavClick('financeiro')}
              className={`w-full text-left ${navItemClass('financeiro')}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: activeTab === 'financeiro' ? "'FILL' 1" : "'FILL' 0" }}
              >
                account_balance_wallet
              </span>
              <span className="font-label-bold text-label-bold">Financeiro</span>
            </button>
          )}

          <button
            onClick={() => handleNavClick('alertas')}
            className={`w-full text-left relative ${navItemClass('alertas')}`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: activeTab === 'alertas' ? "'FILL' 1" : "'FILL' 0" }}
            >
              warning
            </span>
            <span className="font-label-bold text-label-bold flex-1">Alertas</span>
            {alertCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-[#f59e0b] text-white font-bold rounded-full">
                {alertCount}
              </span>
            )}
          </button>

          <div className="pt-3 pb-1 px-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Infraestrutura (Container)
            </span>
          </div>

          {hasAccess('usuarios_ler') && (
            <button
              onClick={() => handleNavClick('usuarios')}
              className={`w-full text-left ${navItemClass('usuarios')}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: activeTab === 'usuarios' ? "'FILL' 1" : "'FILL' 0" }}
              >
                group
              </span>
              <span className="font-label-bold text-label-bold">Usuários</span>
            </button>
          )}

          {(isAdmin || userRole === 'GESTOR') && (
            <button
              onClick={() => handleNavClick('matriz-acesso')}
              className={`w-full text-left ${navItemClass('matriz-acesso')}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: activeTab === 'matriz-acesso' ? "'FILL' 1" : "'FILL' 0" }}
              >
                admin_panel_settings
              </span>
              <span className="font-label-bold text-label-bold">Matriz Acessos</span>
            </button>
          )}
        </nav>

        <div className="mt-auto pt-4 border-t border-[#c0c7d6] space-y-1">          <button
            onClick={onOpenNovoChamado}
            className="w-full bg-[#005daa] text-white rounded-lg p-3 mb-3 font-label-bold flex items-center justify-center gap-2 hover:bg-[#0075d5] active:scale-[0.98] transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Novo Chamado</span>
          </button>

          <button
            onClick={onOpenNovoChamado}
            className="w-full text-left flex items-center gap-2 text-[#404753] p-2.5 hover:bg-[#eceef0] transition-all rounded-lg"
          >
            <span className="material-symbols-outlined text-[20px]">help</span>
            <span className="font-label-bold text-label-bold">Suporte</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full text-left flex items-center gap-2 text-[#ef4444] p-2.5 hover:bg-[#fef2f2] transition-all rounded-lg group"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-0.5 transition-transform">
              logout
            </span>
            <span className="font-label-bold text-label-bold">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
