-- ================================================================
-- Migração para adicionar novos módulos à Matriz de Acessos
-- ================================================================

-- 1. Tabela permissoes_contratante
ALTER TABLE permissoes_contratante
  ADD COLUMN IF NOT EXISTS cronogramas_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_excluir BOOLEAN DEFAULT FALSE;

-- 2. Tabela permissoes_empresa
ALTER TABLE permissoes_empresa
  ADD COLUMN IF NOT EXISTS cronogramas_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_excluir BOOLEAN DEFAULT FALSE;

-- 3. Tabela permissoes_tipo
ALTER TABLE permissoes_tipo
  ADD COLUMN IF NOT EXISTS cronogramas_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_excluir BOOLEAN DEFAULT FALSE;

-- 4. Tabela permissoes_usuario
ALTER TABLE permissoes_usuario
  ADD COLUMN IF NOT EXISTS cronogramas_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cronogramas_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rdo_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS os_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contratos_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entidades_excluir BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_criar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_ler BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_editar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS configuracoes_excluir BOOLEAN DEFAULT FALSE;

-- 5. Atualizar SEED do Tenant default (CTR-2026-SYS) para o Contratante
UPDATE permissoes_contratante
SET
  cronogramas_criar = TRUE, cronogramas_ler = TRUE, cronogramas_editar = TRUE, cronogramas_excluir = TRUE,
  rdo_criar = TRUE, rdo_ler = TRUE, rdo_editar = TRUE, rdo_excluir = TRUE,
  os_criar = TRUE, os_ler = TRUE, os_editar = TRUE, os_excluir = TRUE,
  contratos_criar = TRUE, contratos_ler = TRUE, contratos_editar = TRUE, contratos_excluir = TRUE,
  entidades_criar = TRUE, entidades_ler = TRUE, entidades_editar = TRUE, entidades_excluir = TRUE,
  configuracoes_criar = TRUE, configuracoes_ler = TRUE, configuracoes_editar = TRUE, configuracoes_excluir = TRUE
WHERE contrato_id = 'CTR-2026-SYS';

