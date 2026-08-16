-- 20260816200000_standardize_tenant_rls.sql
-- Padronização de RLS (Row Level Security) e Isolamento Tenant Zero-Trust
-- Garante que todas as tabelas listem e mantenham os dados persistidos por tenant

-- 1. empresa_contratante
ALTER TABLE empresa_contratante ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_contratante ON empresa_contratante;
CREATE POLICY tenant_contratante ON empresa_contratante FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        contrato_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 2. empresas_fornecedores
ALTER TABLE empresas_fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_fornecedores ON empresas_fornecedores;
DROP POLICY IF EXISTS fornecedores_select ON empresas_fornecedores;
DROP POLICY IF EXISTS fornecedores_modify ON empresas_fornecedores;
CREATE POLICY tenant_fornecedores ON empresas_fornecedores FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        contrato_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 3. usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_usuarios ON usuarios;
CREATE POLICY tenant_usuarios ON usuarios FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        contrato_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 4. projetos
ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_projetos ON projetos;
CREATE POLICY tenant_projetos ON projetos FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 5. ordens_servico
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for ordens_servico" ON ordens_servico;
DROP POLICY IF EXISTS tenant_ordens_servico ON ordens_servico;
CREATE POLICY tenant_ordens_servico ON ordens_servico FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 6. rdos
ALTER TABLE rdos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for rdos" ON rdos;
DROP POLICY IF EXISTS tenant_rdos ON rdos;
CREATE POLICY tenant_rdos ON rdos FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 7. especialidades
ALTER TABLE especialidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_especialidades ON especialidades;
CREATE POLICY tenant_especialidades ON especialidades FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 8. funcionarios
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_funcionarios ON funcionarios;
CREATE POLICY tenant_funcionarios ON funcionarios FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 9. equipes
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_equipes ON equipes;
CREATE POLICY tenant_equipes ON equipes FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- 10. equipe_membros
ALTER TABLE equipe_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_equipe_membros ON equipe_membros;
CREATE POLICY tenant_equipe_membros ON equipe_membros FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM equipes e 
            WHERE e.id = equipe_membros.equipe_id 
            AND e.tenant_id = COALESCE(
                NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
                NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
                'CTR-2026-SYS'
            )
        )
    );
