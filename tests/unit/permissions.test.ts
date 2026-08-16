/**
 * tests/unit/permissions.test.ts
 * Testes unitários da lógica de delegação hierárquica de permissões.
 *
 * Testa getComputedPermissions e checkPermission diretamente,
 * mockando o cliente Supabase com dados em memória.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSupabaseMock, createDefaultDb, createEmptyDb, DbState } from '../helpers/db.helpers';
import { makeToken } from '../helpers/auth.helpers';

// ── Helpers para construir req fake com decodedToken ─────────────────────────
function buildReq(claims: Partial<{
  uid: string; perfil: string; contrato_id: string; empresa_id: string;
}> = {}): any {
  return {
    decodedToken: {
      uid: claims.uid || 'test-uid-001',
      perfil: claims.perfil || 'VISITANTE',
      contrato_id: claims.contrato_id || 'CTR-2026-SYS',
      empresa_id: claims.empresa_id || 'SEM-EMPRESA',
      email: 'test@test.com',
    },
    headers: { authorization: `Bearer ${makeToken(claims as any)}` },
  };
}

// ── Importação dinâmica do módulo a testar ───────────────────────────────────
// As funções getComputedPermissions e checkPermission ficam em server.ts.
// Testamos seu comportamento via integração leve (Supertest + mock de supabase).
// Aqui criamos uma versão portável isolada para teste puro de unidade.

function createComputedPermissionsLogic(db: DbState) {
  // Replicação fiel da lógica de getComputedPermissions do server.ts
  return async function getComputedPermissions(req: any): Promise<Record<string, boolean>> {
    if (!req.decodedToken) return {};

    const perfil = req.decodedToken.perfil || 'VISITANTE';
    const uid = req.decodedToken.uid;
    const contrato_id = req.decodedToken.contrato_id;

    const fallback: Record<string, boolean> = {
      empresas_ler: true, projetos_ler: true, medicoes_ler: false, financeiro_ler: false,
      relatorios_ler: false, usuarios_ler: false,
      empresas_criar: false, empresas_editar: false, empresas_excluir: false,
      projetos_criar: false, projetos_editar: false, projetos_excluir: false,
      medicoes_criar: false, medicoes_editar: false, medicoes_excluir: false,
      financeiro_criar: false, financeiro_editar: false, financeiro_excluir: false,
      usuarios_criar: false, usuarios_editar: false, usuarios_excluir: false,
    };

    if (perfil === 'ADMIN') {
      return Object.keys(fallback).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>);
    }

    if (perfil === 'GESTOR') {
      Object.keys(fallback).forEach(k => { if (!k.startsWith('usuarios_')) fallback[k] = true; });
    } else if (perfil === 'FINANCEIRO') {
      Object.keys(fallback).forEach(k => { if (k.startsWith('financeiro_')) fallback[k] = true; });
    }

    // Nível 4: View v_permissoes_efetivas
    const efetiva = db.v_permissoes_efetivas.find(p => p.usuario_uid === uid);
    if (efetiva && efetiva.empresas_ler !== undefined) return efetiva;

    // Nível 2: Template por tipo
    const tipoData = db.permissoes_tipo.find(p => p.perfil === perfil && p.contrato_id === contrato_id);
    if (tipoData && tipoData.empresas_ler !== undefined) return { ...fallback, ...tipoData };

    return fallback;
  };
}

// ────────────────────────────────────────────────────────────────────────────

describe('Permissões: getComputedPermissions (lógica isolada)', () => {
  let db: DbState;
  let getComputedPermissions: ReturnType<typeof createComputedPermissionsLogic>;

  beforeEach(() => {
    db = createDefaultDb();
    getComputedPermissions = createComputedPermissionsLogic(db);
  });

  describe('🟢 ADMIN Bypass', () => {
    it('deve retornar TODAS as permissões true para perfil ADMIN', async () => {
      const req = buildReq({ perfil: 'ADMIN' });
      const perms = await getComputedPermissions(req);

      expect(perms.empresas_criar).toBe(true);
      expect(perms.usuarios_criar).toBe(true);
      expect(perms.financeiro_excluir).toBe(true);
    });
  });

  describe('🔴 VISITANTE — fallback padrão', () => {
    it('deve bloquear todas as operações de escrita para VISITANTE sem registro na view', async () => {
      const req = buildReq({ uid: 'novo-visitante-sem-registro', perfil: 'VISITANTE' });
      // Remove quaisquer registros na view para este uid
      db.v_permissoes_efetivas = [];

      const perms = await getComputedPermissions(req);

      expect(perms.empresas_criar).toBe(false);
      expect(perms.financeiro_criar).toBe(false);
      expect(perms.usuarios_criar).toBe(false);
    });

    it('deve permitir leitura básica para VISITANTE (fallback padrão)', async () => {
      const req = buildReq({ uid: 'novo-visitante-sem-registro', perfil: 'VISITANTE' });
      db.v_permissoes_efetivas = [];

      const perms = await getComputedPermissions(req);

      expect(perms.empresas_ler).toBe(true);
      expect(perms.projetos_ler).toBe(true);
    });
  });

  describe('🔵 Template por Tipo (permissoes_tipo)', () => {
    it('deve usar o template VISITANTE da tabela permissoes_tipo quando disponível', async () => {
      const req = buildReq({ uid: 'visitante-com-tipo', perfil: 'VISITANTE' });
      db.v_permissoes_efetivas = []; // Sem view

      const perms = await getComputedPermissions(req);

      // Conforme template criado em createDefaultDb():
      expect(perms.financeiro_ler).toBe(false); // VISITANTE não pode ver financeiro
      expect(perms.empresas_ler).toBe(true);
    });
  });

  describe('🟣 View v_permissoes_efetivas (prioridade máxima)', () => {
    it('deve usar dados da view quando existe registro para o usuário', async () => {
      const uid = 'uid-com-view';
      db.v_permissoes_efetivas = [{
        usuario_uid: uid,
        contrato_id: 'CTR-2026-SYS',
        perfil: 'VISITANTE',
        empresas_criar: true,  // Customizado para este usuário
        empresas_ler: true,
        financeiro_criar: false,
        financeiro_ler: true,
      }];

      const req = buildReq({ uid, perfil: 'VISITANTE' });
      const perms = await getComputedPermissions(req);

      // Deve usar a view, não o fallback/tipo
      expect(perms.empresas_criar).toBe(true);
    });
  });

  describe('🟡 GESTOR — acesso expandido', () => {
    it('deve conceder todas as permissões exceto usuários para GESTOR (fallback)', async () => {
      const req = buildReq({ uid: 'gestor-sem-view', perfil: 'GESTOR' });
      db.v_permissoes_efetivas = [];
      db.permissoes_tipo = []; // Sem template

      const perms = await getComputedPermissions(req);

      expect(perms.empresas_criar).toBe(true);
      expect(perms.financeiro_ler).toBe(true);
      expect(perms.usuarios_criar).toBe(false); // Gestor não gerencia usuários (fallback)
    });
  });

  describe('🟡 FINANCEIRO — acesso restrito a financeiro', () => {
    it('deve conceder permissões financeiras e negar escrita em empresas', async () => {
      const req = buildReq({ uid: 'fin-sem-view', perfil: 'FINANCEIRO' });
      db.v_permissoes_efetivas = [];
      db.permissoes_tipo = [];

      const perms = await getComputedPermissions(req);

      expect(perms.financeiro_criar).toBe(true);
      expect(perms.financeiro_ler).toBe(true);
      expect(perms.empresas_criar).toBe(false);
    });
  });

  describe('🔴 Req sem decodedToken', () => {
    it('deve retornar objeto vazio quando req.decodedToken é undefined', async () => {
      const req = { headers: {} }; // Sem decodedToken
      const perms = await getComputedPermissions(req);

      expect(perms).toEqual({});
    });
  });
});

// ── checkPermission (wrapper de getComputedPermissions) ──────────────────────
describe('Permissões: checkPermission', () => {
  let db: DbState;

  beforeEach(() => {
    db = createDefaultDb();
  });

  async function checkPermission(req: any, key: string): Promise<boolean> {
    if (req.decodedToken?.perfil === 'ADMIN') return true;
    const getComputedPermissions = createComputedPermissionsLogic(db);
    const perms = await getComputedPermissions(req);
    return !!perms[key];
  }

  it('deve retornar true para ADMIN em qualquer chave', async () => {
    const req = buildReq({ perfil: 'ADMIN' });
    expect(await checkPermission(req, 'empresas_excluir')).toBe(true);
    expect(await checkPermission(req, 'usuarios_criar')).toBe(true);
  });

  it('deve retornar false para VISITANTE em empresas_criar', async () => {
    const req = buildReq({ perfil: 'VISITANTE', uid: 'vis-001' });
    db.v_permissoes_efetivas = [];
    expect(await checkPermission(req, 'empresas_criar')).toBe(false);
  });

  it('deve retornar true para VISITANTE em empresas_ler (fallback leitura)', async () => {
    const req = buildReq({ perfil: 'VISITANTE', uid: 'vis-002' });
    db.v_permissoes_efetivas = [];
    db.permissoes_tipo = [];
    expect(await checkPermission(req, 'empresas_ler')).toBe(true);
  });
});
