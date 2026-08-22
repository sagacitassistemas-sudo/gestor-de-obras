import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthSession } from '../types';
import { PermissoesContratante, PermissoesEmpresa, PermissoesUsuario } from '../types/cerne.types';

interface MatrizAcessosViewProps {
  authSession?: AuthSession | null;
}

const MODULOS_GROUPED = [
  {
    titulo: 'VISÃO GERAL',
    modulos: [
      { id: 'dashboard', label: 'Dashboard / Painel' },
      { id: 'alertas', label: 'Central de Alertas' }
    ]
  },
  {
    titulo: 'MÓDULO I: Gestão Executiva e Obras',
    modulos: [
      { id: 'empresas', label: 'Empresas / Fornecedores' },
      { id: 'projetos', label: 'Projetos e EAP' },
      { id: 'cronogramas', label: 'Cronogramas' },
      { id: 'rdo', label: 'RDO - Diário de Obra' },
      { id: 'os', label: 'Ordens de Serviço' },
      { id: 'contratos', label: 'Contratos de Obra' },
      { id: 'entidades', label: 'Entidades e Recursos' },
      { id: 'relatorios', label: 'Relatórios' },
      { id: 'usuarios', label: 'Usuários e Acessos' },
      { id: 'configuracoes', label: 'Configurações e Logs' }
    ]
  },
  {
    titulo: 'MÓDULO II: Custos e Financeiro',
    modulos: [
      { id: 'medicoes', label: 'Medições e Faturamento' },
      { id: 'financeiro', label: 'Custos, Salários e BDI' }
    ]
  }
];

