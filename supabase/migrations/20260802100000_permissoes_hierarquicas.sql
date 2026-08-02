-- ================================================================
-- 1. DROP da tabela legada
-- ================================================================
DROP TABLE IF EXISTS perfis_permissoes CASCADE;

-- ================================================================
-- 2. TABELA: permissoes_contratante (Nível 1 — Teto Global)
-- Configurada pelo ADMIN. Uma linha por tenant.
-- ================================================================
CREATE TABLE permissoes_contratante (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         TEXT NOT NULL UNIQUE
                      REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
  -- Módulo: Empresas
  empresas_criar      BOOLEAN DEFAULT FALSE,
  empresas_ler        BOOLEAN DEFAULT FALSE,
  empresas_editar     BOOLEAN DEFAULT FALSE,
  empresas_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Projetos/EAP
  projetos_criar      BOOLEAN DEFAULT FALSE,
  projetos_ler        BOOLEAN DEFAULT FALSE,
  projetos_editar     BOOLEAN DEFAULT FALSE,
  projetos_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Medições
  medicoes_criar      BOOLEAN DEFAULT FALSE,
  medicoes_ler        BOOLEAN DEFAULT FALSE,
  medicoes_editar     BOOLEAN DEFAULT FALSE,
  medicoes_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Financeiro
  financeiro_criar    BOOLEAN DEFAULT FALSE,
  financeiro_ler      BOOLEAN DEFAULT FALSE,
  financeiro_editar   BOOLEAN DEFAULT FALSE,
  financeiro_excluir  BOOLEAN DEFAULT FALSE,
  -- Módulo: Relatórios
  relatorios_ler      BOOLEAN DEFAULT FALSE,
  -- Módulo: Usuários
  usuarios_criar      BOOLEAN DEFAULT FALSE,
  usuarios_ler        BOOLEAN DEFAULT FALSE,
  usuarios_editar     BOOLEAN DEFAULT FALSE,
  usuarios_excluir    BOOLEAN DEFAULT FALSE,
  --
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE permissoes_contratante ENABLE ROW LEVEL SECURITY;

-- Políticas (RLS)
CREATE POLICY "Permite leitura/escrita a todos logados no tenant (simplificado por enquanto)"
  ON permissoes_contratante
  FOR ALL
  USING (
    contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  );


-- ================================================================
-- 3. TABELA: permissoes_empresa (Nível 2 — Teto por Empresa)
-- Configurada pela Contratante. Uma linha por empresa.
-- ================================================================
CREATE TABLE permissoes_empresa (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         TEXT NOT NULL,
  empresa_id          TEXT NOT NULL,
  -- Módulo: Empresas
  empresas_criar      BOOLEAN DEFAULT FALSE,
  empresas_ler        BOOLEAN DEFAULT FALSE,
  empresas_editar     BOOLEAN DEFAULT FALSE,
  empresas_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Projetos/EAP
  projetos_criar      BOOLEAN DEFAULT FALSE,
  projetos_ler        BOOLEAN DEFAULT FALSE,
  projetos_editar     BOOLEAN DEFAULT FALSE,
  projetos_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Medições
  medicoes_criar      BOOLEAN DEFAULT FALSE,
  medicoes_ler        BOOLEAN DEFAULT FALSE,
  medicoes_editar     BOOLEAN DEFAULT FALSE,
  medicoes_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Financeiro
  financeiro_criar    BOOLEAN DEFAULT FALSE,
  financeiro_ler      BOOLEAN DEFAULT FALSE,
  financeiro_editar   BOOLEAN DEFAULT FALSE,
  financeiro_excluir  BOOLEAN DEFAULT FALSE,
  -- Módulo: Relatórios
  relatorios_ler      BOOLEAN DEFAULT FALSE,
  -- Módulo: Usuários
  usuarios_criar      BOOLEAN DEFAULT FALSE,
  usuarios_ler        BOOLEAN DEFAULT FALSE,
  usuarios_editar     BOOLEAN DEFAULT FALSE,
  usuarios_excluir    BOOLEAN DEFAULT FALSE,
  --
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_pe_empresa
    FOREIGN KEY (empresa_id, contrato_id)
    REFERENCES empresas_fornecedores(id, contrato_id) ON DELETE CASCADE,
  CONSTRAINT unique_permissao_empresa UNIQUE (empresa_id, contrato_id)
);

-- Habilitar RLS
ALTER TABLE permissoes_empresa ENABLE ROW LEVEL SECURITY;

-- Políticas (RLS)
CREATE POLICY "Permite acesso no tenant"
  ON permissoes_empresa
  FOR ALL
  USING (
    contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  );

-- ================================================================
-- 4. TABELA: permissoes_usuario (Nível 3 — Permissão efetiva configurada)
-- ================================================================
CREATE TABLE permissoes_usuario (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_uid         TEXT NOT NULL REFERENCES usuarios(uid) ON DELETE CASCADE,
  contrato_id         TEXT NOT NULL
                      REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
  empresa_id          TEXT, -- NULL = usuário direto da contratante
  -- Módulo: Empresas
  empresas_criar      BOOLEAN DEFAULT FALSE,
  empresas_ler        BOOLEAN DEFAULT FALSE,
  empresas_editar     BOOLEAN DEFAULT FALSE,
  empresas_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Projetos/EAP
  projetos_criar      BOOLEAN DEFAULT FALSE,
  projetos_ler        BOOLEAN DEFAULT FALSE,
  projetos_editar     BOOLEAN DEFAULT FALSE,
  projetos_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Medições
  medicoes_criar      BOOLEAN DEFAULT FALSE,
  medicoes_ler        BOOLEAN DEFAULT FALSE,
  medicoes_editar     BOOLEAN DEFAULT FALSE,
  medicoes_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Financeiro
  financeiro_criar    BOOLEAN DEFAULT FALSE,
  financeiro_ler      BOOLEAN DEFAULT FALSE,
  financeiro_editar   BOOLEAN DEFAULT FALSE,
  financeiro_excluir  BOOLEAN DEFAULT FALSE,
  -- Módulo: Relatórios
  relatorios_ler      BOOLEAN DEFAULT FALSE,
  -- Módulo: Usuários
  usuarios_criar      BOOLEAN DEFAULT FALSE,
  usuarios_ler        BOOLEAN DEFAULT FALSE,
  usuarios_editar     BOOLEAN DEFAULT FALSE,
  usuarios_excluir    BOOLEAN DEFAULT FALSE,
  --
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_permissao_usuario UNIQUE (usuario_uid, contrato_id)
);

-- Habilitar RLS
ALTER TABLE permissoes_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas (RLS)
CREATE POLICY "Permite acesso no tenant"
  ON permissoes_usuario
  FOR ALL
  USING (
    contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  );

-- ================================================================
-- 5. VIEW: Permissões efetivas (AND em toda a cadeia)
-- ================================================================
CREATE OR REPLACE VIEW v_permissoes_efetivas AS
-- Caso 1: Usuário vinculado a uma empresa (3 níveis de AND)
SELECT
  pu.usuario_uid,
  pu.contrato_id,
  pu.empresa_id,
  u.email,
  u.nome,
  u.perfil,
  (pu.empresas_criar    AND pe.empresas_criar    AND pc.empresas_criar)    AS empresas_criar,
  (pu.empresas_ler      AND pe.empresas_ler      AND pc.empresas_ler)      AS empresas_ler,
  (pu.empresas_editar   AND pe.empresas_editar   AND pc.empresas_editar)   AS empresas_editar,
  (pu.empresas_excluir  AND pe.empresas_excluir  AND pc.empresas_excluir)  AS empresas_excluir,
  (pu.projetos_criar    AND pe.projetos_criar    AND pc.projetos_criar)    AS projetos_criar,
  (pu.projetos_ler      AND pe.projetos_ler      AND pc.projetos_ler)      AS projetos_ler,
  (pu.projetos_editar   AND pe.projetos_editar   AND pc.projetos_editar)   AS projetos_editar,
  (pu.projetos_excluir  AND pe.projetos_excluir  AND pc.projetos_excluir)  AS projetos_excluir,
  (pu.medicoes_criar    AND pe.medicoes_criar    AND pc.medicoes_criar)    AS medicoes_criar,
  (pu.medicoes_ler      AND pe.medicoes_ler      AND pc.medicoes_ler)      AS medicoes_ler,
  (pu.medicoes_editar   AND pe.medicoes_editar   AND pc.medicoes_editar)   AS medicoes_editar,
  (pu.medicoes_excluir  AND pe.medicoes_excluir  AND pc.medicoes_excluir)  AS medicoes_excluir,
  (pu.financeiro_criar  AND pe.financeiro_criar  AND pc.financeiro_criar)  AS financeiro_criar,
  (pu.financeiro_ler    AND pe.financeiro_ler    AND pc.financeiro_ler)    AS financeiro_ler,
  (pu.financeiro_editar AND pe.financeiro_editar AND pc.financeiro_editar) AS financeiro_editar,
  (pu.financeiro_excluir AND pe.financeiro_excluir AND pc.financeiro_excluir) AS financeiro_excluir,
  (pu.relatorios_ler    AND pe.relatorios_ler    AND pc.relatorios_ler)    AS relatorios_ler,
  (pu.usuarios_criar    AND pe.usuarios_criar    AND pc.usuarios_criar)    AS usuarios_criar,
  (pu.usuarios_ler      AND pe.usuarios_ler      AND pc.usuarios_ler)      AS usuarios_ler,
  (pu.usuarios_editar   AND pe.usuarios_editar   AND pc.usuarios_editar)   AS usuarios_editar,
  (pu.usuarios_excluir  AND pe.usuarios_excluir  AND pc.usuarios_excluir)  AS usuarios_excluir
FROM permissoes_usuario pu
JOIN permissoes_empresa pe ON pe.empresa_id = pu.empresa_id AND pe.contrato_id = pu.contrato_id
JOIN permissoes_contratante pc ON pc.contrato_id = pu.contrato_id
JOIN usuarios u ON u.uid = pu.usuario_uid
WHERE pu.empresa_id IS NOT NULL

UNION ALL

-- Caso 2: Usuário direto da contratante (2 níveis de AND)
SELECT
  pu.usuario_uid,
  pu.contrato_id,
  pu.empresa_id,
  u.email,
  u.nome,
  u.perfil,
  (pu.empresas_criar    AND pc.empresas_criar)    AS empresas_criar,
  (pu.empresas_ler      AND pc.empresas_ler)      AS empresas_ler,
  (pu.empresas_editar   AND pc.empresas_editar)   AS empresas_editar,
  (pu.empresas_excluir  AND pc.empresas_excluir)  AS empresas_excluir,
  (pu.projetos_criar    AND pc.projetos_criar)    AS projetos_criar,
  (pu.projetos_ler      AND pc.projetos_ler)      AS projetos_ler,
  (pu.projetos_editar   AND pc.projetos_editar)   AS projetos_editar,
  (pu.projetos_excluir  AND pc.projetos_excluir)  AS projetos_excluir,
  (pu.medicoes_criar    AND pc.medicoes_criar)    AS medicoes_criar,
  (pu.medicoes_ler      AND pc.medicoes_ler)      AS medicoes_ler,
  (pu.medicoes_editar   AND pc.medicoes_editar)   AS medicoes_editar,
  (pu.medicoes_excluir  AND pc.medicoes_excluir)  AS medicoes_excluir,
  (pu.financeiro_criar  AND pc.financeiro_criar)  AS financeiro_criar,
  (pu.financeiro_ler    AND pc.financeiro_ler)    AS financeiro_ler,
  (pu.financeiro_editar AND pc.financeiro_editar) AS financeiro_editar,
  (pu.financeiro_excluir AND pc.financeiro_excluir) AS financeiro_excluir,
  (pu.relatorios_ler    AND pc.relatorios_ler)    AS relatorios_ler,
  (pu.usuarios_criar    AND pc.usuarios_criar)    AS usuarios_criar,
  (pu.usuarios_ler      AND pc.usuarios_ler)      AS usuarios_ler,
  (pu.usuarios_editar   AND pc.usuarios_editar)   AS usuarios_editar,
  (pu.usuarios_excluir  AND pc.usuarios_excluir)  AS usuarios_excluir
FROM permissoes_usuario pu
JOIN permissoes_contratante pc ON pc.contrato_id = pu.contrato_id
JOIN usuarios u ON u.uid = pu.usuario_uid
WHERE pu.empresa_id IS NULL;


-- ================================================================
-- 6. SEED DATA (Base)
-- ================================================================

-- Inserir permissões da Contratante (root, all TRUE)
INSERT INTO permissoes_contratante (
  contrato_id,
  empresas_criar, empresas_ler, empresas_editar, empresas_excluir,
  projetos_criar, projetos_ler, projetos_editar, projetos_excluir,
  medicoes_criar, medicoes_ler, medicoes_editar, medicoes_excluir,
  financeiro_criar, financeiro_ler, financeiro_editar, financeiro_excluir,
  relatorios_ler,
  usuarios_criar, usuarios_ler, usuarios_editar, usuarios_excluir
) VALUES (
  'CTR-2026-SYS',
  TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  TRUE,
  TRUE, TRUE, TRUE, TRUE
) ON CONFLICT (contrato_id) DO NOTHING;

-- Inserir permissões para a Empresa Fornecedora existente (se houver, ex: SUP-9823-STORAGE)
-- O CONFLICT requer uma restrição única explícita para ser seguro
INSERT INTO permissoes_empresa (
  contrato_id, empresa_id,
  empresas_ler, projetos_ler, medicoes_ler, financeiro_ler, relatorios_ler, usuarios_ler
) 
SELECT 'CTR-2026-SYS', id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
FROM empresas_fornecedores
WHERE contrato_id = 'CTR-2026-SYS'
ON CONFLICT (empresa_id, contrato_id) DO NOTHING;
