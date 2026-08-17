-- Adiciona a coluna valor_desembolsado que estava faltando na tabela de itens_eap
ALTER TABLE public.itens_eap
ADD COLUMN IF NOT EXISTS valor_desembolsado NUMERIC(15,2) DEFAULT 0.00;
