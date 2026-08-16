import React, { useState } from 'react';
import {
  NavigationTab,
  UserProfile,
  ContractItem,
  InvoiceItem,
  PendingPayment,
  DRELine,
  ActivityItem,
  ChamadoTicket,
  SystemAlert,
  AuthSession,
  EmpresaItem
} from './types';
import {
  initialProfile,
  initialContracts,
  initialInvoices,
  initialPendingPayments,
  initialDREData,
  initialActivities,
  initialAlerts,
  initialChamados,
  initialEmpresas
} from './data/mockData';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { AuthDebugView } from './components/AuthDebugView';
import { DashboardView } from './components/DashboardView';
import { FinanceiroView } from './components/FinanceiroView';
import { ContratosView } from './components/ContratosView';
import { ProjetosEapView } from './components/ProjetosEapView';
import { CronogramaExecutivoView } from './components/CronogramaExecutivoView';
import { RDOView } from './components/RDOView';
import { OSView } from './components/OSView';
import { AlertasView } from './components/AlertasView';
import { EmpresasView } from './components/EmpresasView';
import { EntidadesView } from './components/EntidadesView';
import { UsuariosView } from './components/UsuariosView';
import { MatrizAcessosView } from './components/MatrizAcessosView';
import { ContratosObraView } from './components/ContratosObraView';
import { AuditLogView } from './components/AuditLogView';
import { ParametrosView } from './components/ParametrosView';
import { FuncionariosView } from './components/FuncionariosView';
import { EquipesView } from './components/EquipesView';

