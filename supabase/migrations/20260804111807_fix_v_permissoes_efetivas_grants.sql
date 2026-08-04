-- 1. Modificar a view v_permissoes_efetivas para garantir que o caso "direto da contratante" aplique para empresa_id nulos e pseudocódigos
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
WHERE pu.empresa_id IS NOT NULL AND pu.empresa_id NOT IN ('SEM-EMPRESA', 'GER-2026-SYS')

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
WHERE pu.empresa_id IS NULL OR pu.empresa_id IN ('SEM-EMPRESA', 'GER-2026-SYS');

-- 2. Conceder permissões para a VIEW e TABELAS relativas às hierarquias de permissão

GRANT SELECT ON v_permissoes_efetivas TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE permissoes_usuario TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE permissoes_empresa TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE permissoes_contratante TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE permissoes_tipo TO postgres, anon, authenticated, service_role;

-- 3. Correção de dados existentes onde empresa_id não existe
UPDATE permissoes_usuario SET empresa_id = NULL WHERE empresa_id IN ('SEM-EMPRESA', 'GER-2026-SYS');
UPDATE usuarios SET empresa_id = NULL WHERE empresa_id IN ('SEM-EMPRESA', 'GER-2026-SYS');
