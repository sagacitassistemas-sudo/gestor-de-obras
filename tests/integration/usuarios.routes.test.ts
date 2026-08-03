/**
 * tests/integration/usuarios.routes.test.ts
 * Testes de integração das rotas de usuários.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { resetDb, getDb, buildSupabaseMock } from '../helpers/db.helpers';
import { adminToken, visitanteToken } from '../helpers/auth.helpers';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => buildSupabaseMock()),
}));

let app: any;
beforeAll(async () => {
  const mod = await import('../../server.ts');
  app = mod.default;
});

describe('GET /api/usuarios', () => {
  beforeEach(() => resetDb('default'));

  it('🔴 deve retornar 401 sem token', async () => {
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(401);
  });

  it('🟢 deve retornar lista de usuários para ADMIN', async () => {
    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const list = res.body.usuarios ?? res.body.data ?? [];
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('🔴 deve retornar 403 para VISITANTE sem permissão de usuarios_ler', async () => {
    getDb().v_permissoes_efetivas = [{
      usuario_uid: 'visitante-uid-001',
      contrato_id: 'CTR-2026-SYS',
      usuarios_ler: false,
      empresas_ler: false,
    }];

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${visitanteToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/usuarios', () => {
  const novoUsuario = {
    uid: 'novo-user-001',
    email: 'novo@empresa.com',
    nome: 'Novo Usuário',
    perfil: 'FORNECEDOR',
    empresa_id: 'GER-2026-SYS',
  };

  beforeEach(() => resetDb('default'));

  it('🔴 deve retornar 401 sem token', async () => {
    const res = await request(app).post('/api/usuarios').send(novoUsuario);
    expect(res.status).toBe(401);
  });

  it('🔴 deve retornar 403 para VISITANTE ao tentar criar usuário', async () => {
    getDb().v_permissoes_efetivas = [{
      usuario_uid: 'visitante-uid-001',
      contrato_id: 'CTR-2026-SYS',
      usuarios_criar: false,
      usuarios_ler: false,
    }];

    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${visitanteToken()}`)
      .send(novoUsuario);

    expect(res.status).toBe(403);
  });

  it('🟢 deve criar usuário e retornar 200 para ADMIN', async () => {
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(novoUsuario);

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBeDefined();
  });

  it('🟢 deve seedar permissoes_usuario automaticamente a partir do template FORNECEDOR', async () => {
    // Adicionar template FORNECEDOR
    getDb().permissoes_tipo.push({
      id: 'pt-fornecedor',
      contrato_id: 'CTR-2026-SYS',
      perfil: 'FORNECEDOR',
      empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
      projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
      medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
      financeiro_criar: false, financeiro_ler: false, financeiro_editar: false, financeiro_excluir: false,
      relatorios_ler: false,
      usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
    });

    await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...novoUsuario, uid: 'seed-test-uid', perfil: 'FORNECEDOR' });

    const perm = getDb().permissoes_usuario.find((p: any) => p.usuario_uid === 'seed-test-uid');
    expect(perm).toBeDefined();
    expect(perm?.empresas_ler).toBe(true);
    expect(perm?.financeiro_ler).toBe(false);
  });
});
