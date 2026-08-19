-- ===================================================================
-- GESTOR DE OBRAS - Migration
-- 20260818000000_add_detalhes_empresas.sql
-- Adiciona suporte a cadastro estendido de Fornecedores via JSONB
-- ===================================================================

ALTER TABLE empresas_fornecedores
ADD COLUMN IF NOT EXISTS detalhes JSONB DEFAULT '{}'::jsonb;

-- Índices GIN em JSONB são úteis se eventualmente precisarmos pesquisar dentro do JSON (Ex: por cidade)
CREATE INDEX IF NOT EXISTS idx_empresas_fornecedores_detalhes ON empresas_fornecedores USING GIN (detalhes);
