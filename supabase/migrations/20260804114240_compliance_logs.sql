-- ================================================================
-- 1. CATÁLOGO DE EVENTOS DO SISTEMA
-- ================================================================
CREATE TABLE sistema_eventos_catalogo (
  cod_evento    TEXT PRIMARY KEY,
  descricao     TEXT NOT NULL,
  categoria     TEXT NOT NULL -- 'ACESSO', 'CRUD', 'FALHA', 'FALHA_SYS'
);

INSERT INTO sistema_eventos_catalogo (cod_evento, descricao, categoria) VALUES
('AUTH_LOGIN', 'Login de usuário', 'ACESSO'),
('AUTH_LOGOUT', 'Logout de usuário', 'ACESSO'),
('AUTH_FAIL_JWT', 'Falha de autenticação - token JWT inválido ou ausente', 'FALHA'),
('AUTH_FAIL_BLOCKED', 'Acesso negado - usuário bloqueado', 'FALHA'),
('PERM_DENIED', 'Permissão negada', 'FALHA'),
('USR_CREATE', 'Usuário criado', 'CRUD'),
('USR_UPDATE', 'Usuário atualizado', 'CRUD'),
('USR_DELETE', 'Usuário excluído', 'CRUD'),
('USR_PERM_CHANGE', 'Permissões de usuário alteradas', 'CRUD'),
('EMP_CREATE', 'Empresa criada', 'CRUD'),
('EMP_UPDATE', 'Empresa atualizada', 'CRUD'),
('EMP_DELETE', 'Empresa excluída', 'CRUD'),
('PROJ_CREATE', 'Projeto criado', 'CRUD'),
('PROJ_UPDATE', 'Projeto atualizado', 'CRUD'),
('PROJ_DELETE', 'Projeto excluído', 'CRUD'),
('EAP_IMPORT', 'Importação de EAP via arquivo', 'CRUD'),
('CONT_CREATE', 'Contrato criado', 'CRUD'),
('CONT_UPDATE', 'Contrato atualizado', 'CRUD'),
('CONT_DELETE', 'Contrato excluído', 'CRUD'),
('MED_CREATE', 'Medição registrada', 'CRUD'),
('MED_UPDATE', 'Medição atualizada', 'CRUD'),
('MED_DELETE', 'Medição excluída', 'CRUD'),
('FIN_READ', 'Acesso ao módulo Financeiro', 'ACESSO'),
('ADMIN_ACCESS', 'Acesso ao painel administrativo', 'ACESSO'),
('SYS_DB_ERROR', 'Erro no banco de dados', 'FALHA_SYS'),
('SYS_API_ERROR', 'Erro interno na API', 'FALHA_SYS'),
('SYS_AUTH_PROVIDER_ERROR', 'Erro no provedor de autenticação', 'FALHA_SYS'),
('SYS_PERM_ENGINE_ERROR', 'Erro no motor de permissões', 'FALHA_SYS'),
('SYS_MIGRATION_ERROR', 'Erro ao executar migração', 'FALHA_SYS');

-- ================================================================
-- 2. TRILHA DE AUDITORIA (AUDIT LOG)
-- ================================================================
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   TEXT NOT NULL,
  usuario_uid   TEXT,
  usuario_email TEXT,
  cod_evento    TEXT NOT NULL REFERENCES sistema_eventos_catalogo(cod_evento) ON DELETE RESTRICT,
  descricao     TEXT,
  entidade_tipo TEXT,
  entidade_id   TEXT,
  ip_origem     TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX idx_audit_log_contrato_data ON audit_log (contrato_id, criado_em DESC);
CREATE INDEX idx_audit_log_usuario ON audit_log (usuario_uid);

-- Habilitar RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas (Apenas ADMIN lê, inserts via API server com bypass ou auth)
CREATE POLICY "Admin pode ler audit log do tenant"
  ON audit_log
  FOR SELECT
  USING (
    contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
    AND current_setting('request.jwt.claims', true)::json->>'perfil' = 'ADMIN'
  );

CREATE POLICY "Usuários autenticados podem inserir"
  ON audit_log
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- ================================================================
-- 3. REGISTRO DE FALHAS DE SISTEMA (SYSTEM ERROR LOG)
-- ================================================================
CREATE TABLE system_error_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   TEXT,
  usuario_uid   TEXT,
  cod_evento    TEXT NOT NULL REFERENCES sistema_eventos_catalogo(cod_evento) ON DELETE RESTRICT,
  rota          TEXT,
  mensagem      TEXT NOT NULL,
  stack_trace   TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE system_error_log ENABLE ROW LEVEL SECURITY;

-- Políticas (Apenas ADMIN lê do tenant, erro isolado acessível pelo sysadmin, inserts via service_role bypassing RLS)
CREATE POLICY "Admin pode ler erros do tenant"
  ON system_error_log
  FOR SELECT
  USING (
    (contrato_id IS NULL OR contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id')
    AND current_setting('request.jwt.claims', true)::json->>'perfil' = 'ADMIN'
  );

-- Insert policy is not strictly needed for service_role as it bypasses RLS, but we can add one just in case
CREATE POLICY "Service Role pode inserir erros"
  ON system_error_log
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ================================================================
-- 4. ROTINA DE PURGE (Manutenção Mensal)
-- ================================================================
-- Habilitar extensão pg_cron se suportado pelo provedor de DB
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove registros mais velhos que 1 mês, rodando 1 vez ao dia (00:00)
    PERFORM cron.schedule('purge_audit_log_daily', '0 0 * * *', 'DELETE FROM audit_log WHERE criado_em < NOW() - INTERVAL ''1 month''');
    PERFORM cron.schedule('purge_system_error_log_daily', '0 0 * * *', 'DELETE FROM system_error_log WHERE criado_em < NOW() - INTERVAL ''1 month''');
  END IF;
END $$;
