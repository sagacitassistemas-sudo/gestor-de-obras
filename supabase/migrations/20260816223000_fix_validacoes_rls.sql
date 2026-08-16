-- 20260816223000_fix_validacoes_rls.sql
-- Permissões e RLS para validacoes_desenvolvedor

GRANT ALL ON public.validacoes_desenvolvedor TO authenticated, anon, service_role;

ALTER TABLE public.validacoes_desenvolvedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver validacoes" ON public.validacoes_desenvolvedor;
DROP POLICY IF EXISTS "Admins podem alterar validacoes" ON public.validacoes_desenvolvedor;
DROP POLICY IF EXISTS "Admins podem inserir validacoes" ON public.validacoes_desenvolvedor;
DROP POLICY IF EXISTS "Admins podem deletar validacoes" ON public.validacoes_desenvolvedor;
DROP POLICY IF EXISTS "tenant_validacoes_desenvolvedor" ON public.validacoes_desenvolvedor;

CREATE POLICY "tenant_validacoes_desenvolvedor" ON public.validacoes_desenvolvedor FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM usuarios u 
            WHERE u.perfil = 'ADMIN'
        )
    );
