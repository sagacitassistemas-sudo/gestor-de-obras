/**
 * tests/helpers/db.helpers.ts
 * Mock em memória do cliente Supabase.
 *
 * PADRÃO: usa um wrapper mutável `currentDb` em vez de reatribuir a variável.
 * Isso garante que o vi.mock capture a referência correta mesmo após beforeEach.
 */

import { vi } from 'vitest';

export interface DbState {
  usuarios: Record<string, any>[];
  empresas_fornecedores: Record<string, any>[];
  permissoes_tipo: Record<string, any>[];
  permissoes_usuario: Record<string, any>[];
  permissoes_empresa: Record<string, any>[];
  permissoes_contratante: Record<string, any>[];
  v_permissoes_efetivas: Record<string, any>[];
  projetos: Record<string, any>[];
  itens_eap: Record<string, any>[];
  contratos_obra: Record<string, any>[];
}

// ── Wrapper mutável global ────────────────────────────────────────────────────
// Os testes chamam resetDb() / setDb() em vez de reatribuir a variável.
// O vi.mock captura este objeto e sempre enxerga o estado atual.
let _db: DbState = createEmptyDb();

export function getDb(): DbState { return _db; }
export function setDb(db: DbState): void { Object.assign(_db, db); }
export function resetDb(preset: 'empty' | 'default' = 'default'): DbState {
  const next = preset === 'empty' ? createEmptyDb() : createDefaultDb();
  Object.assign(_db, next);
  return _db;
}

// ── Factories ────────────────────────────────────────────────────────────────
export function createEmptyDb(): DbState {
  return {
    usuarios: [],
    empresas_fornecedores: [],
    permissoes_tipo: [],
    permissoes_usuario: [],
    permissoes_empresa: [],
    permissoes_contratante: [],
    v_permissoes_efetivas: [],
    projetos: [],
    itens_eap: [],
    contratos_obra: [],
  };
}

export function createDefaultDb(): DbState {
  return {
    ...createEmptyDb(),
    usuarios: [
      {
        id: 'u-001',
        uid: 'admin-uid-001',
        email: 'sagacitas.sistemas@gmail.com',
        nome: 'Sagacitas Admin',
        contrato_id: 'CTR-2026-SYS',
        empresa_id: 'GER-2026-SYS',
        perfil: 'ADMIN',
        status: 'ATIVO',
        foto_url: '',
      },
    ],
    empresas_fornecedores: [
      {
        id: 'GER-2026-SYS',
        contrato_id: 'CTR-2026-SYS',
        nome: 'Gestora do Sistema',
        cnpj_cpf: '00.000.000/0001-00',
        tipo: 'GESTORA',
        status: 'ATIVO',
        total_faturado: 0,
      },
    ],
    permissoes_tipo: [
      {
        id: 'pt-admin',
        contrato_id: 'CTR-2026-SYS',
        perfil: 'ADMIN',
        empresas_criar: true, empresas_ler: true, empresas_editar: true, empresas_excluir: true,
        projetos_criar: true, projetos_ler: true, projetos_editar: true, projetos_excluir: true,
        medicoes_criar: true, medicoes_ler: true, medicoes_editar: true, medicoes_excluir: true,
        financeiro_criar: true, financeiro_ler: true, financeiro_editar: true, financeiro_excluir: true,
        relatorios_ler: true,
        usuarios_criar: true, usuarios_ler: true, usuarios_editar: true, usuarios_excluir: true,
      },
      {
        id: 'pt-visitante',
        contrato_id: 'CTR-2026-SYS',
        perfil: 'VISITANTE',
        empresas_criar: false, empresas_ler: true, empresas_editar: false, empresas_excluir: false,
        projetos_criar: false, projetos_ler: true, projetos_editar: false, projetos_excluir: false,
        medicoes_criar: false, medicoes_ler: true, medicoes_editar: false, medicoes_excluir: false,
        financeiro_criar: false, financeiro_ler: false, financeiro_editar: false, financeiro_excluir: false,
        relatorios_ler: false,
        usuarios_criar: false, usuarios_ler: false, usuarios_editar: false, usuarios_excluir: false,
      },
    ],
    permissoes_usuario: [],
    permissoes_empresa: [],
    permissoes_contratante: [],
    v_permissoes_efetivas: [],
    projetos: [],
    itens_eap: [],
    contratos_obra: [],
  };
}

