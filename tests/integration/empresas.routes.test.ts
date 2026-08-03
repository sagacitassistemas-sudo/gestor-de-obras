/**
 * tests/integration/empresas.routes.test.ts
 * Testes de integração das rotas de empresas.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { resetDb, getDb, buildSupabaseMock } from '../helpers/db.helpers';
import { adminToken, visitanteToken, gestorToken } from '../helpers/auth.helpers';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => buildSupabaseMock()),
}));

let app: any;
beforeAll(async () => {
  const mod = await import('../../server.ts');
  app = mod.default;
});

describe('GET /api/empresas', () => {
  beforeEach(() => resetDb('default'));

  it('🔴 deve retornar 401 sem token de autorização', async () => {
    const res = await request(app).get('/api/empresas');
    expect(res.status).toBe(401);
  });

  it('🟢 deve retornar 200 com lista de empresas para ADMIN', async () => {
    const res = await request(app)
      .get('/api/empresas')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data ?? res.body.empresas).toBeDefined();
  });

  it('🟡 deve retornar 200 para GESTOR (leitura permitida)', async () => {
    const res = await request(app)
      .get('/api/empresas')
      .set('Authorization', `Bearer ${gestorToken()}`);

    expect(res.status).toBe(200);
  });

  it('🔴 deve retornar 403 para VISITANTE sem permissão de empresas_ler (via view)', async () => {
    // Sobrescreve a view para bloquear visitante
    getDb().v_permissoes_efetivas = [{
      usuario_uid: 'visitante-uid-001',
      contrato_id: 'CTR-2026-SYS',
      empresas_ler: false, empresas_criar: false,
      projetos_ler: false, medicoes_ler: false,
      financeiro_ler: false, usuarios_ler: false,
      relatorios_ler: false,
    }];

    const res = await request(app)
      .get('/api/empresas')
      .set('Authorization', `Bearer ${visitanteToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/empresas', () => {
  const novaEmpresa = { nome: 'Empresa Teste LTDA', cnpj_cpf: '12.345.678/0001-99', tipo: 'FORNECEDOR' };

  beforeEach(() => resetDb('default'));

  it('🔴 deve retornar 401 sem token', async () => {
    const res = await request(app).post('/api/empresas').send(novaEmpresa);
    expect(res.status).toBe(401);
  });

  it('🔴 deve retornar 403 para VISITANTE (sem permissão de criar)', async () => {
    // VISITANTE template não tem empresas_criar
    getDb().v_permissoes_efetivas = [{
      usuario_uid: 'visitante-uid-001',
      contrato_id: 'CTR-2026-SYS',
      empresas_ler: true, empresas_criar: false,
    }];

    const res = await request(app)
      .post('/api/empresas')
      .set('Authorization', `Bearer ${visitanteToken()}`)
      .send(novaEmpresa);

    expect(res.status).toBe(403);
  });

  it('🟢 deve retornar 200 e criar empresa para ADMIN', async () => {
    const res = await request(app)
      .post('/api/empresas')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(novaEmpresa);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('🟢 deve persistir empresa no banco em memória após criação', async () => {
    await request(app)
      .post('/api/empresas')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...novaEmpresa, nome: 'Empresa Persistida TDD' });

    const emp = getDb().empresas_fornecedores.find((e: any) => e.nome === 'Empresa Persistida TDD');
    expect(emp).toBeDefined();
  });
});