import { NovoChamadoModal } from './components/NovoChamadoModal';
import { ProcessamentoNotasDrawer } from './components/ProcessamentoNotasDrawer';
import { SettingsModal } from './components/SettingsModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { ExportReportModal } from './components/ExportReportModal';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<NavigationTab>('login');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<Record<string, boolean> | null>(null);

  const [isAuthDebugOpen, setIsAuthDebugOpen] = useState(false);

  // Application Datasets
  const [user, setUser] = useState<UserProfile>(initialProfile);
  const [contracts, setContracts] = useState<ContractItem[]>(initialContracts);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>(initialEmpresas);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [pendingPayments] = useState<PendingPayment[]>(initialPendingPayments);
  const [dreData] = useState<DRELine[]>(initialDREData);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [alerts, setAlerts] = useState<SystemAlert[]>(initialAlerts);
  const [chamados, setChamados] = useState<ChamadoTicket[]>(initialChamados);

  // Search & Modals State
  const [searchQuery, setSearchQuery] = useState('');
  const [isNovoChamadoOpen, setIsNovoChamadoOpen] = useState(false);
  const [isNFDrawerOpen, setIsNFDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingValidationCount, setPendingValidationCount] = useState(0);

  // Load alert list whenever user.uid or activeTab changes
  React.useEffect(() => {
    if (authSession?.idToken && user.uid) {
      const loadAlerts = async () => {
        try {
          const res = await fetch("/api/alerts", {
            headers: { Authorization: `Bearer ${authSession.idToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setAlerts(data.alerts || []);
          }
        } catch (e) {
          console.error("Erro ao carregar alertas:", e);
        }
      };
      loadAlerts();
    }
  }, [authSession?.idToken, user.uid, activeTab]);

  // Load validations count if ADMIN
  React.useEffect(() => {
    if (authSession?.idToken && user.role === 'ADMIN') {
      const loadValidations = async () => {
        try {
          const res = await fetch("/api/validacoes", {
            headers: { Authorization: `Bearer ${authSession.idToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            const pendentes = data.validacoes?.filter((v: any) => v.status === 'PENDENTE').length || 0;
            setPendingValidationCount(pendentes);
          }
        } catch (e) {
          console.error("Erro ao carregar validações:", e);
        }
      };
      loadValidations();
    }
  }, [authSession?.idToken, user.role, activeTab]);

  // Fetch effective permissions after login
  React.useEffect(() => {
    if (authSession?.idToken && user.uid) {
      fetch(`/api/permissoes/efetivas/${user.uid}`, {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setEffectivePermissions(data.data);
            if (data.data.perfil) {
              setUser(prev => ({ ...prev, role: data.data.perfil }));
            }
          } else {
            setEffectivePermissions({});
          }
        })
        .catch(err => {
          console.error("Error fetching permissions:", err);
          setEffectivePermissions({});
        });
    } else {
      setEffectivePermissions(null);
    }
  }, [authSession?.idToken, user.uid]);

  // Fetch companies after login
  React.useEffect(() => {
    if (authSession?.idToken) {
      fetch('/api/empresas', {
        headers: { Authorization: `Bearer ${authSession.idToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.data)) {
            setEmpresas(data.data);
          }
        })
        .catch(err => {
          console.error("Error fetching companies in App:", err);
        });
    }
  }, [authSession?.idToken]);

  // Permission helper
  const hasAccess = (tab: NavigationTab) => {
    if (user.role === 'ADMIN') return true;
    if (!effectivePermissions) return false;
    switch (tab) {
      case 'empresas': return !!effectivePermissions.empresas_ler;
      case 'projetos_eap': return !!effectivePermissions.projetos_ler;
      case 'cronograma_executivo': return !!effectivePermissions.projetos_ler;
      case 'rdo': return !!effectivePermissions.medicoes_ler || !!effectivePermissions.projetos_ler;
      case 'contratos_obra': return !!effectivePermissions.medicoes_ler;
      case 'medicoes': return !!effectivePermissions.medicoes_ler;
      case 'usuarios': return !!effectivePermissions.usuarios_ler;
      case 'matriz-acesso': return user.role === 'GESTOR' || user.role === 'ADMIN';
      case 'audit-log': return user.role === 'ADMIN';
      case 'parametros': return user.role === 'ADMIN';
      case 'financeiro': return !!effectivePermissions.financeiro_ler;
      default: return true;
    }
  };

  // Handlers
  const handleLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
    setUser((prev) => ({
      ...prev,
      uid: session.uid,
      email: session.email,
      name: session.displayName || prev.name,
      avatarUrl: session.photoURL || prev.avatarUrl,
      role: session.customClaims?.perfil || prev.role
    }));

    // Auto-sync user to Supabase `usuarios` table
    fetch('/api/auth/sync-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.idToken}`
      },
      body: JSON.stringify({
        nome: session.displayName || '',
        avatar_url: session.photoURL || null
      })
    }).catch(err => console.error("[App] Erro ao sincronizar usuário:", err));

    setIsAuthenticated(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setAuthSession(null);
    setIsAuthenticated(false);
    setActiveTab('login');
  };

  const handleAddContract = (newContract: ContractItem) => {
    setContracts((prev) => [newContract, ...prev]);
    setActivities((prev) => [
      {
        id: Date.now().toString(),
        title: `Novo Contrato ${newContract.code} cadastrado`,
        timestamp: 'Agora mesmo',
        type: 'contract',
        color: 'success'
      },
      ...prev
    ]);
  };

  const handleUpdateContract = (updatedContract: ContractItem) => {
    setContracts((prev) =>
      prev.map((c) => (c.id === updatedContract.id ? updatedContract : c))
    );
    setActivities((prev) => [
      {
        id: Date.now().toString(),
        title: `Contrato ${updatedContract.code} atualizado`,
        timestamp: 'Agora mesmo',
        type: 'contract',
        color: 'processing'
      },
      ...prev
    ]);
  };

  const handleDeleteContract = (contractId: string) => {
    const contractToDelete = contracts.find((c) => c.id === contractId);
    setContracts((prev) => prev.filter((c) => c.id !== contractId));
    if (contractToDelete) {
      setActivities((prev) => [
        {
          id: Date.now().toString(),
          title: `Contrato ${contractToDelete.code} excluído`,
          timestamp: 'Agora mesmo',
          type: 'contract',
          color: 'warning'
        },
        ...prev
      ]);
    }
  };

  const handleUploadInvoice = (newInvoice: InvoiceItem) => {
    setInvoices((prev) => [newInvoice, ...prev]);
    setActivities((prev) => [
      {
        id: Date.now().toString(),
        title: `${newInvoice.code} em processamento`,
        timestamp: 'Agora mesmo',
        type: 'invoice',
        color: 'primary'
      },
      ...prev
    ]);
  };

  const handleSubmitChamado = (ticket: ChamadoTicket) => {
    setChamados((prev) => [ticket, ...prev]);
    setActivities((prev) => [
      {
        id: Date.now().toString(),
        title: `Chamado ${ticket.ticketNumber} aberto`,
        timestamp: 'Agora mesmo',
        type: 'system',
        color: 'primary'
      },
      ...prev
    ]);
  };

  // Onboarding screen rendering
  if (activeTab === 'onboarding') {
    return (
      <OnboardingScreen
        onOnboardingSuccess={(session) => {
          handleLoginSuccess(session);
        }}
        onGoToLogin={() => setActiveTab('login')}
      />
    );
  }

  // If user is not authenticated or selects login screen
  if (!isAuthenticated || activeTab === 'login') {
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onOpenSupportModal={() => setIsNovoChamadoOpen(true)}
          onOpenOnboarding={() => setActiveTab('onboarding')}
        />

        <NovoChamadoModal
          isOpen={isNovoChamadoOpen}
          onClose={() => setIsNovoChamadoOpen(false)}
          onSubmitChamado={handleSubmitChamado}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col font-body-md">


      {/* Side Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNovoChamado={() => setIsNovoChamadoOpen(true)}
        onLogout={handleLogout}
        alertCount={alerts.length}
        pendingValidationCount={pendingValidationCount}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        permissions={effectivePermissions}
        userRole={user.role}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Layout Container */}
      <div className={`${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} min-h-screen flex flex-col flex-1 transition-all duration-300`}>
        {/* Screen Switcher Bar for Quick Demo Navigation */}
        <div className="bg-[#005daa] text-white py-1.5 px-4 text-[12px] flex items-center justify-between font-label-bold z-50 border-b border-[#0075d5]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span className="hidden sm:inline">Firebase Container Auth Demo (MFA & Custom Claims Ativos)</span>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setIsAuthDebugOpen(true)}
              className="px-2.5 py-0.5 bg-[#10b981] text-white font-bold rounded text-[11px] hover:bg-[#059669] flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">token</span>
              <span>Token Inspector</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-2.5 py-0.5 rounded text-[11px] sm:text-[12px] transition-colors ${
                activeTab === 'dashboard' ? 'bg-white text-[#005daa] font-bold' : 'hover:bg-white/10'
              }`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('financeiro')}
              className={`px-2.5 py-0.5 rounded text-[11px] sm:text-[12px] transition-colors ${
                activeTab === 'financeiro' ? 'bg-white text-[#005daa] font-bold' : 'hover:bg-white/10'
              }`}
            >
              DRE Financeiro
            </button>
            <button
              onClick={() => setActiveTab('onboarding')}
              className={`px-2.5 py-0.5 rounded text-[11px] sm:text-[12px] transition-colors ${
                activeTab === 'onboarding' ? 'bg-white text-[#005daa] font-bold' : 'hover:bg-white/10'
              }`}
            >
              Onboarding
            </button>
            <button
              onClick={() => setActiveTab('login')}
              className="px-2.5 py-0.5 rounded text-[11px] sm:text-[12px] hover:bg-white/10 opacity-80"
            >
              Login 2FA
            </button>
          </div>
        </div>

        <Header
          activeTab={activeTab}
          user={user}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          unreadNotificationsCount={activities.length}
        />

        {/* View Component Canvas */}
        <main className={`p-4 md:p-8 w-full mx-auto flex-1 ${activeTab === 'cronograma_executivo' ? 'max-w-full' : 'max-w-[1280px]'}`}>
          {activeTab === 'dashboard' && (
            <DashboardView
              contracts={contracts}
              invoices={invoices}
              activities={activities}
              onNavigateTab={setActiveTab}
              onOpenNFDrawer={() => setIsNFDrawerOpen(true)}
              onOpenNovoChamado={() => setIsNovoChamadoOpen(true)}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'financeiro' && (
            hasAccess('financeiro') ? (
              <FinanceiroView
                dreData={dreData}
                pendingPayments={pendingPayments}
                contracts={contracts}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onOpenNovoChamado={() => setIsNovoChamadoOpen(true)}
                searchQuery={searchQuery}
                authSession={authSession}
              />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão ao Financeiro</div>
          )}

          {activeTab === 'contratos' && (
            <ContratosView
              contracts={contracts}
              empresas={empresas}
              searchQuery={searchQuery}
              onOpenNovoChamado={() => setIsNovoChamadoOpen(true)}
              onAddContract={handleAddContract}
              onUpdateContract={handleUpdateContract}
              onDeleteContract={handleDeleteContract}
            />
          )}

          {activeTab === 'contratos_obra' && (
            hasAccess('contratos_obra') ? (
              <ContratosObraView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão aos Contratos/Medições</div>
          )}

          {activeTab === 'alertas' && (
            <AlertasView alerts={alerts} searchQuery={searchQuery} />
          )}

          {activeTab === 'empresas' && (
            hasAccess('empresas') ? (
              <EmpresasView 
                empresas={empresas}
                authSession={authSession}
                setEmpresas={setEmpresas}
              />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão às Empresas</div>
          )}

          {activeTab === 'funcionarios' && (
            hasAccess('empresas') ? (
              <FuncionariosView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão aos Funcionários</div>
          )}

          {activeTab === 'equipes' && (
            hasAccess('empresas') ? (
              <EquipesView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão às Equipes</div>
          )}

          {['fornecedores', 'maquinas', 'ferramentas', 'materiais', 'medicoes'].includes(activeTab) && (
            <div className="flex items-center justify-center h-full p-8 text-gray-500">
              <div className="bg-white p-8 rounded-xl text-center border border-gray-200 max-w-md w-full shadow-sm">
                <span className="material-symbols-outlined text-[48px] text-[#005daa] mb-4">construction</span>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Módulo em Construção</h3>
                <p className="text-sm">A interface para a funcionalidade <strong className="uppercase">{activeTab.replace('_', ' ')}</strong> será implementada em breve.</p>
              </div>
            </div>
          )}

          {activeTab === 'ordens_servico' && (
            (hasAccess('projetos_eap') || hasAccess('contratos_obra')) ? (
              <OSView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão às Ordens de Serviço</div>
          )}

          {activeTab === 'usuarios' && (
            hasAccess('usuarios') ? (
              <UsuariosView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão aos Usuários</div>
          )}

          {activeTab === 'matriz-acesso' && (
            hasAccess('matriz-acesso') ? (
              <MatrizAcessosView authSession={authSession} currentUserRole={user.role} />
            ) : (
              <div className="flex items-center justify-center h-full p-8 text-gray-500">
                <div className="bg-white p-6 rounded-lg text-center border border-gray-200 max-w-md">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Acesso Negado</h3>
                  <p>Você não tem permissão para visualizar a Matriz de Acessos.</p>
                </div>
              </div>
            )
          )}

          {activeTab === 'projetos_eap' && (
            hasAccess('projetos_eap') ? (
              <ProjetosEapView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão aos Projetos/EAP</div>
          )}

          {activeTab === 'cronograma_executivo' && (
            hasAccess('cronograma_executivo') ? (
              <CronogramaExecutivoView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão ao Cronograma</div>
          )}

          {activeTab === 'rdo' && (
            hasAccess('rdo') ? (
              <RDOView authSession={authSession} />
            ) : <div className="p-8 text-center bg-white rounded-xl border border-gray-200">Acesso Restrito: Sem permissão ao RDO</div>
          )}

          {activeTab === 'audit-log' && (
            hasAccess('audit-log') ? (
              <AuditLogView authSession={authSession} />
            ) : (
              <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
                Acesso Restrito: A Trilha de Auditoria é restrita a administradores do sistema.
              </div>
            )
          )}

          {activeTab === 'parametros' && (
            hasAccess('parametros') ? (
              <ParametrosView authSession={authSession} />
            ) : (
              <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
                Acesso Restrito: Os Parâmetros do sistema são restritos a administradores.
              </div>
            )
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto p-6 border-t border-[#c0c7d6] bg-[#f2f4f6] text-center text-body-sm text-[#707785]">
          <p>
            © {new Date().getFullYear()} Works Manager - Supplier Management System. Todos os direitos reservados.
          </p>
        </footer>
      </div>

      {/* Auth Token Inspector Modal */}
      {isAuthDebugOpen && (
        <AuthDebugView
          session={authSession}
          onClose={() => setIsAuthDebugOpen(false)}
        />
      )}

      {/* Global Interactive Overlays */}
      <NovoChamadoModal
        isOpen={isNovoChamadoOpen}
        onClose={() => setIsNovoChamadoOpen(false)}
        onSubmitChamado={handleSubmitChamado}
      />

      <ProcessamentoNotasDrawer
        isOpen={isNFDrawerOpen}
        onClose={() => setIsNFDrawerOpen(false)}
        invoices={invoices}
        onUploadInvoice={handleUploadInvoice}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onUpdateProfile={setUser}
        authSession={authSession}
      />

      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={activities}
        onClearAll={() => setActivities([])}
      />

      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        dreData={dreData}
        user={user}
      />
    </div>
  );
}

