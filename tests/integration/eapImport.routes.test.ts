/**
 * tests/integration/eapImport.routes.test.ts
 * Testes de integração das rotas do importador de EAP em Markdown (.md).
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { resetDb, getDb, buildSupabaseMock } from '../helpers/db.helpers';
import { adminToken } from '../helpers/auth.helpers';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => buildSupabaseMock()),
}));

let app: any;
beforeAll(async () => {
  const mod = await import('../../server.ts');
  app = mod.default;
});

describe('POST /api/eap/import/analyze', () => {
  beforeEach(() => resetDb('default'));

  it('🔴 deve retornar 401 sem token de autorização', async () => {
    const res = await request(app)
      .post('/api/eap/import/analyze')
      .send({ projeto_id: 'proj-001', md_content: '| Código | Descrição |\n|---|---|\n| 1 | Teste |' });

    expect(res.status).toBe(401);
  });

  it('🔴 deve retornar 400 se faltarem parâmetros projeto_id ou md_content', async () => {
    const res = await request(app)
      .post('/api/eap/import/analyze')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ projeto_id: 'proj-001' });

    expect(res.status).toBe(400);
  });

  it('🟢 deve analisar arquivo .md e retornar modelo interpretado na Etapa 4', async () => {
    const mdContent = `
| Código EAP | Descrição / Serviço | Unidade | Preço Unit. | Qtd Contratada |
|---|---|---|---|---|
| 1 | SERVIÇOS PRELIMINARES | | | |
| 1.1 | Canteiro de Obras | m² | 150,00 | 10 |
`;
    const res = await request(app)
      .post('/api/eap/import/analyze')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ projeto_id: 'proj-001', md_content: mdContent });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.simulation).toBeDefined();
    expect(res.body.simulation.metrics.totalItems).toBe(2);
    expect(res.body.simulation.metrics.syntheticCount).toBe(1);
    expect(res.body.simulation.metrics.analyticCount).toBe(1);
    expect(res.body.simulation.metrics.totalContractValue).toBe(1500);
  });
});

describe('POST /api/eap/import/execute', () => {
  beforeEach(() => resetDb('default'));

  it('🔴 deve retornar 401 sem token', async () => {
    const res = await request(app)
      .post('/api/eap/import/execute')
      .send({ projeto_id: 'proj-001', items: [] });

    expect(res.status).toBe(401);
  });

  it('🟢 deve executar importação final dos itens aprovados na Etapa 5 e gravar no BD', async () => {
    const itemsToImport = [
      {
        eap_codigo: '1',
        eap_pai_codigo: null,
        descricao_servico: 'SERVIÇOS PRELIMINARES',
        unidade_medida: null,
        preco_unitario: 0,
        quantidade_contratada: 0,
        valor_total_contratado: 1500,
        e_analitico: false,
        ordem: 1
      },
      {
        eap_codigo: '1.1',
        eap_pai_codigo: '1',
        descricao_servico: 'Canteiro de Obras',
        unidade_medida: 'm²',
        preco_unitario: 150,
        quantidade_contratada: 10,
        valor_total_contratado: 1500,
        e_analitico: true,
        ordem: 2
      }
    ];

    const res = await request(app)
      .post('/api/eap/import/execute')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ projeto_id: 'proj-001', items: itemsToImport });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.importedCount).toBe(2);

    // Verificação no banco de dados em memória
    const dbItems = getDb().itens_eap.filter((i: any) => i.projeto_id === 'proj-001');
    expect(dbItems.length).toBeGreaterThanOrEqual(2);
  });
});

describe('CRUD /api/itens-eap', () => {
  beforeEach(() => resetDb('default'));

  it('🟢 deve criar uma nova etapa da EAP via POST /api/itens-eap', async () => {
    const res = await request(app)
      .post('/api/itens-eap')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        projeto_id: 'proj-001',
        eap_codigo: '1.2',
        eap_pai_codigo: '1',
        descricao_servico: 'Escavação',
        unidade_medida: 'm³',
        preco_unitario: 50,
        quantidade_contratada: 20,
        e_analitico: true,
        ordem: 3
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.eap_codigo).toBe('1.2');
    expect(res.body.item.unidade_medida).toBe('m³');
  });

  it('🟢 deve listar etapas da EAP via GET /api/itens-eap', async () => {
    // Seed an item first
    getDb().itens_eap.push({
      id: 'eap-101',
      projeto_id: 'proj-001',
      eap_codigo: '1.1',
      descricao_servico: 'Limpeza',
      unidade_medida: 'm²',
      preco_unitario: 10,
      quantidade_contratada: 100,
      e_analitico: true
    });

    const res = await request(app)
      .get('/api/itens-eap?projeto_id=proj-001')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('🟢 deve atualizar o valor_desembolsado de uma etapa existente via POST /api/itens-eap', async () => {
    const item = {
      id: 'eap-101',
      projeto_id: 'proj-001',
      eap_codigo: '1.1',
      descricao_servico: 'Limpeza',
      unidade_medida: 'm²',
      preco_unitario: 10,
      quantidade_contratada: 100,
      e_analitico: true
    };
    getDb().itens_eap.push(item);

    const res = await request(app)
      .post('/api/itens-eap')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        ...item,
        valor_desembolsado: 500
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.item.valor_desembolsado).toBe(500);
  });

  it('🟢 deve excluir uma etapa da EAP via DELETE /api/itens-eap', async () => {
    getDb().itens_eap.push({
      id: 'eap-del-01',
      projeto_id: 'proj-001',
      eap_codigo: '9.9',
      descricao_servico: 'Item temporario'
    });

    const res = await request(app)
      .delete('/api/itens-eap')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ id: 'eap-del-01' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
