/**
 * tests/integration/security.routes.test.ts
 * Testes de integração para políticas de segurança, ciclo de vida de convites e deny-by-default.
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

describe('🛡️ Segurança: Ciclo de Vida e Expiração de Convites', () => {
  beforeEach(() => resetDb('default'));

  it('🟢 deve consultar convite válido e pendente via GET /api/convites/:token', async () => {
    const validToken = 'valid-token-123';
    getDb().convites = [{
      token: validToken,
      email: 'novo.convidado@empresa.com',
      perfil: 'FORNECEDOR',
      empresa_id: 'GER-2026-SYS',
      contrato_id: 'CTR-2026-SYS',
      status: 'PENDENTE',
      expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    }];

    const res = await request(app).get(`/api/convites/${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('novo.convidado@empresa.com');
    expect(res.body.perfil).toBe('FORNECEDOR');
  });

  it('🔴 deve rejeitar e marcar como EXPIRADO convite com data limite expirada', async () => {
    const expiredToken = 'expired-token-456';
    getDb().convites = [{
      token: expiredToken,
      email: 'antigo.convidado@empresa.com',
      perfil: 'FORNECEDOR',
      contrato_id: 'CTR-2026-SYS',
      status: 'PENDENTE',
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 dia no passado
    }];

    const res = await request(app).get(`/api/convites/${expiredToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expirado/i);

    const conviteDb = getDb().convites.find((c: any) => c.token === expiredToken);
    expect(conviteDb?.status).toBe('EXPIRADO');
  });

  it('🔴 deve rejeitar aceite via POST /api/convites/accept para convite expirado', async () => {
    const expiredToken = 'expired-token-789';
    getDb().convites = [{
      token: expiredToken,
      email: 'expirado@empresa.com',
      perfil: 'GESTOR',
      contrato_id: 'CTR-2026-SYS',
      status: 'PENDENTE',
      expires_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    }];

    const res = await request(app)
      .post('/api/convites/accept')
      .send({ token: expiredToken, nome: 'Expirado Silva', senha: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expirado/i);
  });
});

describe('🛡️ Segurança: Deny-by-Default e Controle de Acesso', () => {
  beforeEach(() => resetDb('default'));

  it('🔴 deve bloquear operações de escrita em empresas para VISITANTE', async () => {
    const res = await request(app)
      .post('/api/empresas')
      .set('Authorization', `Bearer ${visitanteToken()}`)
      .send({
        nome: 'Empresa Invasora',
        cnpj_cpf: '99.999.999/0001-99',
        tipo: 'FORNECEDOR',
      });

    expect(res.status).toBe(403);
  });

  it('🔴 deve bloquear leitura de usuários para VISITANTE quando não há permissão explícita', async () => {
    getDb().v_permissoes_efetivas = [{
      usuario_uid: 'visitante-uid-001',
      contrato_id: 'CTR-2026-SYS',
      usuarios_ler: false,
    }];

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${visitanteToken()}`);

    expect(res.status).toBe(403);
  });

  it('🟢 deve garantir que ADMIN possui acesso completo e bypassa verificações intermediárias', async () => {
    const res = await request(app)
      .get('/api/empresas')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('🛡️ Segurança: Reconhecimento de Acesso da Empresa Gestora & Redefinição de Senha Master', () => {
  beforeEach(() => resetDb('default'));

  it('🟢 deve disparar e-mail de reconhecimento e contingência master para a Gestora via POST /api/gestora/send-confirmation', async () => {
    const res = await request(app)
      .post('/api/gestora/send-confirmation')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        empresa_id: 'GER-2026-SYS',
        email: 'sagacitas.sistemas@gmail.com'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.recoveryUrl).toContain('resetToken=');
    expect(res.body.recipientEmail).toBe('sagacitas.sistemas@gmail.com');
  });

  it('🟢 deve solicitar redefinição de senha via POST /api/auth/request-password-reset', async () => {
    const res = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'sagacitas.sistemas@gmail.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resetUrl).toContain('resetToken=');
  });

  it('🟢 deve redefinir senha com token válido via POST /api/auth/reset-password-with-token', async () => {
    // 1. Solicita token
    const reqRes = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'sagacitas.sistemas@gmail.com' });

    const url = new URL(reqRes.body.resetUrl);
    const token = url.searchParams.get('resetToken');
    expect(token).toBeDefined();

    // 2. Executa redefinição
    const resetRes = await request(app)
      .post('/api/auth/reset-password-with-token')
      .send({ token, newPassword: 'NovaSenhaForte@2026' });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.message).toMatch(/sucesso/i);
  });

  it('🔴 deve rejeitar redefinição com senha curta (< 6 caracteres)', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password-with-token')
      .send({ token: 'qualquer-token', newPassword: '123' });

    expect(res.status).toBe(400);
  });
});
