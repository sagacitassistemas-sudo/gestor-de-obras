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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  userRole,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const isAdmin = userRole === 'ADMIN';
  const hasAccess = (key: string) => isAdmin || (permissions && permissions[key]);
  
  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (tab: NavigationTab) => {
    const isActive = activeTab === tab;
    const base = isCollapsed ? 'justify-center p-3' : 'gap-2 p-3';
    if (isActive) {
      return `flex items-center ${base} bg-[#eff6ff] text-[#005daa] rounded-lg font-bold border-l-4 border-[#005daa] shadow-2xs transition-all`;
    }
    return `flex items-center ${base} text-[#404753] hover:bg-[#e6e8ea] hover:translate-x-1 transition-all rounded-lg group`;
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
        className={`fixed left-0 top-0 h-screen bg-white border-r border-[#c0c7d6] flex flex-col z-50 transition-all duration-300 ${
          mobileOpen ? 'translate-x-0 w-64 p-4' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed && !mobileOpen ? 'md:w-20 p-2' : 'w-64 p-4'}`}
      >
        {/* Brand Header */}
        <div className={`mb-8 px-2 flex items-center ${isCollapsed ? 'justify-center mt-2' : 'justify-between'}`}>
          {!isCollapsed ? (
            <div>
              <h1 className="font-headline-sm text-headline-sm font-extrabold text-[#005daa] tracking-tight">
                Works Manager
              </h1>
              <p className="text-[10px] text-[#707785] font-label-bold uppercase tracking-wider mt-0.5">
                Supplier Portal
              </p>
            </div>
          ) : (
            <span className="material-symbols-outlined text-[32px] text-[#005daa]">business_center</span>
          )}
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

        {/* Toggle Collapse Button (Desktop only) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`hidden md:flex absolute -right-3 top-6 bg-white border border-[#c0c7d6] rounded-full w-6 h-6 items-center justify-center text-[#707785] hover:text-[#005daa] hover:bg-[#eff6ff] transition-all z-10`}
            aria-label="Recolher menu"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2">
          
          {/* DASHBOARD & ALERTAS */}
          <div className="space-y-1">
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
              {!isCollapsed && <span className="font-label-bold text-label-bold">Dashboard</span>}
            </button>
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
              {!isCollapsed && <span className="font-label-bold text-label-bold flex-1">Alertas</span>}
              {!isCollapsed && alertCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-[#f59e0b] text-white font-bold rounded-full">
                  {alertCount}
                </span>
              )}
              {isCollapsed && alertCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#f59e0b] rounded-full"></span>
              )}
            </button>
          </div>

          {/* GRUPO: CADASTROS */}
          {hasAccess('empresas_ler') && (
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Cadastros
                  </span>
                </div>
              )}
              <button
                onClick={() => handleNavClick('empresas')}
                className={`w-full text-left ${navItemClass('empresas')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'empresas' ? "'FILL' 1" : "'FILL' 0" }}>store</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Empresas</span>}
              </button>
              <button
                onClick={() => handleNavClick('fornecedores')}
                className={`w-full text-left ${navItemClass('fornecedores')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'fornecedores' ? "'FILL' 1" : "'FILL' 0" }}>local_shipping</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Fornecedores</span>}
              </button>
              {hasAccess('medicoes_ler') && (
                <button
                  onClick={() => handleNavClick('contratos_obra')}
                  className={`w-full text-left ${navItemClass('contratos_obra')}`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'contratos_obra' ? "'FILL' 1" : "'FILL' 0" }}>history_edu</span>
                  {!isCollapsed && <span className="font-label-bold text-label-bold">Contratos</span>}
                </button>
              )}
              <button
                onClick={() => handleNavClick('equipes')}
                className={`w-full text-left ${navItemClass('equipes')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'equipes' ? "'FILL' 1" : "'FILL' 0" }}>engineering</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Equipes</span>}
              </button>
              <button
                onClick={() => handleNavClick('maquinas')}
                className={`w-full text-left ${navItemClass('maquinas')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'maquinas' ? "'FILL' 1" : "'FILL' 0" }}>precision_manufacturing</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Máquinas</span>}
              </button>
              <button
                onClick={() => handleNavClick('ferramentas')}
                className={`w-full text-left ${navItemClass('ferramentas')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'ferramentas' ? "'FILL' 1" : "'FILL' 0" }}>build</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Ferramentas</span>}
              </button>
              <button
                onClick={() => handleNavClick('materiais')}
                className={`w-full text-left ${navItemClass('materiais')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'materiais' ? "'FILL' 1" : "'FILL' 0" }}>inventory_2</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Materiais</span>}
              </button>
            </div>
          )}

          {/* GRUPO: OBRA */}
          {(hasAccess('projetos_ler') || hasAccess('medicoes_ler')) && (
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="pt-2 px-3 pb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Obra
                  </span>
                </div>
              )}
              {hasAccess('projetos_ler') && (
                <button
                  onClick={() => handleNavClick('projetos_eap')}
                  className={`w-full text-left ${navItemClass('projetos_eap')}`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'projetos_eap' ? "'FILL' 1" : "'FILL' 0" }}>account_tree</span>
                  {!isCollapsed && <span className="font-label-bold text-label-bold">Projetos</span>}
                </button>
              )}
              {hasAccess('projetos_ler') && (
                <button
                  onClick={() => handleNavClick('cronograma_executivo')}
                  className={`w-full text-left ${navItemClass('cronograma_executivo')}`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'cronograma_executivo' ? "'FILL' 1" : "'FILL' 0" }}>calendar_month</span>
                  {!isCollapsed && <span className="font-label-bold text-label-bold">Cronograma</span>}
                </button>
              )}
              {(hasAccess('projetos_ler') || hasAccess('medicoes_ler')) && (
                <button
                  onClick={() => handleNavClick('ordens_servico')}
                  className={`w-full text-left ${navItemClass('ordens_servico')}`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'ordens_servico' ? "'FILL' 1" : "'FILL' 0" }}>assignment</span>
                  {!isCollapsed && <span className="font-label-bold text-label-bold">Ordens de Serviço</span>}
                </button>
              )}
              {(hasAccess('projetos_ler') || hasAccess('medicoes_ler')) && (
                <button
                  onClick={() => handleNavClick('rdo')}
                  className={`w-full text-left ${navItemClass('rdo')}`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'rdo' ? "'FILL' 1" : "'FILL' 0" }}>fact_check</span>
                  {!isCollapsed && <span className="font-label-bold text-label-bold">RDO's</span>}
                </button>
              )}
              {hasAccess('medicoes_ler') && (
                <button
                  onClick={() => handleNavClick('medicoes')}
                  className={`w-full text-left ${navItemClass('medicoes')}`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'medicoes' ? "'FILL' 1" : "'FILL' 0" }}>architecture</span>
                  {!isCollapsed && <span className="font-label-bold text-label-bold">Medições</span>}
                </button>
              )}
            </div>
          )}

          {/* GRUPO: GESTÃO */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="pt-2 px-3 pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Gestão
                </span>
              </div>
            )}
            {hasAccess('financeiro_ler') && (
              <button
                onClick={() => handleNavClick('financeiro')}
                className={`w-full text-left ${navItemClass('financeiro')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'financeiro' ? "'FILL' 1" : "'FILL' 0" }}>account_balance_wallet</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Financeiro</span>}
              </button>
            )}
            {hasAccess('usuarios_ler') && (
              <button
                onClick={() => handleNavClick('usuarios')}
                className={`w-full text-left ${navItemClass('usuarios')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'usuarios' ? "'FILL' 1" : "'FILL' 0" }}>group</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Usuários</span>}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => handleNavClick('parametros')}
                className={`w-full text-left ${navItemClass('parametros')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'parametros' ? "'FILL' 1" : "'FILL' 0" }}>tune</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Parâmetros</span>}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => handleNavClick('audit-log')}
                className={`w-full text-left ${navItemClass('audit-log')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'audit-log' ? "'FILL' 1" : "'FILL' 0" }}>policy</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Auditoria</span>}
              </button>
            )}
            {(isAdmin || userRole === 'GESTOR') && (
              <button
                onClick={() => handleNavClick('matriz-acesso')}
                className={`w-full text-left ${navItemClass('matriz-acesso')}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'matriz-acesso' ? "'FILL' 1" : "'FILL' 0" }}>admin_panel_settings</span>
                {!isCollapsed && <span className="font-label-bold text-label-bold">Matriz de acessos</span>}
              </button>
            )}
          </div>
        </nav>

        <div className="mt-auto pt-4 border-t border-[#c0c7d6] space-y-1">
          <button
            onClick={onOpenNovoChamado}
            className={`w-full bg-[#005daa] text-white rounded-lg p-3 mb-3 font-label-bold flex items-center ${isCollapsed ? 'justify-center' : 'justify-center gap-2'} hover:bg-[#0075d5] active:scale-[0.98] transition-all shadow-sm group`}
            title="Novo Chamado"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {!isCollapsed && <span>Novo Chamado</span>}
          </button>

          <button
            onClick={onOpenNovoChamado}
            className={`w-full text-left flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'gap-2 p-2.5'} text-[#404753] hover:bg-[#eceef0] transition-all rounded-lg`}
            title="Suporte"
          >
            <span className="material-symbols-outlined text-[20px]">help</span>
            {!isCollapsed && <span className="font-label-bold text-label-bold">Suporte</span>}
          </button>

          <button
            onClick={onLogout}
            className={`w-full text-left flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'gap-2 p-2.5'} text-[#ef4444] hover:bg-[#fef2f2] transition-all rounded-lg group`}
            title="Logout"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-0.5 transition-transform">
              logout
            </span>
            {!isCollapsed && <span className="font-label-bold text-label-bold">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
