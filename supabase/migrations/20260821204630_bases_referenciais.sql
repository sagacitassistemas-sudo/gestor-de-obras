CREATE TABLE IF NOT EXISTS public.ref_bases_insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id TEXT NOT NULL REFERENCES public.empresa_contratante(contrato_id) ON DELETE CASCADE,
    orgao VARCHAR(50) NOT NULL, -- 'IOPES' ou 'DER'
    mes_ano_ref VARCHAR(20) NOT NULL, -- '02/2020'
    categoria VARCHAR(50) NOT NULL, -- 'Mão-de-obra', 'Material', 'Equipamento'
    codigo VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    unidade VARCHAR(20),
    preco NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permite buscar um insumo específico mais rápido
CREATE INDEX idx_ref_bases_insumos_codigo ON public.ref_bases_insumos(codigo);
CREATE INDEX idx_ref_bases_insumos_orgao_mes ON public.ref_bases_insumos(orgao, mes_ano_ref);

-- Constraint para não duplicar insumo no mesmo mês/orgao/contrato
ALTER TABLE public.ref_bases_insumos ADD CONSTRAINT ref_bases_insumos_contrato_orgao_mes_codigo_key UNIQUE (contrato_id, orgao, mes_ano_ref, codigo);

-- Segurança e RLS
ALTER TABLE public.ref_bases_insumos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS padrão do Tenant
CREATE POLICY ref_bases_insumos_tenant_select ON public.ref_bases_insumos
    FOR SELECT
    USING (contrato_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'contrato_id')::text);

CREATE POLICY ref_bases_insumos_tenant_modify ON public.ref_bases_insumos
    FOR ALL
    USING (contrato_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'contrato_id')::text);
