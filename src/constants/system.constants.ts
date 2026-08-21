export const SYSTEM_PARAMS = {
  // Autenticação
  JWT_SESSION_TTL: "4h" as const, // Duração da sessão do usuário logado
  JWT_MFA_TICKET_TTL: "10m" as const, // Duração do ticket de desafio MFA/2FA
  // Compliance / Retenção de Logs
  AUDIT_LOG_RETENTION_DAYS: 30, // Dias de retenção do audit_log (CRUD/eventos)
  ERROR_LOG_RETENTION_DAYS: 30, // Dias de retenção do system_error_log (falhas backend)
  // Sincronismo
  CLAIMS_SYNC_ENABLED: true, // Ativa sincronismo automático de claims no login
};
