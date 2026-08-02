import React, { useState, useEffect } from 'react';
import { AuthSession } from '../types';
import { PermissoesContratante, PermissoesEmpresa, PermissoesUsuario } from '../types/cerne.types';

interface MatrizAcessosViewProps {
  authSession?: AuthSession | null;
}

const MODULOS = [
  { id: 'empresas', label: 'Empresas / Fornecedores' },
  { id: 'projetos', label: 'Projetos e EAP' },
  { id: 'medicoes', label: 'Medições e Contratos' },
  { id: 'financeiro', label: 'Financeiro e Lançamentos' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'usuarios', label: 'Usuários e Acessos' }
];

export const MatrizAcessosView: React.FC<MatrizAcessosViewProps> = ({ authSession }) => {
  const currentClaims = authSession?.customClaims;
  const isAdmin = currentClaims?.perfil === 'ADMIN';
  const isGestor = currentClaims?.perfil === 'GESTOR' || isAdmin;
  const tenantId = currentClaims?.contrato_id || 'CTR-2026-SYS';

  const [activeTab, setActiveTab] = useState<'contratante' | 'empresas' | 'usuarios'>('contratante');
  const [notification, setNotification] = useState<{type: string, message: string} | null>(null);

  // States for Permissions
  const [permContratante, setPermContratante] = useState<PermissoesContratante | null>(null);
  
  // Mocks for dropdowns
  const empresasList = [
    { id: 'SUP-9823-STORAGE', label: 'SUP-9823-STORAGE - Storage & Infraestrutura Ltda' },
    { id: 'SUP-4012-LOGISTICA', label: 'SUP-4012-LOGISTICA - Transportes & Logística SP-RJ' }
  ];
  
  const usuariosList = [
    { uid: 'USR-8801', nome: 'Carlos Eduardo Silva', empresa_id: 'SUP-9823-STORAGE' },
    { uid: 'USR-8803', nome: 'Mariana Alves', empresa_id: null }, // direto
  ];

  const [selectedEmpresaId, setSelectedEmpresaId] = useState(empresasList[0].id);
  const [permEmpresa, setPermEmpresa] = useState<PermissoesEmpresa | null>(null);

  const [selectedUsuarioId, setSelectedUsuarioId] = useState(usuariosList[0].uid);
  const [permUsuario, setPermUsuario] = useState<PermissoesUsuario | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Carregar permissões da Contratante
  useEffect(() => {
    // Simulating fetch
    setPermContratante({
      contrato_id: tenantId,
      empresas_criar: true, empresas_ler: true, empresas_editar: true, empresas_excluir: true,
      projetos_criar: true, projetos_ler: true, projetos_editar: true, projetos_excluir: true,
      medicoes_criar: true, medicoes_ler: true, medicoes_editar: true, medicoes_excluir: true,
      financeiro_criar: true, financeiro_ler: true, financeiro_editar: true, financeiro_excluir: true,
      relatorios_ler: true,
      usuarios_criar: true, usuarios_ler: true, usuarios_editar: true, usuarios_excluir: true,
    });
  }, [tenantId]);

  // Carregar permissões da Empresa selecionada
  useEffect(() => {
    setPermEmpresa({
      contrato_id: tenantId,
      empresa_id: selectedEmpresaId,
      empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
      projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
      medicoes_criar: true, medicoes_ler: true, medicoes_editar: true, medicoes_excluir: false,
      financeiro_criar: false, financeiro_ler: true, financeiro_editar: false, financeiro_excluir: false,
      relatorios_ler: true,
      usuarios_criar: false, usuarios_ler: true, usuarios_editar: false, usuarios_excluir: false,
    });
  }, [selectedEmpresaId, tenantId]);

  // Carregar permissões do Usuario selecionado
  useEffect(() => {
    const user = usuariosList.find(u => u.uid === selectedUsuarioId);
    setPermUsuario({
      usuario_uid: selectedUsuarioId,
      contrato_id: tenantId,
      empresa_id: user?.empresa_id || null,
      empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
      projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
      medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
      financeiro_criar: false, financeiro_ler: true, financeiro_editar: false, financeiro_excluir: false,
      relatorios_ler: true,
      usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
    });
  }, [selectedUsuarioId, tenantId]);


  const handleSave = () => {
    showNotification('success', 'Permissões salvas com sucesso no banco de dados!');
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

  const renderMatrix = (
    currentPerms: any, 
    setter: any, 
    maxLimitPerms?: any
  ) => {
    if (!currentPerms) return <div className="p-4">Carregando...</div>;

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
            {MODULOS.map((modulo) => (
              <tr key={modulo.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3 font-bold text-slate-800">{modulo.label}</td>
                {['criar', 'ler', 'editar', 'excluir'].map((action) => {
                  const key = `${modulo.id}_${action}`;
                  if (modulo.id === 'relatorios' && action !== 'ler') {
                    return <td key={action} className="p-3 text-center bg-slate-50"></td>; // Relatorios so tem ler
                  }

                  const hasPerm = currentPerms[key];
                  const limitReached = maxLimitPerms && !maxLimitPerms[key];

                  return (
                    <td key={action} className="p-3 text-center">
                      <button
                        onClick={() => togglePermission(currentPerms, setter, key, maxLimitPerms)}
                        disabled={limitReached}
                        title={limitReached ? 'Bloqueado pelo Teto Superior' : 'Alternar Permissão'}
                        className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-all ${
                          limitReached
                            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50'
                            : hasPerm
                            ? 'bg-emerald-500 text-white shadow-2xs cursor-pointer hover:bg-emerald-600'
                            : 'bg-white text-slate-300 border border-slate-300 cursor-pointer hover:bg-slate-50 hover:text-slate-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm font-bold">
                          {hasPerm ? 'check' : limitReached ? 'block' : 'close'}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
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
          onClick={() => setActiveTab('empresas')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'empresas' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Por Empresa
        </button>
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'usuarios' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Por Usuário
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
              renderMatrix(permContratante, setPermContratante)
            ) : (
              <div className="p-4 bg-slate-50 text-slate-500 text-sm font-bold rounded-md border border-slate-200 text-center">
                Acesso Restrito: Somente Administradores podem alterar o Teto Global.
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
              renderMatrix(permEmpresa, setPermEmpresa, permContratante)
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
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Permissões individuais. Limitadas pelo Teto da Empresa (se vinculado) ou pelo Teto Global (se direto).
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
              // Limitador dinâmico: Se tiver empresa vinculada, o teto é a empresa. Senão, é a contratante.
              permUsuario?.empresa_id ? permEmpresa : permContratante
            )}
            
          </div>
        )}

      </div>
    </div>
  );
};
