export interface PermissoesBase {
  empresas_criar: boolean;
  empresas_ler: boolean;
  empresas_editar: boolean;
  empresas_excluir: boolean;
  projetos_criar: boolean;
  projetos_ler: boolean;
  projetos_editar: boolean;
  projetos_excluir: boolean;
  medicoes_criar: boolean;
  medicoes_ler: boolean;
  medicoes_editar: boolean;
  medicoes_excluir: boolean;
  financeiro_criar: boolean;
  financeiro_ler: boolean;
  financeiro_editar: boolean;
  financeiro_excluir: boolean;
  relatorios_ler: boolean;
  usuarios_criar: boolean;
  usuarios_ler: boolean;
  usuarios_editar: boolean;
  usuarios_excluir: boolean;
  cronogramas_criar: boolean;
  cronogramas_ler: boolean;
  cronogramas_editar: boolean;
  cronogramas_excluir: boolean;
  rdo_criar: boolean;
  rdo_ler: boolean;
  rdo_editar: boolean;
  rdo_excluir: boolean;
  os_criar: boolean;
  os_ler: boolean;
  os_editar: boolean;
  os_excluir: boolean;
  contratos_criar: boolean;
  contratos_ler: boolean;
  contratos_editar: boolean;
  contratos_excluir: boolean;
  entidades_criar: boolean;
  entidades_ler: boolean;
  entidades_editar: boolean;
  entidades_excluir: boolean;
  configuracoes_criar: boolean;
  configuracoes_ler: boolean;
  configuracoes_editar: boolean;
  configuracoes_excluir: boolean;
}

export interface PermissoesContratante extends PermissoesBase {
  id?: string;
  contrato_id: string;
}

export interface PermissoesEmpresa extends PermissoesBase {
  id?: string;
  contrato_id: string;
  empresa_id: string;
}

export interface PermissoesUsuario extends PermissoesBase {
  id?: string;
  usuario_uid: string;
  contrato_id: string;
  empresa_id: string | null;
}

export interface PermissoesEfetivas extends PermissoesBase {
  usuario_uid: string;
  contrato_id: string;
  empresa_id: string | null;
  email: string;
  nome: string;
  perfil: string;
}

export interface CerneEmpresa {
  id: string;
  contrato_id: string;
  nome: string;
  cnpj_cpf: string;
  tipo: 'FORNECEDOR' | 'CLIENTE' | 'PARCEIRO' | 'CONTRATANTE' | 'GESTORA';
  emailContato: string;
  telefone: string;
  status: 'ATIVO' | 'BLOQUEADO' | 'EM_ANALISE';
  totalFaturado: number;
  createdAt: string;
}

export interface CerneContratante {
  contrato_id: string;
  natureza: 'Publica' | 'Privada' | string;
  nome: string;
  area: string;
  departamento: string;
  cnpj: string;
  email: string;
  telefone: string;
  gestorResponsavel: string;
  unidadeAdministrativa: string;
}

export interface CerneLancamento {
  id: string;
  contrato_id: string;
  fornecedor_id: string;
  descricao: string;
  valor: number;
  tipo: 'RECEITA' | 'DESPESA' | string;
  status: 'PAGO' | 'PENDENTE' | 'EM_PROCESSAMENTO' | string;
  data_vencimento: string;
  criado_por: string;
  createdAt: string;
}

export interface ContratoObra {
  id: string;
  tenant_id: string;
  fornecedor_id: string;
  projeto_id: string;
  numero_contrato: string;
  objeto: string | null;
  valor_global: number;
  data_assinatura: string | null;
  data_vigencia: string | null;
  status: 'RASCUNHO' | 'VIGENTE' | 'ENCERRADO' | 'RESCINDIDO' | 'ADITIVO';
  created_at: string;
  updated_at: string;
}

export interface ContratoObraResumo {
  contrato_obra_id: string;
  tenant_id: string;
  numero_contrato: string;
  objeto: string | null;
  valor_global: number;
  data_assinatura: string | null;
  data_vigencia: string | null;
  contrato_status: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  projeto_id: string;
  nome_projeto: string;
  total_medicoes: number;
  medicao_valor_acumulado: number;
  percentual_executado: number;
}
