-- Adiciona a coluna empresa_id na tabela projetos
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS empresa_id TEXT;

-- Cria a restrição de chave estrangeira (empresa_id, tenant_id) -> empresas_fornecedores(id, contrato_id)
-- empresa_id pode ser nulo se o projeto for direto da gestora/contratante
ALTER TABLE public.projetos
ADD CONSTRAINT fk_projetos_empresa
FOREIGN KEY (empresa_id, tenant_id) 
REFERENCES public.empresas_fornecedores(id, contrato_id)
ON DELETE SET NULL;

-- Atualizar política de RLS para projetos
DROP POLICY IF EXISTS tenant_projetos ON public.projetos;

-- A política garante que:
-- 1. O usuário só veja projetos do mesmo contrato (tenant_id)
-- 2. Se o usuário for FORNECEDOR, ele só vê os projetos onde empresa_id = empresa_id do JWT, ou empresa_id IS NULL (projetos públicos do tenant que ele participa)
-- 3. Se for ADMIN/GESTOR/FINANCEIRO, vê todos do tenant.
CREATE POLICY tenant_projetos ON public.projetos
FOR ALL USING (
  tenant_id = current_setting('request.jwt.claims', true)::jsonb->>'contrato_id'
  AND (
    (current_setting('request.jwt.claims', true)::jsonb->>'perfil' IN ('ADMIN', 'GESTOR', 'FINANCEIRO'))
    OR 
    (
      (current_setting('request.jwt.claims', true)::jsonb->>'perfil' = 'FORNECEDOR') 
      AND 
      (
        empresa_id = current_setting('request.jwt.claims', true)::jsonb->>'empresa_id'
        OR empresa_id IS NULL
      )
    )
    OR
    (current_setting('request.jwt.claims', true)::jsonb->>'perfil' = 'VISITANTE') -- Visitante talvez não veja nada ou veja só publicos, limitando temporariamente
  )
)
WITH CHECK (
  tenant_id = current_setting('request.jwt.claims', true)::jsonb->>'contrato_id'
  AND (
    (current_setting('request.jwt.claims', true)::jsonb->>'perfil' IN ('ADMIN', 'GESTOR', 'FINANCEIRO'))
    OR 
    (
      (current_setting('request.jwt.claims', true)::jsonb->>'perfil' = 'FORNECEDOR') 
      AND 
      (
        empresa_id = current_setting('request.jwt.claims', true)::jsonb->>'empresa_id'
      )
    )
  )
);
