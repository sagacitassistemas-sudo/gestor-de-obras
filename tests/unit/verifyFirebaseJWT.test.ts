/**
 * tests/unit/verifyFirebaseJWT.test.ts
 * Testes unitários do middleware de autenticação.
 */

import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import { verifyFirebaseJWT } from '../../src/middleware/verifyFirebaseJWT';
import { makeToken } from '../helpers/auth.helpers';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

function mockRequestResponse(authHeader?: string) {
  const req: any = { headers: authHeader ? { authorization: authHeader } : {} };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('Middleware: verifyFirebaseJWT', () => {
  describe('🔴 Casos de Rejeição (401)', () => {
    it('deve retornar 401 quando Authorization header está ausente', async () => {
      const { req, res, next } = mockRequestResponse();
      await verifyFirebaseJWT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 401 quando header não começa com "Bearer "', async () => {
      const { req, res, next } = mockRequestResponse('Basic abc123');
      await verifyFirebaseJWT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 401 quando token é vazio após "Bearer "', async () => {
      const { req, res, next } = mockRequestResponse('Bearer ');
      await verifyFirebaseJWT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 401 quando token é inválido (malformado)', async () => {
      const { req, res, next } = mockRequestResponse('Bearer isso-nao-e-um-jwt-valido');
      await verifyFirebaseJWT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 401 para JWT assinado com segredo errado', async () => {
      const token = jwt.sign({ uid: 'x', perfil: 'ADMIN' }, 'wrong-secret-totally-different-key-here');
      const { req, res, next } = mockRequestResponse(`Bearer ${token}`);
      await verifyFirebaseJWT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('🟢 Casos de Sucesso (token Supabase JWT válido)', () => {
    it('deve chamar next() com token ADMIN válido', async () => {
      const token = makeToken({ uid: 'admin-001', perfil: 'ADMIN', contrato_id: 'CTR-2026-SYS' });
      const { req, res, next } = mockRequestResponse(`Bearer ${token}`);
      await verifyFirebaseJWT(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('deve popular req.decodedToken.uid corretamente', async () => {
      const token = makeToken({ uid: 'uid-teste-123', perfil: 'GESTOR' });
      const { req, res, next } = mockRequestResponse(`Bearer ${token}`);
      await verifyFirebaseJWT(req, res, next);
      expect(req.decodedToken.uid).toBe('uid-teste-123');
    });

    it('deve popular req.decodedToken.perfil corretamente', async () => {
      const token = makeToken({ perfil: 'FINANCEIRO' });
      const { req, res, next } = mockRequestResponse(`Bearer ${token}`);
      await verifyFirebaseJWT(req, res, next);
      expect(req.decodedToken.perfil).toBe('FINANCEIRO');
    });

    it('deve popular req.decodedToken.contrato_id corretamente', async () => {
      const token = makeToken({ contrato_id: 'CTR-2026-SYS' });
      const { req, res, next } = mockRequestResponse(`Bearer ${token}`);
      await verifyFirebaseJWT(req, res, next);
      expect(req.decodedToken.contrato_id).toBe('CTR-2026-SYS');
    });

    it('deve mapear sub como uid quando uid não está presente no payload', async () => {
      // JWT com sub mas sem uid explícito
      const token = jwt.sign(
        { sub: 'sub-only-uid', role: 'authenticated', contrato_id: 'CTR-2026-SYS', perfil: 'VISITANTE' },
        JWT_SECRET
      );
      const { req, res, next } = mockRequestResponse(`Bearer ${token}`);
      await verifyFirebaseJWT(req, res, next);
      expect(req.decodedToken.uid).toBe('sub-only-uid');
    });

    it('deve marcar mfa_verified corretamente a partir da claim', async () => {
      const token = makeToken({ perfil: 'GESTOR', mfa_verified: true });
      const { req, res, next } = mockRequestResponse(`Bearer ${token}`);
      await verifyFirebaseJWT(req, res, next);
      expect(req.decodedToken.mfa_verified).toBe(true);
    });
  });
});