-- 6. Recriar a view v_permissoes_efetivas
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
  (pu.usuarios_excluir  AND pe.usuarios_excluir  AND pc.usuarios_excluir)  AS usuarios_excluir,

  -- Novos módulos
  (pu.cronogramas_criar AND pe.cronogramas_criar AND pc.cronogramas_criar) AS cronogramas_criar,
  (pu.cronogramas_ler   AND pe.cronogramas_ler   AND pc.cronogramas_ler)   AS cronogramas_ler,
  (pu.cronogramas_editar AND pe.cronogramas_editar AND pc.cronogramas_editar) AS cronogramas_editar,
  (pu.cronogramas_excluir AND pe.cronogramas_excluir AND pc.cronogramas_excluir) AS cronogramas_excluir,

  (pu.rdo_criar AND pe.rdo_criar AND pc.rdo_criar) AS rdo_criar,
  (pu.rdo_ler   AND pe.rdo_ler   AND pc.rdo_ler)   AS rdo_ler,
  (pu.rdo_editar AND pe.rdo_editar AND pc.rdo_editar) AS rdo_editar,
  (pu.rdo_excluir AND pe.rdo_excluir AND pc.rdo_excluir) AS rdo_excluir,

  (pu.os_criar AND pe.os_criar AND pc.os_criar) AS os_criar,
  (pu.os_ler   AND pe.os_ler   AND pc.os_ler)   AS os_ler,
  (pu.os_editar AND pe.os_editar AND pc.os_editar) AS os_editar,
  (pu.os_excluir AND pe.os_excluir AND pc.os_excluir) AS os_excluir,

  (pu.contratos_criar AND pe.contratos_criar AND pc.contratos_criar) AS contratos_criar,
  (pu.contratos_ler   AND pe.contratos_ler   AND pc.contratos_ler)   AS contratos_ler,
  (pu.contratos_editar AND pe.contratos_editar AND pc.contratos_editar) AS contratos_editar,
  (pu.contratos_excluir AND pe.contratos_excluir AND pc.contratos_excluir) AS contratos_excluir,

  (pu.entidades_criar AND pe.entidades_criar AND pc.entidades_criar) AS entidades_criar,
  (pu.entidades_ler   AND pe.entidades_ler   AND pc.entidades_ler)   AS entidades_ler,
  (pu.entidades_editar AND pe.entidades_editar AND pc.entidades_editar) AS entidades_editar,
  (pu.entidades_excluir AND pe.entidades_excluir AND pc.entidades_excluir) AS entidades_excluir,

  (pu.configuracoes_criar AND pe.configuracoes_criar AND pc.configuracoes_criar) AS configuracoes_criar,
  (pu.configuracoes_ler   AND pe.configuracoes_ler   AND pc.configuracoes_ler)   AS configuracoes_ler,
  (pu.configuracoes_editar AND pe.configuracoes_editar AND pc.configuracoes_editar) AS configuracoes_editar,
  (pu.configuracoes_excluir AND pe.configuracoes_excluir AND pc.configuracoes_excluir) AS configuracoes_excluir

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
  (pu.usuarios_excluir  AND pc.usuarios_excluir)  AS usuarios_excluir,

  -- Novos módulos
  (pu.cronogramas_criar AND pc.cronogramas_criar) AS cronogramas_criar,
  (pu.cronogramas_ler   AND pc.cronogramas_ler)   AS cronogramas_ler,
  (pu.cronogramas_editar AND pc.cronogramas_editar) AS cronogramas_editar,
  (pu.cronogramas_excluir AND pc.cronogramas_excluir) AS cronogramas_excluir,

  (pu.rdo_criar AND pc.rdo_criar) AS rdo_criar,
  (pu.rdo_ler   AND pc.rdo_ler)   AS rdo_ler,
  (pu.rdo_editar AND pc.rdo_editar) AS rdo_editar,
  (pu.rdo_excluir AND pc.rdo_excluir) AS rdo_excluir,

  (pu.os_criar AND pc.os_criar) AS os_criar,
  (pu.os_ler   AND pc.os_ler)   AS os_ler,
  (pu.os_editar AND pc.os_editar) AS os_editar,
  (pu.os_excluir AND pc.os_excluir) AS os_excluir,

  (pu.contratos_criar AND pc.contratos_criar) AS contratos_criar,
  (pu.contratos_ler   AND pc.contratos_ler)   AS contratos_ler,
  (pu.contratos_editar AND pc.contratos_editar) AS contratos_editar,
  (pu.contratos_excluir AND pc.contratos_excluir) AS contratos_excluir,

  (pu.entidades_criar AND pc.entidades_criar) AS entidades_criar,
  (pu.entidades_ler   AND pc.entidades_ler)   AS entidades_ler,
  (pu.entidades_editar AND pc.entidades_editar) AS entidades_editar,
  (pu.entidades_excluir AND pc.entidades_excluir) AS entidades_excluir,

  (pu.configuracoes_criar AND pc.configuracoes_criar) AS configuracoes_criar,
  (pu.configuracoes_ler   AND pc.configuracoes_ler)   AS configuracoes_ler,
  (pu.configuracoes_editar AND pc.configuracoes_editar) AS configuracoes_editar,
  (pu.configuracoes_excluir AND pc.configuracoes_excluir) AS configuracoes_excluir

FROM permissoes_usuario pu
JOIN permissoes_contratante pc ON pc.contrato_id = pu.contrato_id
JOIN usuarios u ON u.uid = pu.usuario_uid
WHERE pu.empresa_id IS NULL;

-- 7. Recriar Grants
GRANT SELECT ON v_permissoes_efetivas TO postgres, anon, authenticated, service_role;
