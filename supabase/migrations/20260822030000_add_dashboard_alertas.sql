-- Add columns to permissoes_contratante
ALTER TABLE public.permissoes_contratante 
ADD COLUMN dashboard_ler BOOLEAN DEFAULT false,
ADD COLUMN alertas_ler BOOLEAN DEFAULT false;

-- Add columns to permissoes_empresa
ALTER TABLE public.permissoes_empresa 
ADD COLUMN dashboard_ler BOOLEAN DEFAULT false,
ADD COLUMN alertas_ler BOOLEAN DEFAULT false;

-- Add columns to permissoes_tipo
ALTER TABLE public.permissoes_tipo 
ADD COLUMN dashboard_ler BOOLEAN DEFAULT false,
ADD COLUMN alertas_ler BOOLEAN DEFAULT false;

-- Add columns to permissoes_usuario
ALTER TABLE public.permissoes_usuario 
ADD COLUMN dashboard_ler BOOLEAN DEFAULT false,
ADD COLUMN alertas_ler BOOLEAN DEFAULT false;

-- Drop and recreate the view to include the new columns
DROP VIEW IF EXISTS public.v_permissoes_efetivas;

CREATE VIEW public.v_permissoes_efetivas AS
SELECT 
    u.uid AS usuario_uid,
    u.contrato_id,
    u.empresa_id,
    u.email,
    u.nome,
    u.perfil,
    -- GERAL
    COALESCE(pu.dashboard_ler, pt.dashboard_ler, false) AND pe.dashboard_ler AND pc.dashboard_ler AS dashboard_ler,
    COALESCE(pu.alertas_ler, pt.alertas_ler, false) AND pe.alertas_ler AND pc.alertas_ler AS alertas_ler,
    -- EMPRESAS
    COALESCE(pu.empresas_criar, pt.empresas_criar, false) AND pe.empresas_criar AND pc.empresas_criar AS empresas_criar,
    COALESCE(pu.empresas_ler, pt.empresas_ler, false) AND pe.empresas_ler AND pc.empresas_ler AS empresas_ler,
    COALESCE(pu.empresas_editar, pt.empresas_editar, false) AND pe.empresas_editar AND pc.empresas_editar AS empresas_editar,
    COALESCE(pu.empresas_excluir, pt.empresas_excluir, false) AND pe.empresas_excluir AND pc.empresas_excluir AS empresas_excluir,
    -- PROJETOS
    COALESCE(pu.projetos_criar, pt.projetos_criar, false) AND pe.projetos_criar AND pc.projetos_criar AS projetos_criar,
    COALESCE(pu.projetos_ler, pt.projetos_ler, false) AND pe.projetos_ler AND pc.projetos_ler AS projetos_ler,
    COALESCE(pu.projetos_editar, pt.projetos_editar, false) AND pe.projetos_editar AND pc.projetos_editar AS projetos_editar,
    COALESCE(pu.projetos_excluir, pt.projetos_excluir, false) AND pe.projetos_excluir AND pc.projetos_excluir AS projetos_excluir,
    -- MEDIÇÕES
    COALESCE(pu.medicoes_criar, pt.medicoes_criar, false) AND pe.medicoes_criar AND pc.medicoes_criar AS medicoes_criar,
    COALESCE(pu.medicoes_ler, pt.medicoes_ler, false) AND pe.medicoes_ler AND pc.medicoes_ler AS medicoes_ler,
    COALESCE(pu.medicoes_editar, pt.medicoes_editar, false) AND pe.medicoes_editar AND pc.medicoes_editar AS medicoes_editar,
    COALESCE(pu.medicoes_excluir, pt.medicoes_excluir, false) AND pe.medicoes_excluir AND pc.medicoes_excluir AS medicoes_excluir,
    -- FINANCEIRO
    COALESCE(pu.financeiro_criar, pt.financeiro_criar, false) AND pe.financeiro_criar AND pc.financeiro_criar AS financeiro_criar,
    COALESCE(pu.financeiro_ler, pt.financeiro_ler, false) AND pe.financeiro_ler AND pc.financeiro_ler AS financeiro_ler,
    COALESCE(pu.financeiro_editar, pt.financeiro_editar, false) AND pe.financeiro_editar AND pc.financeiro_editar AS financeiro_editar,
    COALESCE(pu.financeiro_excluir, pt.financeiro_excluir, false) AND pe.financeiro_excluir AND pc.financeiro_excluir AS financeiro_excluir,
    -- RELATÓRIOS
    COALESCE(pu.relatorios_ler, pt.relatorios_ler, false) AND pe.relatorios_ler AND pc.relatorios_ler AS relatorios_ler,
    -- USUÁRIOS
    COALESCE(pu.usuarios_criar, pt.usuarios_criar, false) AND pe.usuarios_criar AND pc.usuarios_criar AS usuarios_criar,
    COALESCE(pu.usuarios_ler, pt.usuarios_ler, false) AND pe.usuarios_ler AND pc.usuarios_ler AS usuarios_ler,
    COALESCE(pu.usuarios_editar, pt.usuarios_editar, false) AND pe.usuarios_editar AND pc.usuarios_editar AS usuarios_editar,
    COALESCE(pu.usuarios_excluir, pt.usuarios_excluir, false) AND pe.usuarios_excluir AND pc.usuarios_excluir AS usuarios_excluir,
    -- CRONOGRAMAS
    COALESCE(pu.cronogramas_criar, pt.cronogramas_criar, false) AND pe.cronogramas_criar AND pc.cronogramas_criar AS cronogramas_criar,
    COALESCE(pu.cronogramas_ler, pt.cronogramas_ler, false) AND pe.cronogramas_ler AND pc.cronogramas_ler AS cronogramas_ler,
    COALESCE(pu.cronogramas_editar, pt.cronogramas_editar, false) AND pe.cronogramas_editar AND pc.cronogramas_editar AS cronogramas_editar,
    COALESCE(pu.cronogramas_excluir, pt.cronogramas_excluir, false) AND pe.cronogramas_excluir AND pc.cronogramas_excluir AS cronogramas_excluir,
    -- RDO
    COALESCE(pu.rdo_criar, pt.rdo_criar, false) AND pe.rdo_criar AND pc.rdo_criar AS rdo_criar,
    COALESCE(pu.rdo_ler, pt.rdo_ler, false) AND pe.rdo_ler AND pc.rdo_ler AS rdo_ler,
    COALESCE(pu.rdo_editar, pt.rdo_editar, false) AND pe.rdo_editar AND pc.rdo_editar AS rdo_editar,
    COALESCE(pu.rdo_excluir, pt.rdo_excluir, false) AND pe.rdo_excluir AND pc.rdo_excluir AS rdo_excluir,
    -- OS
    COALESCE(pu.os_criar, pt.os_criar, false) AND pe.os_criar AND pc.os_criar AS os_criar,
    COALESCE(pu.os_ler, pt.os_ler, false) AND pe.os_ler AND pc.os_ler AS os_ler,
    COALESCE(pu.os_editar, pt.os_editar, false) AND pe.os_editar AND pc.os_editar AS os_editar,
    COALESCE(pu.os_excluir, pt.os_excluir, false) AND pe.os_excluir AND pc.os_excluir AS os_excluir,
    -- CONTRATOS OBRAS (contratos_criar)
    COALESCE(pu.contratos_criar, pt.contratos_criar, false) AND pe.contratos_criar AND pc.contratos_criar AS contratos_criar,
    COALESCE(pu.contratos_ler, pt.contratos_ler, false) AND pe.contratos_ler AND pc.contratos_ler AS contratos_ler,
    COALESCE(pu.contratos_editar, pt.contratos_editar, false) AND pe.contratos_editar AND pc.contratos_editar AS contratos_editar,
    COALESCE(pu.contratos_excluir, pt.contratos_excluir, false) AND pe.contratos_excluir AND pc.contratos_excluir AS contratos_excluir,
    -- ENTIDADES (funcionarios, equipamentos, etc)
    COALESCE(pu.entidades_criar, pt.entidades_criar, false) AND pe.entidades_criar AND pc.entidades_criar AS entidades_criar,
    COALESCE(pu.entidades_ler, pt.entidades_ler, false) AND pe.entidades_ler AND pc.entidades_ler AS entidades_ler,
    COALESCE(pu.entidades_editar, pt.entidades_editar, false) AND pe.entidades_editar AND pc.entidades_editar AS entidades_editar,
    COALESCE(pu.entidades_excluir, pt.entidades_excluir, false) AND pe.entidades_excluir AND pc.entidades_excluir AS entidades_excluir,
    -- CONFIGURAÇÕES (Tenant settings)
    COALESCE(pu.configuracoes_criar, pt.configuracoes_criar, false) AND pe.configuracoes_criar AND pc.configuracoes_criar AS configuracoes_criar,
    COALESCE(pu.configuracoes_ler, pt.configuracoes_ler, false) AND pe.configuracoes_ler AND pc.configuracoes_ler AS configuracoes_ler,
    COALESCE(pu.configuracoes_editar, pt.configuracoes_editar, false) AND pe.configuracoes_editar AND pc.configuracoes_editar AS configuracoes_editar,
    COALESCE(pu.configuracoes_excluir, pt.configuracoes_excluir, false) AND pe.configuracoes_excluir AND pc.configuracoes_excluir AS configuracoes_excluir

FROM 
    public.usuarios u
-- Junta permissões configuradas por usuário (O Teto do Usuário)
LEFT JOIN 
    public.permissoes_usuario pu ON u.uid = pu.usuario_uid
-- Junta permissões configuradas por tipo/cargo (Fallback)
LEFT JOIN 
    public.permissoes_tipo pt ON u.perfil = pt.perfil AND u.contrato_id = pt.contrato_id
-- Junta permissões da empresa (O Teto da Fornecedora)
LEFT JOIN 
    public.permissoes_empresa pe ON (
      u.empresa_id = pe.empresa_id OR 
      (u.empresa_id IS NULL AND u.contrato_id = pe.contrato_id)
    )
-- Junta permissões da contratante (O Teto Global do Tenant)
LEFT JOIN 
    public.permissoes_contratante pc ON u.contrato_id = pc.contrato_id;