// ── Builder do mock Supabase ─────────────────────────────────────────────────
// Usa _db diretamente (referência global) para garantir acesso ao estado atual.

function getTable(name: string): Record<string, any>[] {
  const table = (_db as any)[name];
  if (!Array.isArray(table)) (_db as any)[name] = [];
  return (_db as any)[name];
}

function buildQuery(tableName: string) {
  let filters: Array<{ key: string; value: any }> = [];

  const applyFilters = () =>
    getTable(tableName).filter(r => filters.every(f => r[f.key] === f.value));

  const q = {
    _filters: filters,

    // Thenable correto: chama resolve com o resultado quando await-ado
    then(resolve: Function, reject?: Function) {
      try {
        const results = applyFilters();
        return Promise.resolve().then(() => resolve({ data: results, error: null }));
      } catch (e) {
        return reject ? Promise.resolve().then(() => reject(e)) : Promise.reject(e);
      }
    },

    select(cols?: string, opts?: any) {
      if (opts?.count === 'exact') {
        const results = applyFilters();
        return Promise.resolve({ count: results.length, error: null });
      }
      return q; // chainable
    },

    eq(key: string, value: any) {
      filters.push({ key, value });
      return q; // chainable
    },

    single() {
      const results = applyFilters();
      if (!results[0]) return Promise.resolve({ data: null, error: { message: 'Not found', code: 'PGRST116' } });
      return Promise.resolve({ data: results[0], error: null });
    },

    maybeSingle() {
      const results = applyFilters();
      return Promise.resolve({ data: results[0] ?? null, error: null });
    },

    insert(payload: any | any[]) {
      const table = getTable(tableName);
      const items = Array.isArray(payload) ? payload : [payload];
      const inserted = items.map(item => ({ id: `gen-${Date.now()}-${Math.random()}`, ...item }));
      table.push(...inserted);
      return {
        select: () => ({ single: () => Promise.resolve({ data: inserted[0], error: null }) }),
        then: (resolve: Function) => Promise.resolve().then(() => resolve({ data: inserted[0], error: null })),
        error: null,
        data: inserted[0],
      };
    },

    upsert(payload: any | any[], _opts?: any) {
      const table = getTable(tableName);
      const items = Array.isArray(payload) ? payload : [payload];
      let last: any;
      items.forEach(item => {
        const idx = table.findIndex(r =>
          (item.uid && r.uid === item.uid) ||
          (item.id && r.id === item.id) ||
          (item.eap_codigo && r.eap_codigo === item.eap_codigo && r.projeto_id === item.projeto_id)
        );
        if (idx >= 0) { table[idx] = { ...table[idx], ...item }; last = table[idx]; }
        else { last = { id: item.id || `gen-${Date.now()}-${Math.random()}`, ...item }; table.push(last); }
      });
      return {
        select: () => ({ single: () => Promise.resolve({ data: last, error: null }) }),
        then: (resolve: Function) => Promise.resolve().then(() => resolve({ data: last, error: null })),
      };
    },

    update(payload: any) {
      return {
        eq: (key: string, value: any) => {
          const table = getTable(tableName);
          const idx = table.findIndex(r => r[key] === value);
          if (idx >= 0) table[idx] = { ...table[idx], ...payload };
          return {
            select: () => ({ single: () => Promise.resolve({ data: table[idx], error: null }) }),
            then: (resolve: Function) => Promise.resolve().then(() => resolve({ data: table[idx], error: null })),
          };
        },
      };
    },

    delete() {
      return {
        eq: (key: string, value: any) => {
          const table = getTable(tableName);
          const idx = table.findIndex(r => r[key] === value);
          if (idx >= 0) table.splice(idx, 1);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return q;
}

export function buildSupabaseMock() {
  return {
    from: vi.fn((tableName: string) => buildQuery(tableName)),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  };
}
