-- Adicionar coluna de Mão de Obra na OS
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS valor_mao_obra NUMERIC(15,2) DEFAULT 0;

-- Adicionar valor hora projetado para ajustar os custos no dimensionamento específico da equipe
ALTER TABLE equipe_composicao_especialidades ADD COLUMN IF NOT EXISTS valor_hora_projetado NUMERIC(10,2) DEFAULT 0;
