export type NavigationTab = 'home' | 'login' | 'dashboard' | 'financeiro' | 'contratos' | 'alertas' | 'onboarding' | 'auth-debug' | 'empresas' | 'fornecedores' | 'equipes' | 'funcionarios' | 'maquinas' | 'ferramentas' | 'materiais' | 'entidades' | 'matriz-acesso' | 'usuarios' | 'projetos_eap' | 'ordens_servico' | 'contratos_obra' | 'audit-log' | 'parametros' | 'calendarios' | 'cronograma_executivo' | 'cronograma_financeiro' | 'rdo' | 'medicoes' | 'custos_financeiro' | 'dispositivos' | 'orcamentacao' | 'importacao_cub' | 'orcamento_base' | 'histograma';

// Re-exports dos tipos modularizados para manter compatibilidade com o frontend
export type { FirebaseCustomClaims as CustomClaims } from './types/firebase.types';
export type { FirebaseAuthSession as AuthSession } from './types/firebase.types';
export type { FirebaseOnboardingInvite as OnboardingInvite } from './types/firebase.types';
export type { CerneEmpresa as EmpresaItem } from './types/cerne.types';

export * from './types/firebase.types';
export * from './types/cerne.types';
export * from './types/middleware.types';

export interface DispositivoItem {
  id: string;
  tenant_id: string;
  device_id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  funcionario_cargo?: string;
  funcionario_cpf?: string;
  empresa_id?: string;
  empresa_nome?: string;
  status: 'PENDENTE' | 'APROVADO' | 'BLOQUEADO';
  modelo?: string;
  os_version?: string;
  last_login?: string;
  created_at?: string;
}

export interface EspecialidadeItem {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string;
  cor?: string;
  icone?: string;
  valor_hora?: number;
  status: 'ATIVO' | 'INATIVO';
  created_at?: string;
}

export interface FuncionarioEquipeAllocation {
  equipe_id: string;
  equipe_nome: string;
  funcao_na_equipe: string;
}

export interface FuncionarioItem {
  id: string;
  tenant_id: string;
  empresa_id: string;
  empresa_nome?: string;
  nome: string;
  cpf?: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  especialidade_id?: string;
  especialidade_nome?: string;
  especialidade_cor?: string;
  especialidade_icone?: string;
  data_admissao?: string;
  status: 'ATIVO' | 'INATIVO' | 'AFASTADO';
  foto_url?: string;
  created_at?: string;
  equipes?: FuncionarioEquipeAllocation[];
}

export interface EquipeMembroItem {
  id?: string;
  funcionario_id: string;
  funcao_na_equipe: 'LIDER' | 'COORDENADOR' | 'MEMBRO' | 'SUPORTE_TECNICO' | 'AUXILIAR';
  adicionado_em?: string;
  nome?: string;
  cargo?: string;
  especialidade_nome?: string;
  especialidade_cor?: string;
  especialidade_icone?: string;
}

export interface EquipeItem {
  id: string;
  tenant_id: string;
  empresa_id: string;
  empresa_nome?: string;
  nome: string;
  descricao?: string;
  lider_id?: string;
  lider_nome?: string;
  status: 'ATIVA' | 'INATIVA' | 'EM_CAMPO';
  created_at?: string;
  ordens_servico?: any[];
  membros?: EquipeMembroItem[];
}

export interface RefCargoSalario {
    id: string;
    uf: string;
    codigo_cbo: string;
    nome_cargo: string;
    salario_piso: number;
    salario_medio: number;
    salario_maior: number;
    cuai_valor: number;
    fc_valor: number;
}

export interface RefMatrizEncargo {
    id: string;
    uf: string;
    codigo_item: string;
    grupo: string;
    descricao: string;
    pct_com_deson_horista: number;
    pct_com_deson_mensalista: number;
    pct_sem_deson_horista: number;
    pct_sem_deson_mensalista: number;
}

export interface TenantCargoSalario {
    id: string;
    tenant_id: string;
    obra_id?: string;
    ref_cargo_id?: string;
    codigo_cbo: string;
    nome_cargo: string;
    salario_base_adotado: number;
    cuai_adotado: number;
    fc_adotado: number;
}

export interface TenantBdiConfig {
    id: string;
    tenant_id: string;
    obra_id?: string;
    tipo_composicao: 'SERVICO' | 'FORNECIMENTO';
    pct_administracao_central: number;
    pct_seguros_garantias: number;
    pct_riscos: number;
    pct_despesas_financeiras: number;
    pct_lucro: number;
    pct_iss: number;
    pct_pis: number;
    pct_cofins: number;
    pct_cprb: number;
    bdi_calculado: number;
}

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

export interface ValidacaoTarefaEntry {
  id: string;
  titulo: string;
  descricao: string;
  agente: string;
  status: 'PENDENTE' | 'VALIDADO' | 'FALHOU';
  notas_validacao?: string;
  link_referencia?: string;
  criado_em: string;
  validado_em?: string;
  responsavel_uid?: string;
}

