-- Adicionando os_id para tornar o dimensionamento dependente da OS
ALTER TABLE equipe_composicao_especialidades 
ADD COLUMN os_id UUID REFERENCES ordens_servico(id) ON DELETE CASCADE;

ALTER TABLE equipe_composicao_especialidades
DROP CONSTRAINT IF EXISTS equipe_especialidade_unica;

-- Como uma OS só tem uma equipe alocada na versão atual, 
-- a unicidade do dimensionamento passa a ser por OS + Especialidade.
ALTER TABLE equipe_composicao_especialidades 
ADD CONSTRAINT equipe_os_especialidade_unica UNIQUE(equipe_id, os_id, especialidade_id);
