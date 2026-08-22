-- Adicionando campos para suportar a Orçamentação Paramétrica (Simulação)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS composicao_simulada JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS snapshot_custos JSONB;

COMMENT ON COLUMN public.ordens_servico.composicao_simulada IS 'Array de objetos contendo especialidade_id e quantidade para OS no modo de planejamento';
COMMENT ON COLUMN public.ordens_servico.snapshot_custos IS 'Snapshot imutável dos índices de custos horários aplicados no momento da simulação, para garantir estabilidade da baseline orçamentária';
