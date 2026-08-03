/**
 * tests/helpers/auth.helpers.ts
 * Funções auxiliares para gerar tokens JWT de teste.
 * Replica o mesmo formato assinado pelo backend (SUPABASE_JWT_SECRET).
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET
  || 'super-secret-jwt-token-with-at-least-32-characters-long';

export interface TestClaims {
  uid: string;
  email: string;
  contrato_id: string;
  empresa_id: string;
  perfil: 'ADMIN' | 'GESTOR' | 'FINANCEIRO' | 'FORNECEDOR' | 'VISITANTE';
  mfa_verified?: boolean;
}

/**
 * Gera um JWT de teste assinado com o mesmo segredo do backend.
 * Pode ser passado como Bearer token nas requisições Supertest.
 */
export function makeToken(claims: Partial<TestClaims> = {}): string {
  const defaults: TestClaims = {
    uid: 'test-uid-001',
    email: 'test@worksmanager.test',
    contrato_id: 'CTR-2026-SYS',
    empresa_id: 'GER-2026-SYS',
    perfil: 'VISITANTE',
    mfa_verified: true,
  };
  return jwt.sign({ ...defaults, ...claims, role: 'authenticated', sub: claims.uid || defaults.uid }, JWT_SECRET, { expiresIn: '1h' });
}

export const adminToken = () => makeToken({
  uid: 'admin-uid-001',
  email: 'sagacitas.sistemas@gmail.com',
  perfil: 'ADMIN',
  empresa_id: 'GER-2026-SYS',
});

export const gestorToken = () => makeToken({
  uid: 'gestor-uid-001',
  email: 'gestor@worksmanager.test',
  perfil: 'GESTOR',
  empresa_id: 'GER-2026-SYS',
});

export const visitanteToken = () => makeToken({
  uid: 'visitante-uid-001',
  email: 'visitante@worksmanager.test',
  perfil: 'VISITANTE',
  empresa_id: 'SEM-EMPRESA',
});

export const financeiroToken = () => makeToken({
  uid: 'financeiro-uid-001',
  email: 'fin@worksmanager.test',
  perfil: 'FINANCEIRO',
  empresa_id: 'GER-2026-SYS',
});
