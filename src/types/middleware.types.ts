import { Request } from 'express';
import { FirebaseCustomClaims } from './firebase.types';

export interface DecodedFirebaseJWT {
  uid: string;
  email: string;
  contrato_id: string;
  empresa_id: string;
  entidade_id?: string;
  perfil: 'FINANCEIRO' | 'FORNECEDOR' | 'GESTOR' | 'ADMIN' | 'VISITANTE';
  mfa_verified?: boolean;
  nome?: string;
  photoURL?: string;
}

export interface AuthenticatedRequest extends Request {
  decodedToken?: DecodedFirebaseJWT;
}
