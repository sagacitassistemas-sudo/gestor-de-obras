-- Migração: Criação da tabela de referência de CUB (Custo Unitário Básico)

CREATE TABLE IF NOT EXISTS public.ref_cub_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id TEXT NOT NULL REFERENCES public.empresa_contratante(contrato_id) ON DELETE CASCADE,
    uf VARCHAR(2) NOT NULL,
    sinduscon_nome VARCHAR(255) NOT NULL,
    mes_referencia VARCHAR(7) NOT NULL, -- Formato 'MM/YYYY'
    dados_json JSONB NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Constraint para evitar duplicidade de base no mesmo mês por contrato (Tenant)
ALTER TABLE public.ref_cub_bases ADD CONSTRAINT ref_cub_bases_contrato_uf_mes_key UNIQUE (contrato_id, uf, mes_referencia);

-- Segurança e RLS
ALTER TABLE public.ref_cub_bases ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS padrão do Tenant
CREATE POLICY ref_cub_bases_tenant_select ON public.ref_cub_bases
    FOR SELECT
    USING (contrato_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'contrato_id')::text);

CREATE POLICY ref_cub_bases_tenant_modify ON public.ref_cub_bases
    FOR ALL
    USING (contrato_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'contrato_id')::text);
