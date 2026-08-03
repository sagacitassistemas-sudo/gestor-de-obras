import { UserProfile, ContractItem, InvoiceItem, PendingPayment, DRELine, ActivityItem, ChamadoTicket, SystemAlert, EmpresaItem } from '../types';

export const initialProfile: UserProfile = {
  name: 'Logística Global SA',
  role: 'Gerente Financeiro',
  company: 'Works Manager',
  tier: 'FORNECEDOR PREMIUM',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDYTkaT4oqHI3epkFmjUHf3FoYmFFxf7-tIzV1Dui-w2ZiBkkz_9yREkYJFAplvWZMdZN3_XkW9IXVgnh2kdfylcELIbm9u_TrK15pbr9cFDz0d-1SQ5MboH3SW4KlTYN4_FK_AupZB8yAIykyop0yL9oEt1ujjkHjZqyPOlklMxdCpPpxksBdOocSOmjajGzr3A2RXMQuuVHsymLQ3h0yIidBQHh420byLVxOyZGewaw8TjfDXrz9r',
  email: 'financeiro@logisticsglobal.com.br'
};

export const initialContracts: ContractItem[] = [
  {
    id: '1',
    code: '006/2024',
    object: 'Contrato Principal de Execução Real',
    expirationDate: '31/12/2025',
    status: 'ATIVO',
    totalValue: 1200000.00,
    monthlyValue: 50000.00,
    category: 'Logística',
    marginAlert: false,
    fornecedorId: 'SUP-8401-CONSORC'
  }
];

export const initialInvoices: InvoiceItem[] = [
  {
    id: '1',
    code: 'NF #9822',
    description: 'Serviços de Armazenagem Climatizada - Maio/2026',
    type: 'Serviços',
    value: 12450.00,
    date: '28/07/2026',
    status: 'EM_PROCESSAMENTO'
  },
  {
    id: '2',
    code: 'NF #9845',
    description: 'Logística de Distribuição Expressa',
    type: 'Logística',
    value: 4200.00,
    date: '29/07/2026',
    status: 'EM_PROCESSAMENTO'
  },
  {
    id: '3',
    code: 'NF #9810',
    description: 'Suporte Técnico e Sensores IoT - Junho/2026',
    type: 'Tecnologia',
    value: 18900.00,
    date: '15/07/2026',
    status: 'VALIDADA'
  },
  {
    id: '4',
    code: 'NF #9790',
    description: 'Manutenção de Racks Industriais - Lote B',
    type: 'Manutenção',
    value: 6875.00,
    date: '10/07/2026',
    status: 'VALIDADA'
  }
];

export const initialPendingPayments: PendingPayment[] = [
  {
    id: 'p1',
    title: 'Serviços de Storage - AWS Cloud',
    category: 'AWS Cloud',
    dueDate: '22/06/2024',
    value: 12400.00,
    status: 'Pendente',
    icon: 'dock'
  },
  {
    id: 'p2',
    title: 'Logística Nacional - TransPort',
    category: 'TransPort',
    dueDate: '24/06/2024',
    value: 4560.30,
    status: 'Pendente',
    icon: 'local_shipping'
  },
  {
    id: 'p3',
    title: 'Licenciamento de Software IoT',
    category: 'Serviços',
    dueDate: '30/06/2024',
    value: 8900.00,
    status: 'Pendente',
    icon: 'terminal'
  }
];

