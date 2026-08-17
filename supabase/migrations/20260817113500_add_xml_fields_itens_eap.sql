-- Adiciona colunas necessárias para a importação do MS Project XML que estavam faltando no schema
ALTER TABLE public.itens_eap
ADD COLUMN IF NOT EXISTS data_inicio DATE,
ADD COLUMN IF NOT EXISTS data_fim DATE,
ADD COLUMN IF NOT EXISTS duracao_dias INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS predecessores JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS percentual_executado_financeiro NUMERIC(5,2) DEFAULT 0.00;
