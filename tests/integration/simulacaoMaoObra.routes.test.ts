import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { resetDb, getDb, buildSupabaseMock } from '../helpers/db.helpers';

// ── Mock do Supabase ANTES de qualquer import do server ───────────────────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => buildSupabaseMock()),
}));

import app from '../../server';

// Mock Middleware Firebase
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: 'user123',
      contrato_id: 'CTR-TEST',
      role: 'ADMIN'
    }),
    getUser: vi.fn().mockResolvedValue({
      uid: 'user123',
      email: 'test@example.com'
    })
  })
}));

describe('Simulação Mão de Obra (Motor Dinâmico)', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
    resetDb();
    const db = getDb();

    // Populate db with the required tables for this test
    (db as any).calendarios = [
      {
        id: 'cal-1',
        is_default: true,
        horas_dia: 8,
        dias_trabalho_semana: [1, 2, 3, 4, 5]
      }
    ];

    (db as any).ordens_servico = [
      { id: 'os-1', projeto_id: 'PROJ-1', equipe_id: 'equipe-1' },
      { id: 'os-2', projeto_id: 'proj-123', equipe_id: 'equipe-2' }
    ];

    (db as any).equipe_membros = [
      {
        id: 'membro1',
        equipe_id: 'equipe-1',
        adicionado_em: '2026-08-01',
        funcionarios: {
          id: 'func1',
          cargo: 'Carpinteiro'
        }
      },
      {
        id: 'membro2',
        equipe_id: 'equipe-2',
        adicionado_em: '2026-08-01',
        funcionarios: {
          id: 'func2',
          cargo: 'Carpinteiro'
        }
      }
    ];

    (db as any).ref_encargos_complementares = [
      { categoria: 'Exames (PCMSO)', custo_mensalista_ref: 267.33, custo_horista_ref: 1.62 },
      { categoria: 'Transporte', custo_mensalista_ref: 300, custo_horista_ref: 1.50 },
      { categoria: 'Rescisão', custo_mensalista_ref: 200, custo_horista_ref: 0 }
    ];

    (db as any).ref_encargos_especificos = [];

    (db as any).tenant_cargos_salarios = [
      {
        nome_cargo: 'Carpinteiro',
        salario_base_adotado: 2500.00,
        encargos_sociais_perc: 85.0
      }
    ];
  });

  it('deve retornar status 400 se projeto_id nao for enviado', async () => {
    const response = await request(app)
      .get('/api/custos/simulacao-mao-obra')
      .set('Authorization', 'Bearer mock_token');
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'projeto_id is required');
  });

  it('deve calcular corretamente os custos baseados no calendario e histograma', async () => {
    const response = await request(app)
      .get('/api/custos/simulacao-mao-obra?projeto_id=PROJ-1')
      .set('Authorization', 'Bearer mock_token');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    
    const calculo = response.body.calculo;
    // Horas_mes = 8h * 5 dias * 4.33 = 173.2 (arr 173)
    expect(calculo.horas_mes_adotadas).toBe(173);
    
    // Admission cost: 1 funcionário * 267.33 (Exames PCMSO)
    expect(calculo.total_admission_costs).toBe(267.33);

    // Salario: 2500 / 173 = 14.45 /h
    // Encargos Sociais: 14.45 * 0.85 = 12.28 /h
    // Geral: Transporte (1.50) => Exames não entram no rateio
    // Total: ~ 28.23
    expect(calculo.total_hourly_rate).toBeCloseTo(28.23, 1);
  });
});

describe('Simulação Dinâmica de Mão de Obra', () => {
  it('deve calcular o custo horário, admissional e demissional corretamente sem pendencias', async () => {
    const response = await request(app)
      .get('/api/custos/simulacao-mao-obra?projeto_id=proj-123')
      .set('Authorization', 'Bearer fake-jwt-token');

    expect(response.status).toBe(200);
    expect(response.body.calculo).toBeDefined();
    expect(response.body.calculo.total_admission_costs).toBe(267.33); 
    expect(response.body.calculo.total_dismissal_costs).toBe(200); 
    expect(response.body.calculo.horas_mes_adotadas).toBe(173); 
    
    // Salario: 2500 / 173 = 14.45
    // Encargos: 14.45 * 85% = 12.28
    // GeraisHora = 1.50
    // total = 28.23
    expect(response.body.calculo.total_hourly_rate).toBeCloseTo(28.23, 1);
  });

  it('deve listar as variáveis faltantes (pendencias) na auditoria do motor', async () => {
    const db = getDb();
    (db as any).tenant_cargos_salarios = [];
    (db as any).ref_cargos_salarios = [];
    (db as any).ref_encargos_complementares = [];
    (db as any).equipe_membros = [
      {
        id: 'membro-1',
        equipe_id: 'equipe-test',
        adicionado_em: '2026-08-20T00:00:00Z',
        funcionarios: { cargo: 'Pedreiro' }
      }
    ];
    (db as any).ordens_servico = [{ equipe_id: 'equipe-test', projeto_id: 'proj-empty' }];

    const response = await request(app)
      .get('/api/custos/simulacao-mao-obra?projeto_id=proj-empty')
      .set('Authorization', 'Bearer fake-jwt-token');

    expect(response.status).toBe(200);
    expect(response.body.calculo.pendencias).toBeDefined();
    expect(response.body.calculo.pendencias.length).toBeGreaterThan(0);
    expect(response.body.calculo.pendencias).toContain("Custo Admissional (Exames PCMSO) não configurado ou zerado nas referências gerais.");
    expect(response.body.calculo.pendencias).toContain("Custo Demissional (Rescisão) não configurado ou zerado nas referências gerais.");
    expect(response.body.calculo.pendencias).toContain("Salário base não encontrado ou zerado para o cargo: Pedreiro");
  });
});
