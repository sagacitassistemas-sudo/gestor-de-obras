CREATE TABLE IF NOT EXISTS public.ref_bases_servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id TEXT NOT NULL REFERENCES public.empresa_contratante(contrato_id) ON DELETE CASCADE,
    orgao VARCHAR(50) NOT NULL, -- 'IOPES' ou 'DER'
    mes_ano_ref VARCHAR(20) NOT NULL, -- '02/2020'
    item VARCHAR(100), -- '010201'
    codigo_fonte VARCHAR(100), -- 'LABOR - 010201 - 1' (pode ser nulo para grupos)
    descricao TEXT NOT NULL,
    unidade VARCHAR(100),
    preco_unitario NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ref_bases_servicos_codigo_fonte ON public.ref_bases_servicos(codigo_fonte);
CREATE INDEX idx_ref_bases_servicos_orgao_mes ON public.ref_bases_servicos(orgao, mes_ano_ref);
ALTER TABLE public.ref_bases_servicos ADD CONSTRAINT ref_bases_servicos_contrato_orgao_mes_item_key UNIQUE (contrato_id, orgao, mes_ano_ref, item);
ALTER TABLE public.ref_bases_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY ref_bases_servicos_tenant_select ON public.ref_bases_servicos FOR SELECT USING (contrato_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'contrato_id')::text);
CREATE POLICY ref_bases_servicos_tenant_modify ON public.ref_bases_servicos FOR ALL USING (contrato_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'contrato_id')::text);
