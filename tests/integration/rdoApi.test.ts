import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import rdoRouter from '../../src/routes/rdo.routes';

// ============================================================================
// STUB DA APLICAÇÃO EXPRESS (Simula o server.ts para testes isolados da rota)
// ============================================================================
const app = express();
app.use(express.json());

// Mock de Middleware de Autenticação da Carteira de Dispositivos (MOCK)
app.use((req, res, next) => {
  const token = req.headers.authorization;
  if (token === 'Bearer TOKEN_PENDENTE') {
    return res.status(403).json({ error: 'Dispositivo pendente de aprovação na Carteira de Gestão.' });
  }
  if (token === 'Bearer TOKEN_APROVADO') {
    // Simula a claim inserida pelo middleware real
    req.body._contratoId = 'CTR-TEST-123';
    return next();
  }
  // Fallback permissivo para outros testes rodarem se não exigirem token explícito nesta fase mock
  next();
});

app.use('/api/rdo', rdoRouter);

// ============================================================================
// SUÍTE DE TESTES DE INTEGRAÇÃO (FASE RED)
// ============================================================================
describe('POST /api/rdo - Integração Mobile RDO', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Limpar o In-Memory fallback e mocks de DB entre testes (quando implementados)
  });

  describe('1. Carteira de Gestão de Dispositivos (Auth)', () => {
    it('deve retornar HTTP 403 (Forbidden) se o App Token estiver com status PENDENTE', async () => {
      const response = await request(app)
        .post('/api/rdo')
        .set('Authorization', 'Bearer TOKEN_PENDENTE')
        .send({ osId: 'OS-123', climaManha: 'BOM' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('pendente de aprovação');
    });

    it('deve prosseguir (HTTP diferente de 403/401) se o token estiver APROVADO', async () => {
      const response = await request(app)
        .post('/api/rdo')
        .set('Authorization', 'Bearer TOKEN_APROVADO')
        .send({ osId: 'OS-123', climaManha: 'BOM' });

      // Como o router está mockado com 501, esperamos 501 (ou 200/201 quando pronto)
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(401);
    });
  });

  describe('2. Idempotência por Protocolo e Datas Retroativas', () => {
    const payloadProtocolo = {
      protocoloId: 'UUID-PROTOCOLO-001',
      osId: 'OS-123',
      climaManha: 'CHUVA',
      dataRegistro: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 dias atrás
    };

    it('deve acatar RDO com data retroativa sem erros (Caminho Feliz offline)', async () => {
      const response = await request(app)
        .post('/api/rdo')
        .set('Authorization', 'Bearer TOKEN_APROVADO')
        .send(payloadProtocolo);

      // Espera 201 (Created) ou 202 (Accepted) na implementação real
      expect([201, 202]).toContain(response.status); 
    });

    it('deve ignorar envio duplicado com o mesmo protocolo_id e retornar sucesso sem duplicar dados', async () => {
      const payloadDuplicado = { ...payloadProtocolo, protocoloId: 'UUID-PROTOCOLO-DUPLICATE' };

      // Primeira chamada (Salva no BD)
      const res1 = await request(app)
        .post('/api/rdo')
        .set('Authorization', 'Bearer TOKEN_APROVADO')
        .send(payloadDuplicado);
      
      expect([201, 202]).toContain(res1.status);

      // Segunda chamada com mesmo protocoloId (Ignora inserção, retorna sucesso/Idempotência)
      const res2 = await request(app)
        .post('/api/rdo')
        .set('Authorization', 'Bearer TOKEN_APROVADO')
        .send(payloadDuplicado);
      
      expect(res2.status).toBe(200); // OK, já processado
      expect(res2.body.message).toContain('idempotent');
    });
  });

  describe('3. Mapeamento CamelCase -> SnakeCase e Resiliência (Fallback In-Memory)', () => {
    it('deve traduzir as chaves do payload (camelCase) para snake_case antes de gravar', async () => {
      // Este teste validaria o spy no cliente do Supabase
      const response = await request(app)
        .post('/api/rdo')
        .set('Authorization', 'Bearer TOKEN_APROVADO')
        .send({
          protocoloId: 'UUID-MAP-002',
          osId: 'OS-999',
          climaManha: 'BOM'
        });

      // Validaríamos que a function de insert recebeu { protocolo_id, os_id, clima_manha }
      // Para o estágio RED, vamos checar o payload espelhado na resposta de sucesso
      expect(response.status).toBe(201);
      expect(response.body.data.os_id).toBe('OS-999');
      expect(response.body.data.clima_manha).toBe('BOM');
    });

    it('deve armazenar no Fallback In-Memory e retornar HTTP 202 com { synced: false } caso o Banco falhe', async () => {
      // Simularia um mock do Supabase lançando throw Erro de Timeout
      // vi.spyOn(supabase, 'insert').mockRejectedValueOnce(new Error('Connection timeout'));

      const response = await request(app)
        .post('/api/rdo')
        .set('Authorization', 'Bearer TOKEN_APROVADO')
        .send({
          protocoloId: 'UUID-OFFLINE-003',
          osId: 'OS-101',
          climaManha: 'BOM'
        });

      // Não deve crashar com 500, deve devolver 202 Aceito para cache local
      expect(response.status).toBe(202);
      expect(response.body.synced).toBe(false);
      expect(response.body.message).toContain('offline fallback');
    });
  });
});
