export type NavigationTab = 'login' | 'dashboard' | 'financeiro' | 'contratos' | 'alertas' | 'onboarding' | 'auth-debug' | 'empresas' | 'fornecedores' | 'equipes' | 'maquinas' | 'ferramentas' | 'materiais' | 'entidades' | 'matriz-acesso' | 'usuarios' | 'projetos_eap' | 'ordens_servico' | 'contratos_obra' | 'audit-log' | 'parametros' | 'cronograma_executivo' | 'rdo';

// Re-exports dos tipos modularizados para manter compatibilidade com o frontend
export type { FirebaseCustomClaims as CustomClaims } from './types/firebase.types';
export type { FirebaseAuthSession as AuthSession } from './types/firebase.types';
export type { FirebaseOnboardingInvite as OnboardingInvite } from './types/firebase.types';
export type { CerneEmpresa as EmpresaItem } from './types/cerne.types';

export * from './types/firebase.types';
export * from './types/cerne.types';
export * from './types/middleware.types';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  contrato_id: string;
  empresa_id?: string; // Vínculo OPCIONAL a empresa (fornecedor/parceiro/cliente)
  empresa_nome?: string; // Nome da empresa vinculada
  perfil: 'FINANCEIRO' | 'FORNECEDOR' | 'GESTOR' | 'ADMIN';
  mfaEnabled: boolean;
  status: 'ATIVO' | 'INATIVO' | 'PENDENTE';
  createdAt: string;
}


export interface UserProfile {
  uid?: string;
  name: string;
  role: string;
  company: string;
  tier: string;
  avatarUrl: string;
  email: string;
}

export interface ContractItem {
  id: string;
  code: string;
  object: string;
  expirationDate: string;
  status: 'ATIVO' | 'RENOVAÇÃO' | 'ENCERRADO';
  totalValue: number;
  monthlyValue?: number;
  category?: string;
  marginAlert?: boolean;
  fornecedorId?: string;
  fornecedorNome?: string;
}

export interface InvoiceItem {
  id: string;
  code: string;
  description: string;
  type: string; // e.g. 'Serviços', 'Logística'
  value: number;
  date: string;
  status: 'EM_PROCESSAMENTO' | 'VALIDADA' | 'REJEITADA';
}

export interface PendingPayment {
  id: string;
  title: string;
  category: 'AWS Cloud' | 'TransPort' | 'Serviços' | 'Equipamentos';
  dueDate: string;
  value: number;
  status: 'Pendente' | 'Pago';
  icon: string;
}

export interface DRELine {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  variation: string;
  isPositiveVariation: boolean;
  status?: 'Atingido' | 'Estável' | 'Alerta' | 'Superado' | 'Eficiente';
  isBold?: boolean;
  isTotal?: boolean;
  isSubtotal?: boolean;
}

export interface ActivityItem {
  id: string;
  title: string;
  timestamp: string;
  type: 'invoice' | 'alert' | 'contract' | 'system';
  color: 'primary' | 'warning' | 'success' | 'processing';
}

export interface ChamadoTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: 'Faturamento' | 'Contratos' | 'Acesso/TI' | 'Geral';
  priority: 'Alta' | 'Média' | 'Baixa';
  description: string;
  createdAt: string;
  status: 'Aberto' | 'Em Atendimento' | 'Concluído';
}

export interface SystemAlert {
  id: string;
  contractCode: string;
  title: string;
  severity: 'Crítico' | 'Aviso' | 'Informativo';
  description: string;
  daysRemaining?: number;
  usagePercent?: number;
  actionText: string;
}

export interface AuditLogEntry {
  id: string;
  contrato_id: string;
  usuario_uid: string;
  usuario_email: string;
  cod_evento: string;
  descricao: string;
  entidade_tipo: string;
  entidade_id: string;
  criado_em: string;
  sistema_eventos_catalogo?: {
    descricao: string;
    categoria: string;
  };
}

export interface SystemErrorEntry {
  id: string;
  contrato_id: string;
  usuario_uid: string;
  cod_evento: string;
  rota: string;
  mensagem: string;
  stack_trace: string;
  criado_em: string;
  sistema_eventos_catalogo?: {
    descricao: string;
    categoria: string;
  };
}
