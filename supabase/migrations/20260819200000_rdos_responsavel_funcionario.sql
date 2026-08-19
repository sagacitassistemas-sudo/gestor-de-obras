-- 20260819200000_rdos_responsavel_funcionario.sql

-- Adiciona a coluna responsavel_rdo_id referenciando funcionarios
ALTER TABLE rdos
ADD COLUMN IF NOT EXISTS responsavel_rdo_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL;

-- Remove a restrição antiga e a coluna se não for mais utilizada
-- Não podemos dropar imediatamente sem verificar dependências, mas podemos deixá-la nula.
-- ALTER TABLE rdos DROP COLUMN IF EXISTS responsavel_id;
