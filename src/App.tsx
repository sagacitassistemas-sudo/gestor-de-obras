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
import { AlertasView } from './components/AlertasView';
import { EmpresasView } from './components/EmpresasView';
import { EntidadesView } from './components/EntidadesView';
import { UsuariosView } from './components/UsuariosView';
import { MatrizAcessosView } from './components/MatrizAcessosView';
import { ContratosObraView } from './components/ContratosObraView';

import { NovoChamadoModal } from './components/NovoChamadoModal';
import { ProcessamentoNotasDrawer } from './components/ProcessamentoNotasDrawer';
import { SettingsModal } from './components/SettingsModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { ExportReportModal } from './components/ExportReportModal';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<NavigationTab>('login');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  const [isAuthDebugOpen, setIsAuthDebugOpen] = useState(false);

  // Application Datasets
  const [user, setUser] = useState<UserProfile>(initialProfile);
  const [contracts, setContracts] = useState<ContractItem[]>(initialContracts);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>(initialEmpresas);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [pendingPayments] = useState<PendingPayment[]>(initialPendingPayments);
  const [dreData] = useState<DRELine[]>(initialDREData);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [alerts] = useState<SystemAlert[]>(initialAlerts);
  const [, setChamados] = useState<ChamadoTicket[]>(initialChamados);

  // Search & Modals State
  const [searchQuery, setSearchQuery] = useState('');
  const [isNovoChamadoOpen, setIsNovoChamadoOpen] = useState(false);
  const [isNFDrawerOpen, setIsNFDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handlers
  const handleLoginSuccess = (session: AuthSession) => {
    setAuthSession(session);
    setUser((prev) => ({
      ...prev,
      email: session.email,
      name: session.displayName || prev.name,
      avatarUrl: session.photoURL || prev.avatarUrl,
      role: session.customClaims?.perfil || prev.role
    }));
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

      {/* Side Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNovoChamado={() => setIsNovoChamadoOpen(true)}
        onLogout={handleLogout}
        alertCount={alerts.length}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Layout Container */}
      <div className="md:ml-64 min-h-screen flex flex-col flex-1">
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
        <main className="p-4 md:p-8 max-w-[1280px] w-full mx-auto flex-1">
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
            <FinanceiroView
              dreData={dreData}
              pendingPayments={pendingPayments}
              contracts={contracts}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenNovoChamado={() => setIsNovoChamadoOpen(true)}
              searchQuery={searchQuery}
              authSession={authSession}
            />
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

          {activeTab === 'projetos_eap' && (
            <ProjetosEapView authSession={authSession} />
          )}

          {activeTab === 'contratos_obra' && (
            <ContratosObraView authSession={authSession} />
          )}

          {activeTab === 'alertas' && (
            <AlertasView
              alerts={alerts}
              onOpenNovoChamado={() => setIsNovoChamadoOpen(true)}
              onOpenNFDrawer={() => setIsNFDrawerOpen(true)}
            />
          )}

          {(activeTab === 'empresas' || activeTab === 'entidades') && (
            <EmpresasView
              authSession={authSession}
              empresas={empresas}
              setEmpresas={setEmpresas}
            />
          )}

          {activeTab === 'usuarios' && (
            <UsuariosView authSession={authSession} />
          )}

          {activeTab === 'matriz-acesso' && (
            <MatrizAcessosView authSession={authSession} />
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

