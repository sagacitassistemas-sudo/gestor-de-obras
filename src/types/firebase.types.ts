export interface FirebaseCustomClaims {
  contrato_id: string; // Tenant principal (ex: CTR-2026-SYS)
  empresa_id: string; // ID do fornecedor ou empresa (ex: SUP-9823-STORAGE)
  entidade_id?: string; // Alias legado para empresa_id
  perfil: 'FINANCEIRO' | 'FORNECEDOR' | 'GESTOR' | 'ADMIN' | 'VISITANTE'; // Perfil de acesso
  mfa_verified?: boolean; // Duplo fator verificado
  auth_provider?: string;
  onboardedAt?: string;
}

export interface FirebaseAuthSession {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  customClaims?: FirebaseCustomClaims;
  idToken: string;
  mfaVerified: boolean;
  mfaMethod?: 'EMAIL_OTP' | 'GOOGLE_2FA' | 'SMS_OTP' | string;
  lastLoginAt: string;
}

export interface FirebaseOnboardingInvite {
  id: string;
  email: string;
  contrato_id: string;
  empresa_id: string;
  entidade_id?: string;
  perfil: 'FINANCEIRO' | 'FORNECEDOR' | 'GESTOR' | 'ADMIN' | 'VISITANTE';
  inviteToken: string;
  status: 'PENDENTE' | 'ACEITO' | 'EXPIRADO';
  createdAt: string;
  invitedBy?: string;
}
