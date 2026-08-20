-- Migration: Adição de Campos de Valores dos Recursos na Ordem de Serviço
-- Preparação para o Módulo II (Gestão Financeira)

ALTER TABLE ordens_servico
ADD COLUMN IF NOT EXISTS valor_materiais NUMERIC(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS valor_ferramentas NUMERIC(15,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS valor_equipamentos NUMERIC(15,2) DEFAULT 0.00;