export const initialDREData: DRELine[] = [
  {
    id: 'dre-1',
    label: 'Receita Bruta Operacional',
    value: 1240500.00,
    formattedValue: 'R$ 1.240.500,00',
    variation: '+5.2%',
    isPositiveVariation: true,
    status: 'Atingido',
    isBold: true
  },
  {
    id: 'dre-2',
    label: '(-) Impostos e Deduções',
    value: -186075.00,
    formattedValue: 'R$ (186.075,00)',
    variation: '+1.5%',
    isPositiveVariation: false,
    status: 'Estável'
  },
  {
    id: 'dre-3',
    label: 'Receita Líquida',
    value: 1054425.00,
    formattedValue: 'R$ 1.054.425,00',
    variation: '+6.1%',
    isPositiveVariation: true,
    isSubtotal: true
  },
  {
    id: 'dre-4',
    label: '(-) Custos de Mercadorias (CMV)',
    value: -682310.45,
    formattedValue: 'R$ (682.310,45)',
    variation: '+4.2%',
    isPositiveVariation: false,
    status: 'Alerta'
  },
  {
    id: 'dre-5',
    label: 'Lucro Operacional Bruto',
    value: 372114.55,
    formattedValue: 'R$ 372.114,55',
    variation: '+8.9%',
    isPositiveVariation: true,
    status: 'Superado'
  },
  {
    id: 'dre-6',
    label: '(-) Despesas Administrativas',
    value: -59674.43,
    formattedValue: 'R$ (59.674,43)',
    variation: '-2.1%',
    isPositiveVariation: true,
    status: 'Eficiente'
  },
  {
    id: 'dre-7',
    label: 'LUCRO LÍQUIDO DO PERÍODO',
    value: 312440.12,
    formattedValue: 'R$ 312.440,12',
    variation: '+12.4%',
    isPositiveVariation: true,
    isTotal: true
  }
];

export const initialActivities: ActivityItem[] = [
  {
    id: 'act-1',
    title: 'Nota Fiscal #9822 validada',
    timestamp: 'Há 2 horas pelo sistema',
    type: 'invoice',
    color: 'primary'
  },
  {
    id: 'act-2',
    title: 'Alerta de Margem: CTR-2024-042',
    timestamp: 'Há 5 horas - Auditoria',
    type: 'alert',
    color: 'warning'
  },
  {
    id: 'act-3',
    title: 'Novo Contrato Assinado',
    timestamp: 'Ontem, 14:30',
    type: 'contract',
    color: 'success'
  }
];

export const initialAlerts: SystemAlert[] = [
  {
    id: 'alt-1',
    contractCode: '#SS-2024-08',
    title: 'Renovação Imediata Necessária',
    severity: 'Crítico',
    description: 'Contrato prestes a vencer. Apenas 4 dias restantes para renovação do faturamento.',
    daysRemaining: 4,
    actionText: 'Solicitar Renovação'
  },
  {
    id: 'alt-2',
    contractCode: '#SS-2023-15',
    title: 'Teto de Faturamento Atingindo Limite',
    severity: 'Crítico',
    description: 'O contrato consumiu 95% do teto financeiro aprovado para a vigência atual.',
    usagePercent: 95,
    actionText: 'Aumentar Teto'
  },
  {
    id: 'alt-3',
    contractCode: 'CTR-2024-042',
    title: 'Variação Elevada nos Custos (CMV)',
    severity: 'Crítico',
    description: 'Margem bruta projetada caiu para 12.4% (-2.1% em relação ao mês anterior).',
    actionText: 'Revisar Custos'
  },
  {
    id: 'alt-4',
    contractCode: '#SS-2024-02',
    title: 'Documento Fiscal Pendente de Validação',
    severity: 'Crítico',
    description: 'Nota Fiscal #9822 aguarda aprovação de compliance técnico há mais de 48h.',
    actionText: 'Validar NF'
  }
];

export const initialChamados: ChamadoTicket[] = [
  {
    id: 'ch-1',
    ticketNumber: 'TK-9082',
    subject: 'Dúvida sobre alíquota de impostos na NF #9822',
    category: 'Faturamento',
    priority: 'Alta',
    description: 'Precisamos confirmar o destaque de retenção referente ao contrato de armazenagem.',
    createdAt: '29/07/2026 10:15',
    status: 'Em Atendimento'
  },
  {
    id: 'ch-2',
    ticketNumber: 'TK-8941',
    subject: 'Solicitação de prorrogação do aditivo CTR-2024-042',
    category: 'Contratos',
    priority: 'Média',
    description: 'Pedido de extensão de prazo para conclusão das manutenções de racks.',
    createdAt: '25/07/2026 16:40',
    status: 'Aberto'
  }
];

export const initialEmpresas: EmpresaItem[] = [];

