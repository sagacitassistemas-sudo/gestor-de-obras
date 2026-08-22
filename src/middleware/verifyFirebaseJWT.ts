import { Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { AuthenticatedRequest } from '../types/middleware.types';
import jwt from 'jsonwebtoken';
import { logSystemError } from '../services/logger.service';

export async function verifyFirebaseJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autorização ausente ou malformado.' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();

  if (!idToken) {
    return res.status(401).json({ error: 'Token de autorização ausente ou malformado.' });
  }

  // Log for token diagnosis
  console.log(`[verifyFirebaseJWT] Received authorization token: "${idToken.substring(0, 15)}..." (Length: ${idToken.length})`);

  try {
    let decodedToken: any;
    try {
      // Decode header to check algorithm before verifying
      const headerB64 = idToken.split('.')[0];
      const headerStr = Buffer.from(headerB64, 'base64').toString('utf-8');
      const header = JSON.parse(headerStr);

      if (header.alg === 'HS256') {
        // Validação via Supabase JWT Secret
        const jwtSecret = process.env.SUPABASE_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-characters-long";
        decodedToken = jwt.verify(idToken, jwtSecret);
      } else {
        // Validação Firebase Admin SDK
        decodedToken = await getAuth().verifyIdToken(idToken);
      }
    } catch (e: any) {
      throw e; // Rethrow para ser pego pelo bloco catch externo e logado corretamente
    }
    
    req.decodedToken = {
      uid: decodedToken.uid || decodedToken.sub,
      email: decodedToken.email || '',
      contrato_id: (decodedToken.contrato_id as string) || (decodedToken.user_metadata?.contrato_id as string) || 'CTR-2026-SYS',
      empresa_id: (decodedToken.empresa_id as string) || (decodedToken.user_metadata?.empresa_id as string) || '',
      entidade_id: (decodedToken.entidade_id as string) || (decodedToken.empresa_id as string) || (decodedToken.user_metadata?.empresa_id as string) || '',
      perfil: (decodedToken.perfil as any) || (decodedToken.user_metadata?.perfil as any) || 'VISITANTE',
      mfa_verified: !!decodedToken.mfa_verified,
      nome: decodedToken.name || decodedToken.user_metadata?.full_name || decodedToken.displayName || decodedToken.email || '',
      photoURL: decodedToken.picture || decodedToken.photoURL || decodedToken.user_metadata?.avatar_url || ''
    };
    
    next();
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[middleware.verifyFirebaseJWT] Falha ao decodificar/validar token: ${errMsg}`);
    
    await logSystemError({
      cod_evento: "AUTH_FAIL_JWT",
      rota: req.originalUrl,
      mensagem: `Acesso não autorizado: ${errMsg}`,
      stack_trace: err instanceof Error ? err.stack : undefined
    });

    return res.status(401).json({ error: `Acesso não autorizado: ${errMsg}` });
  }
}
