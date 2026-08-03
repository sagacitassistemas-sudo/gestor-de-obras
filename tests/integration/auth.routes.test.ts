/**
 * tests/integration/auth.routes.test.ts
 * Testes de integração das rotas de autenticação com banco em memória.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { resetDb, getDb, buildSupabaseMock } from '../helpers/db.helpers';

// ── Mock do Supabase ANTES de qualquer import do server ───────────────────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => buildSupabaseMock()),
}));

// ── Import lazy do app (após mocks prontos) ───────────────────────────────────
let app: any;
beforeAll(async () => {
  const mod = await import('../../server.ts');
  app = mod.default;
});

// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/oauth-login', () => {
  describe('🟢 Banco vazio — Primeiro Admin', () => {
    beforeEach(() => resetDb('empty'));

    it('deve registrar o 1º usuário como ADMIN e retornar sessão', async () => {
      const res = await request(app)
        .post('/api/auth/oauth-login')
        .send({ provider: 'google', email: 'sagacitas.sistemas@gmail.com', displayName: 'Admin', uid: 'admin-uid-001' });

      expect(res.status).toBe(200);
      expect(res.body.session?.customClaims?.perfil).toBe('ADMIN');
    });

    it('deve criar empresa GER-2026-SYS automaticamente no banco em memória', async () => {
      await request(app)
        .post('/api/auth/oauth-login')
        .send({ provider: 'google', email: 'sagacitas.sistemas@gmail.com', displayName: 'Admin', uid: 'admin-uid-001' });

      const db = getDb();
      const empresa = db.empresas_fornecedores.find((e: any) => e.id === 'GER-2026-SYS');
      expect(empresa).toBeDefined();
      expect(empresa?.tipo).toBe('GESTORA');
    });
  });

  describe('🟢 Banco com usuários — SSO novo e-mail → VISITANTE', () => {
    beforeEach(() => resetDb('default'));

    it('deve auto-registrar novo usuário SSO como VISITANTE', async () => {
      const res = await request(app)
        .post('/api/auth/oauth-login')
        .send({ provider: 'google', email: 'novo@empresa.com', displayName: 'Novo', uid: 'novo-sso-uid' });

      expect(res.status).toBe(200);
      expect(res.body.session?.customClaims?.perfil).toBe('VISITANTE');
    });

    it('deve inserir o VISITANTE na tabela usuarios do banco em memória', async () => {
      await request(app)
        .post('/api/auth/oauth-login')
        .send({ provider: 'google', email: 'visitante2@teste.com', displayName: 'Vis', uid: 'vis-uid-002' });

      const db = getDb();
      const user = db.usuarios.find((u: any) => u.email === 'visitante2@teste.com');
      expect(user).toBeDefined();
      expect(user?.perfil).toBe('VISITANTE');
    });
  });

  describe('🟢 Usuário existente e ativo', () => {
    beforeEach(() => resetDb('default'));

    it('deve retornar sessão com perfil ADMIN para admin existente', async () => {
      const res = await request(app)
        .post('/api/auth/oauth-login')
        .send({ provider: 'google', email: 'sagacitas.sistemas@gmail.com', displayName: 'Admin', uid: 'admin-uid-001' });

      expect(res.status).toBe(200);
      expect(res.body.session?.customClaims?.perfil).toBe('ADMIN');
    });
  });

  describe('🔴 Usuário BLOQUEADO → HTTP 403', () => {
    beforeEach(() => {
      resetDb('default');
      getDb().usuarios[0].status = 'BLOQUEADO';
    });

    it('deve retornar 403 para usuário com status BLOQUEADO', async () => {
      const res = await request(app)
        .post('/api/auth/oauth-login')
        .send({ provider: 'google', email: 'sagacitas.sistemas@gmail.com', displayName: 'Admin', uid: 'admin-uid-001' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/[Bb]loqueado/);
    });
  });
});

describe('POST /api/auth/login-mfa-step1', () => {
  beforeEach(() => resetDb('default'));

  it('deve retornar 400 quando email ou senha não fornecidos', async () => {
    const res = await request(app)
      .post('/api/auth/login-mfa-step1')
      .send({ email: 'sagacitas.sistemas@gmail.com' });
    expect(res.status).toBe(400);
  });

  it('deve retornar 403 quando e-mail não existe na base', async () => {
    const res = await request(app)
      .post('/api/auth/login-mfa-step1')
      .send({ email: 'nao.existe@email.com', password: '123456' });
    expect(res.status).toBe(403);
  });

  it('deve gerar OTP e retornar mfaRequired=true para usuário ativo', async () => {
    const res = await request(app)
      .post('/api/auth/login-mfa-step1')
      .send({ email: 'sagacitas.sistemas@gmail.com', password: 'qualquer-senha' });

    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.mfaTicket).toBeDefined();
    expect(res.body.otpCodeDemo).toMatch(/^\d{6}$/);
  });
});
