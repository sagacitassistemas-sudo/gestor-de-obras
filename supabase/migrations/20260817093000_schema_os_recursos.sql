-- Migration: Adição de Recursos e Responsável de RDO na Ordem de Serviço

ALTER TABLE ordens_servico
ADD COLUMN IF NOT EXISTS materiais TEXT,
ADD COLUMN IF NOT EXISTS ferramentas TEXT,
ADD COLUMN IF NOT EXISTS equipamentos TEXT,
ADD COLUMN IF NOT EXISTS responsavel_rdo_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL;
