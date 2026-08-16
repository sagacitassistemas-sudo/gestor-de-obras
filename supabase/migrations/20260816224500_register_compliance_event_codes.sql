-- 20260816224500_register_compliance_event_codes.sql
-- Registra novos códigos de evento no catálogo para evitar erros de FK em audit_log e system_error_log

INSERT INTO sistema_eventos_catalogo (cod_evento, descricao, categoria) VALUES
('USR_INVITE', 'Convite de usuário gerado e enviado por e-mail', 'CRUD'),
('COMPLIANCE_EMAIL_INVITE', 'Envio de convite de e-mail registrado para auditoria de compliance', 'CRUD'),
('CLAIMS_SYNC_FAIL', 'Falha na sincronização de claims do usuário', 'FALHA_SYS'),
('TENANT_CHECK_FAIL', 'Falha na verificação de integridade do tenant', 'FALHA_SYS'),
('TENANT_CHECK_SUCCESS', 'Verificação de integridade do tenant realizada com sucesso', 'ACESSO'),
('TENANT_CHECK_EXCEPTION', 'Exceção na checagem de isolamento por tenant', 'FALHA_SYS'),
('GESTORA_ACCESS_CONFIRMATION', 'Certificado de confirmação de acesso da gestora', 'ACESSO')
ON CONFLICT (cod_evento) DO NOTHING;
