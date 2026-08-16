import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { resetDb, getDb, buildSupabaseMock } from '../helpers/db.helpers';
import { adminToken, visitanteToken } from '../helpers/auth.helpers';

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

describe('Validações Desenvolvedor API', () => {
  let pendingId: string;

  beforeEach(() => {
    resetDb('default');
    // Ensure the table exists in mock DB
    const db = getDb();
    db.validacoes_desenvolvedor = [];
  });

  it('deve retornar 401 sem token', async () => {
    const res = await request(app).get('/api/validacoes');
    expect(res.status).toBe(401);
  });

  it('deve retornar 403 se usuario nao for ADMIN (GET)', async () => {
    const res = await request(app)
      .get('/api/validacoes')
      .set('Authorization', `Bearer ${visitanteToken()}`);
    
    expect(res.status).toBe(403);
  });

  it('deve criar uma nova validacao (POST) se for ADMIN', async () => {
    const res = await request(app)
      .post('/api/validacoes')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        titulo: 'Teste Validação API',
        descricao: 'Verificar se o envio de e-mail funciona',
        agente: 'TestBot'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.validacao.titulo).toBe('Teste Validação API');
    
    pendingId = res.body.validacao.id;
  });

  it('deve atualizar o status para VALIDADO', async () => {
    // Insere mock na mao primeiro
    const db = getDb();
    const mockId = 'mock-id-123';
    db.validacoes_desenvolvedor = [{
      id: mockId,
      titulo: 'Validacao Pendente',
      status: 'PENDENTE',
      agente: 'Bot'
    }];

    const res = await request(app)
      .put(`/api/validacoes/${mockId}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        status: 'VALIDADO',
        notas_validacao: 'Tudo OK'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.validacao.status).toBe('VALIDADO');
    expect(res.body.validacao.notas_validacao).toBe('Tudo OK');
  });
});
