-- ============================================================================
-- Cronograma Físico-Financeiro: campos independentes de datas financeiras
-- e tabela para distribuição semanal de custos por item da EAP.
-- ============================================================================

-- 1. Adicionar campos de datas financeiras na tabela itens_eap
ALTER TABLE public.itens_eap
ADD COLUMN IF NOT EXISTS data_inicio_financeiro DATE,
ADD COLUMN IF NOT EXISTS data_fim_financeiro DATE;

COMMENT ON COLUMN public.itens_eap.data_inicio_financeiro IS 'Data de início do desembolso financeiro (pode diferir do cronograma executivo)';
COMMENT ON COLUMN public.itens_eap.data_fim_financeiro IS 'Data de fim do desembolso financeiro (pode diferir do cronograma executivo)';

-- 2. Tabela de distribuição semanal de custos
CREATE TABLE IF NOT EXISTS public.cronograma_financeiro_semanas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    item_eap_id UUID NOT NULL REFERENCES public.itens_eap(id) ON DELETE CASCADE,
    eap_codigo VARCHAR(100) NOT NULL,
    semana_inicio DATE NOT NULL,               -- Primeiro dia (segunda-feira) da semana
    semana_fim DATE NOT NULL,                  -- Último dia (domingo) da semana
    valor_planejado NUMERIC(15,2) DEFAULT 0.00,
    valor_realizado NUMERIC(15,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_semana_por_item UNIQUE (item_eap_id, semana_inicio)
);

CREATE INDEX IF NOT EXISTS idx_cfs_projeto ON public.cronograma_financeiro_semanas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_cfs_item ON public.cronograma_financeiro_semanas(item_eap_id);

-- 3. RLS
ALTER TABLE public.cronograma_financeiro_semanas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_cfs_policy" ON public.cronograma_financeiro_semanas
    FOR ALL
    USING (
        projeto_id IN (
            SELECT id FROM public.projetos
            WHERE tenant_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
        )
    );

-- 4. Grants
GRANT ALL ON public.cronograma_financeiro_semanas TO authenticated;
GRANT ALL ON public.cronograma_financeiro_semanas TO service_role;