export const MatrizAcessosView: React.FC<MatrizAcessosViewProps> = ({ authSession }) => {
  const currentClaims = authSession?.customClaims;
  const isAdmin = currentClaims?.perfil === 'ADMIN';
  const isGestor = currentClaims?.perfil === 'GESTOR' || isAdmin;
  const tenantId = currentClaims?.contrato_id || 'CTR-2026-SYS';

  const [activeTab, setActiveTab] = useState<'contratante' | 'tipo' | 'empresas' | 'usuarios'>('contratante');
  const [notification, setNotification] = useState<{type: string, message: string} | null>(null);

  // States for Permissions
  const [permContratante, setPermContratante] = useState<PermissoesContratante | null>(null);
  
  // Lists for dropdowns loaded from DB
  const [empresasList, setEmpresasList] = useState<any[]>([]);
  const [usuariosList, setUsuariosList] = useState<any[]>([]);

  const [selectedTipo, setSelectedTipo] = useState<'ADMIN' | 'GESTOR' | 'FINANCEIRO' | 'FORNECEDOR' | 'VISITANTE'>('FINANCEIRO');
  const [permTipo, setPermTipo] = useState<any | null>(null);

  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [permEmpresa, setPermEmpresa] = useState<PermissoesEmpresa | null>(null);

  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [permUsuario, setPermUsuario] = useState<PermissoesUsuario | null>(null);

  // Loading states to prevent infinite spinners
  const [loadingTipo, setLoadingTipo] = useState(false);
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);
  const [loadingUsuario, setLoadingUsuario] = useState(false);
  const [loadingContratante, setLoadingContratante] = useState(false);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadInitialData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      if (!token) return;

      // 1. Fetch empresas
      const resEmp = await fetch('/api/empresas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resEmp.ok) {
        const json = await resEmp.json();
        if (json.data) {
          const list = json.data.map((e: any) => ({
            id: e.id,
            label: `${e.id} - ${e.nome}`
          }));
          setEmpresasList(list);
          if (list.length > 0) {
            setSelectedEmpresaId(list[0].id);
          }
        }
      }

      // 2. Fetch usuarios
      const resUsr = await fetch('/api/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resUsr.ok) {
        const json = await resUsr.json();
        if (json.usuarios) {
          const list = json.usuarios.map((u: any) => ({
            uid: u.uid,
            nome: u.nome,
            empresa_id: u.empresa_id || null,
            perfil: u.perfil || 'VISITANTE'
          }));
          setUsuariosList(list);
          if (list.length > 0) {
            setSelectedUsuarioId(list[0].uid);
          }
        }
      }
    } catch (err) {
      console.error("Error loading matrix dropdown data:", err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [authSession]);

  // Carregar permissões da Contratante
  const fetchPermContratante = async () => {
    setLoadingContratante(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      if (!token) { setLoadingContratante(false); return; }

      const res = await fetch('/api/permissoes/contratante', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setPermContratante(json.data);
        } else {
          setPermContratante({
            contrato_id: tenantId,
            dashboard_ler: true, alertas_ler: true,
            empresas_criar: true, empresas_ler: true, empresas_editar: true, empresas_excluir: true,
            projetos_criar: true, projetos_ler: true, projetos_editar: true, projetos_excluir: true,
            medicoes_criar: true, medicoes_ler: true, medicoes_editar: true, medicoes_excluir: true,
            financeiro_criar: true, financeiro_ler: true, financeiro_editar: true, financeiro_excluir: true,
            relatorios_ler: true,
            usuarios_criar: true, usuarios_ler: true, usuarios_editar: true, usuarios_excluir: true,
            cronogramas_criar: true, cronogramas_ler: true, cronogramas_editar: true, cronogramas_excluir: true,
            rdo_criar: true, rdo_ler: true, rdo_editar: true, rdo_excluir: true,
            os_criar: true, os_ler: true, os_editar: true, os_excluir: true,
            contratos_criar: true, contratos_ler: true, contratos_editar: true, contratos_excluir: true,
            entidades_criar: true, entidades_ler: true, entidades_editar: true, entidades_excluir: true,
            configuracoes_criar: true, configuracoes_ler: true, configuracoes_editar: true, configuracoes_excluir: true,
          });
        }
      } else {
        // On error, use safe defaults
        setPermContratante({
          contrato_id: tenantId,
          dashboard_ler: true, alertas_ler: true,
          empresas_criar: true, empresas_ler: true, empresas_editar: true, empresas_excluir: true,
          projetos_criar: true, projetos_ler: true, projetos_editar: true, projetos_excluir: true,
          medicoes_criar: true, medicoes_ler: true, medicoes_editar: true, medicoes_excluir: true,
          financeiro_criar: true, financeiro_ler: true, financeiro_editar: true, financeiro_excluir: true,
          relatorios_ler: true,
          usuarios_criar: true, usuarios_ler: true, usuarios_editar: true, usuarios_excluir: true,
            cronogramas_criar: true, cronogramas_ler: true, cronogramas_editar: true, cronogramas_excluir: true,
            rdo_criar: true, rdo_ler: true, rdo_editar: true, rdo_excluir: true,
            os_criar: true, os_ler: true, os_editar: true, os_excluir: true,
            contratos_criar: true, contratos_ler: true, contratos_editar: true, contratos_excluir: true,
            entidades_criar: true, entidades_ler: true, entidades_editar: true, entidades_excluir: true,
            configuracoes_criar: true, configuracoes_ler: true, configuracoes_editar: true, configuracoes_excluir: true,
        });
      }
    } catch (err) {
      console.error(err);
      setPermContratante(null);
    } finally {
      setLoadingContratante(false);
    }
  };

  useEffect(() => {
    fetchPermContratante();
  }, [tenantId, authSession]);

  // Carregar permissões por Tipo
  const fetchPermTipo = async () => {
    if (!selectedTipo) return;
    setLoadingTipo(true);
    setPermTipo(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      if (!token) { setLoadingTipo(false); return; }

      const res = await fetch('/api/permissoes/tipo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const found = json.data?.find((p: any) => p.perfil === selectedTipo);
        if (found) {
          setPermTipo(found);
        } else {
          setPermTipo({
            contrato_id: tenantId,
            perfil: selectedTipo,
            dashboard_ler: false, alertas_ler: false,
            empresas_criar: selectedTipo === 'ADMIN',
            empresas_ler: true,
            empresas_editar: selectedTipo === 'ADMIN',
            empresas_excluir: selectedTipo === 'ADMIN',
            projetos_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            projetos_ler: true,
            projetos_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            projetos_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            medicoes_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            medicoes_ler: true,
            medicoes_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            medicoes_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            financeiro_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR' || selectedTipo === 'FINANCEIRO',
            financeiro_ler: true,
            financeiro_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR' || selectedTipo === 'FINANCEIRO',
            financeiro_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR' || selectedTipo === 'FINANCEIRO',
            relatorios_ler: true,
            usuarios_criar: selectedTipo === 'ADMIN',
            usuarios_ler: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            usuarios_editar: selectedTipo === 'ADMIN',
            usuarios_excluir: selectedTipo === 'ADMIN',
            cronogramas_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            cronogramas_ler: true,
            cronogramas_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            cronogramas_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            rdo_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            rdo_ler: true,
            rdo_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            rdo_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            os_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            os_ler: true,
            os_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            os_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            contratos_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            contratos_ler: true,
            contratos_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            contratos_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            entidades_criar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            entidades_ler: true,
            entidades_editar: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            entidades_excluir: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            configuracoes_criar: selectedTipo === 'ADMIN',
            configuracoes_ler: selectedTipo === 'ADMIN' || selectedTipo === 'GESTOR',
            configuracoes_editar: selectedTipo === 'ADMIN',
            configuracoes_excluir: selectedTipo === 'ADMIN'
          });
        }
      } else {
        // API error: fallback to safe defaults
        setPermTipo({
          contrato_id: tenantId,
          perfil: selectedTipo,
          dashboard_ler: false, alertas_ler: false,
          empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
          projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
          medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
          financeiro_criar: false, financeiro_ler: true, financeiro_editar: false, financeiro_excluir: false,
          relatorios_ler: true,
          usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
            cronogramas_criar: false, cronogramas_ler: true, cronogramas_editar: false, cronogramas_excluir: false,
            rdo_criar: false, rdo_ler: true, rdo_editar: false, rdo_excluir: false,
            os_criar: false, os_ler: true, os_editar: false, os_excluir: false,
            contratos_criar: false, contratos_ler: true, contratos_editar: false, contratos_excluir: false,
            entidades_criar: false, entidades_ler: true, entidades_editar: false, entidades_excluir: false,
            configuracoes_criar: false, configuracoes_ler: false, configuracoes_editar: false, configuracoes_excluir: false,
        });
      }
    } catch (err) {
      console.error(err);
      setPermTipo(null);
    } finally {
      setLoadingTipo(false);
    }
  };

  useEffect(() => {
    fetchPermTipo();
  }, [selectedTipo, tenantId, authSession]);

  // Carregar permissões da Empresa selecionada
  const fetchPermEmpresa = async () => {
    if (!selectedEmpresaId) return;
    setLoadingEmpresa(true);
    setPermEmpresa(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      if (!token) { setLoadingEmpresa(false); return; }

      const res = await fetch('/api/permissoes/empresa', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const found = json.data?.find((p: any) => p.empresa_id === selectedEmpresaId);
        if (found) {
          setPermEmpresa(found);
        } else {
          setPermEmpresa({
            contrato_id: tenantId,
            empresa_id: selectedEmpresaId,
            dashboard_ler: false, alertas_ler: false,
            empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
            projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
            medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
            financeiro_criar: false, financeiro_ler: true, financeiro_editar: false, financeiro_excluir: false,
            relatorios_ler: true,
            usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
            cronogramas_criar: false, cronogramas_ler: true, cronogramas_editar: false, cronogramas_excluir: false,
            rdo_criar: false, rdo_ler: true, rdo_editar: false, rdo_excluir: false,
            os_criar: false, os_ler: true, os_editar: false, os_excluir: false,
            contratos_criar: false, contratos_ler: true, contratos_editar: false, contratos_excluir: false,
            entidades_criar: false, entidades_ler: true, entidades_editar: false, entidades_excluir: false,
            configuracoes_criar: false, configuracoes_ler: false, configuracoes_editar: false, configuracoes_excluir: false,
          });
        }
      } else {
        setPermEmpresa({
          contrato_id: tenantId,
          empresa_id: selectedEmpresaId,
          dashboard_ler: false, alertas_ler: false,
          empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
          projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
          medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
          financeiro_criar: false, financeiro_ler: true, financeiro_editar: false, financeiro_excluir: false,
          relatorios_ler: true,
          usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
            cronogramas_criar: false, cronogramas_ler: true, cronogramas_editar: false, cronogramas_excluir: false,
            rdo_criar: false, rdo_ler: true, rdo_editar: false, rdo_excluir: false,
            os_criar: false, os_ler: true, os_editar: false, os_excluir: false,
            contratos_criar: false, contratos_ler: true, contratos_editar: false, contratos_excluir: false,
            entidades_criar: false, entidades_ler: true, entidades_editar: false, entidades_excluir: false,
            configuracoes_criar: false, configuracoes_ler: false, configuracoes_editar: false, configuracoes_excluir: false,
        });
      }
    } catch (err) {
      console.error(err);
      setPermEmpresa(null);
    } finally {
      setLoadingEmpresa(false);
    }
  };

  useEffect(() => {
    fetchPermEmpresa();
  }, [selectedEmpresaId, tenantId, authSession]);

  // Carregar permissões do Usuario selecionado
  const fetchPermUsuario = async () => {
    if (!selectedUsuarioId) return;
    setLoadingUsuario(true);
    setPermUsuario(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      if (!token) { setLoadingUsuario(false); return; }

      const res = await fetch('/api/permissoes/usuario', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const found = json.data?.find((p: any) => p.usuario_uid === selectedUsuarioId);
        if (found) {
          setPermUsuario(found);
        } else {
          const user = usuariosList.find(u => u.uid === selectedUsuarioId);
          
          // Fetch the role's defaults to pre-fill
          let roleDefaults: any = null;
          try {
            const resTipo = await fetch('/api/permissoes/tipo', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resTipo.ok) {
              const jsonTipo = await resTipo.json();
              roleDefaults = jsonTipo.data?.find((p: any) => p.perfil === user?.perfil);
            }
          } catch (e) {}

          if (roleDefaults) {
            setPermUsuario({
              ...roleDefaults,
              id: undefined, // remove id so it creates a new record
              usuario_uid: selectedUsuarioId,
              empresa_id: user?.empresa_id || null,
            });
          } else {
            setPermUsuario({
              usuario_uid: selectedUsuarioId,
              contrato_id: tenantId,
              empresa_id: user?.empresa_id || null,
              dashboard_ler: false, alertas_ler: false,
              empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
              projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
              medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
              financeiro_criar: false, financeiro_ler: true, financeiro_editar: false, financeiro_excluir: false,
              relatorios_ler: true,
              usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
              cronogramas_criar: false, cronogramas_ler: true, cronogramas_editar: false, cronogramas_excluir: false,
              rdo_criar: false, rdo_ler: true, rdo_editar: false, rdo_excluir: false,
              os_criar: false, os_ler: true, os_editar: false, os_excluir: false,
              contratos_criar: false, contratos_ler: true, contratos_editar: false, contratos_excluir: false,
              entidades_criar: false, entidades_ler: true, entidades_editar: false, entidades_excluir: false,
              configuracoes_criar: false, configuracoes_ler: false, configuracoes_editar: false, configuracoes_excluir: false,
            });
          }
        }
      } else {
        const user = usuariosList.find(u => u.uid === selectedUsuarioId);
        setPermUsuario({
          usuario_uid: selectedUsuarioId,
          contrato_id: tenantId,
          empresa_id: user?.empresa_id || null,
          dashboard_ler: false, alertas_ler: false,
          empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
          projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
          medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
          financeiro_criar: false, financeiro_ler: true, financeiro_editar: false, financeiro_excluir: false,
          relatorios_ler: true,
          usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
          cronogramas_criar: false, cronogramas_ler: true, cronogramas_editar: false, cronogramas_excluir: false,
          rdo_criar: false, rdo_ler: true, rdo_editar: false, rdo_excluir: false,
          os_criar: false, os_ler: true, os_editar: false, os_excluir: false,
          contratos_criar: false, contratos_ler: true, contratos_editar: false, contratos_excluir: false,
          entidades_criar: false, entidades_ler: true, entidades_editar: false, entidades_excluir: false,
          configuracoes_criar: false, configuracoes_ler: false, configuracoes_editar: false, configuracoes_excluir: false,
        });
      }
    } catch (err) {
      console.error(err);
      setPermUsuario(null);
    } finally {
      setLoadingUsuario(false);
    }
  };

  useEffect(() => {
    fetchPermUsuario();
  }, [selectedUsuarioId, tenantId, authSession, usuariosList]);

  const handleSave = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token || authSession?.idToken;
      if (!token) return;

      if (activeTab === 'contratante' && permContratante) {
        const res = await fetch('/api/permissoes/contratante', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(permContratante)
        });
        if (res.ok) {
          showNotification('success', 'Permissões do Tenant salvas com sucesso!');
        } else {
          showNotification('error', 'Erro ao salvar permissões do Tenant.');
        }
      } else if (activeTab === 'tipo' && permTipo) {
        const res = await fetch('/api/permissoes/tipo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(permTipo)
        });
        if (res.ok) {
          showNotification('success', 'Permissões do Tipo de Perfil salvas com sucesso!');
        } else {
          showNotification('error', 'Erro ao salvar permissões do Tipo.');
        }
      } else if (activeTab === 'empresas' && permEmpresa) {
        const res = await fetch('/api/permissoes/empresa', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(permEmpresa)
        });
        if (res.ok) {
          showNotification('success', 'Permissões da Empresa salvas com sucesso!');
        } else {
          showNotification('error', 'Erro ao salvar permissões da Empresa.');
        }
      } else if (activeTab === 'usuarios' && permUsuario) {
        const res = await fetch('/api/permissoes/usuario', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(permUsuario)
        });
        if (res.ok) {
          showNotification('success', 'Permissões do Usuário salvas com sucesso!');
        } else {
          showNotification('error', 'Erro ao salvar permissões do Usuário.');
        }
      }
    } catch (err) {
      showNotification('error', 'Erro ao salvar: ' + err);
    }
  };

  const togglePermission = (stateObj: any, setter: any, key: string, maxLimitObj?: any) => {
    if (!stateObj) return;
    
    // Check limit (Teto)
    if (maxLimitObj && !stateObj[key] && !maxLimitObj[key]) {
      showNotification('error', `Permissão negada: O nível superior não possui a permissão '${key}'.`);
      return;
    }

    setter({ ...stateObj, [key]: !stateObj[key] });
  };

  const LoadingSpinner = () => (
    <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-400">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      <span className="text-xs font-bold">Carregando permissões...</span>
    </div>
  );

  const renderMatrix = (
    currentPerms: any, 
    setter: any, 
    maxLimitPerms?: any,
    isLoading?: boolean
  ) => {
    if (isLoading) return <LoadingSpinner />;
    if (!currentPerms) return <LoadingSpinner />;

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3 w-1/3">Módulo</th>
              <th className="p-3 text-center">Criar (C)</th>
              <th className="p-3 text-center">Ler (R)</th>
              <th className="p-3 text-center">Editar (U)</th>
              <th className="p-3 text-center">Excluir (D)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {MODULOS_GROUPED.map((grupo) => (
              <React.Fragment key={grupo.titulo}>
                <tr className="bg-slate-100">
                  <td colSpan={5} className="p-3 font-bold text-slate-700 uppercase tracking-wider text-[11px] border-y border-slate-200">
                    {grupo.titulo}
                  </td>
                </tr>
                {grupo.modulos.map((modulo) => (
                  <tr key={modulo.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-800 pl-6 border-r border-slate-100">{modulo.label}</td>
                    {['criar', 'ler', 'editar', 'excluir'].map((action) => {
                      const key = `${modulo.id}_${action}`;
                      if (['relatorios', 'dashboard', 'alertas'].includes(modulo.id) && action !== 'ler') {
                        return <td key={action} className="p-3 text-center bg-slate-50 border-r border-slate-100"></td>;
                      }

                      const hasPerm = currentPerms[key];
                      const limitReached = maxLimitPerms && !maxLimitPerms[key];

                      return (
                        <td key={action} className="p-3 text-center border-r border-slate-100">
                          <label className={`inline-flex items-center justify-center ${limitReached ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={!!hasPerm}
                              disabled={limitReached}
                              onChange={() => togglePermission(currentPerms, setter, key, maxLimitPerms)}
                              title={limitReached ? 'Bloqueado pelo Teto Superior' : 'Alternar Permissão'}
                              className="w-5 h-5 rounded border-slate-300 text-[#1890ff] focus:ring-[#1890ff] disabled:bg-slate-200 transition-all cursor-pointer disabled:cursor-not-allowed"
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };


  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-md border flex items-center justify-between shadow-2xs text-xs font-bold transition-all ${
            notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {notification.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-md border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1890ff] text-2xl">admin_panel_settings</span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Matriz de Permissões (Delegação Hierárquica)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de acessos com níveis de teto: Tenant &gt; Empresa &gt; Usuário
          </p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-[#1890ff] text-white font-bold text-xs rounded-md hover:bg-[#096dd9] transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">save</span>
          <span>Salvar Matriz</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('contratante')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'contratante' ? 'border-[#1890ff] text-[#1890ff]' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Tenant (Contratante)
        </button>
        <button
          onClick={() => setActiveTab('tipo')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'tipo' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Por Tipo
        </button>
        <button
          onClick={() => setActiveTab('empresas')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'empresas' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Por Empresa
        </button>
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'usuarios' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          4. Por Usuário
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-md border border-slate-200 shadow-2xs space-y-4">
        
        {/* CONTRATANTE TAB */}
        {activeTab === 'contratante' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
              <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined">corporate_fare</span>
                Teto Global do Tenant: {tenantId}
              </h3>
              <p className="text-xs text-blue-700 mt-1">
                Apenas o ADMIN pode alterar. Define o limite máximo de permissões que qualquer empresa ou usuário deste contrato pode ter.
              </p>
            </div>
            {isAdmin ? (
              renderMatrix(permContratante, setPermContratante, undefined, loadingContratante)
            ) : (
              <div className="p-4 bg-slate-50 text-slate-500 text-sm font-bold rounded-md border border-slate-200 text-center">
                Acesso Restrito: Somente Administradores podem alterar o Teto Global.
              </div>
            )}
          </div>
        )}

        {/* TIPO TAB */}
        {activeTab === 'tipo' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-md flex justify-between items-center">
              <div>
                <h3 className="font-bold text-purple-800 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined">badge</span>
                  Template de Permissão por Tipo de Perfil
                </h3>
                <p className="text-xs text-purple-700 mt-1">
                  Define o template de permissões iniciais herdado automaticamente no momento do cadastro de qualquer usuário desse tipo.
                </p>
              </div>
              <select
                value={selectedTipo}
                onChange={(e: any) => setSelectedTipo(e.target.value)}
                className="p-2 border border-purple-300 rounded-md text-xs font-bold bg-white text-purple-900 shadow-sm animate-in zoom-in-95"
              >
                <option value="ADMIN">Administrador</option>
                <option value="GESTOR">Gestor</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="FORNECEDOR">Fornecedor</option>
                <option value="VISITANTE">Visitante</option>
              </select>
            </div>
            {isGestor ? (
              renderMatrix(permTipo, setPermTipo, permContratante, loadingTipo)
            ) : (
              <div className="p-4 bg-slate-50 text-slate-500 text-sm font-bold rounded-md border border-slate-200 text-center">
                Acesso Restrito: Apenas Gestores e Admins podem configurar templates por tipo.
              </div>
            )}
          </div>
        )}

        {/* EMPRESAS TAB */}
        {activeTab === 'empresas' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-md flex justify-between items-center">
              <div>
                <h3 className="font-bold text-amber-800 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined">domain</span>
                  Teto por Empresa Fornecedora/Parceira
                </h3>
                <p className="text-xs text-amber-700 mt-1">
                  Define o limite máximo de permissões que os usuários desta empresa podem receber. Limitado pelo Teto Global.
                </p>
              </div>
              <select
                value={selectedEmpresaId}
                onChange={(e) => setSelectedEmpresaId(e.target.value)}
                className="p-2 border border-amber-300 rounded-md text-xs font-bold bg-white text-amber-900 shadow-sm"
              >
                {empresasList.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.label}</option>
                ))}
              </select>
            </div>
            {isGestor ? (
              renderMatrix(permEmpresa, setPermEmpresa, permContratante, loadingEmpresa)
            ) : (
              <div className="p-4 bg-slate-50 text-slate-500 text-sm font-bold rounded-md border border-slate-200 text-center">
                Acesso Restrito: Apenas Gestores e Admins da Contratante podem configurar empresas.
              </div>
            )}
          </div>
        )}

        {/* USUARIOS TAB */}
        {activeTab === 'usuarios' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-md flex justify-between items-center">
              <div>
                <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined">person</span>
                  Permissões Efetivas do Usuário
                  {(permUsuario as any)?.e_customizada && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold rounded-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">star</span>
                      Configuração Especial Customizada (Prioritária)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Permissões individuais. Ao salvar alterações nesta aba, esta configuração passa a ser uma regra especial prioritária.
                </p>
              </div>
              <select
                value={selectedUsuarioId}
                onChange={(e) => setSelectedUsuarioId(e.target.value)}
                className="p-2 border border-emerald-300 rounded-md text-xs font-bold bg-white text-emerald-900 shadow-sm"
              >
                {usuariosList.map(usr => (
                  <option key={usr.uid} value={usr.uid}>{usr.nome} ({usr.empresa_id || 'Direto'})</option>
                ))}
              </select>
            </div>
            
            {renderMatrix(
              permUsuario, 
              setPermUsuario, 
              permUsuario?.empresa_id ? permEmpresa : permContratante,
              loadingUsuario
            )}
            
          </div>
        )}

      </div>
    </div>
  );
};
