-- ====================================================================
-- SEED.SQL - GESTOR DE OBRAS
-- Executado automaticamente após "supabase db reset" ou "supabase start"
-- Injeta dados fictícios para facilitar o desenvolvimento local
-- ====================================================================

-- 1. Inserir Empresas de Teste (Fornecedores/Subcontratadas)
INSERT INTO empresas_fornecedores (id, contrato_id, tipo, nome, cnpj_cpf, status)
VALUES 
  ('FORN-001', 'CTR-2026-SYS', 'FORNECEDOR', 'Construtora Alpha Ltda', '11111111000111', 'ATIVO'),
  ('FORN-002', 'CTR-2026-SYS', 'FORNECEDOR', 'Beta Instalações SA', '22222222000122', 'ATIVO'),
  ('FORN-003', 'CTR-2026-SYS', 'FORNECEDOR', 'Gama Engenharia', '33333333000133', 'BLOQUEADO')
ON CONFLICT (id, contrato_id) DO NOTHING;

-- 2. Inserir Usuários Fictícios de Teste
-- Como o sistema utiliza SSO (Google OAuth) e auto-registro, esses usuários 
-- de teste podem ser usados para simular visões caso você rode testes unitários 
-- ou utilize um emulador de tokens.
INSERT INTO usuarios (uid, email, nome, contrato_id, perfil, status)
VALUES 
  -- Gestor (Vinculado ao sistema/contratante)
  ('uid-gestor-mock', 'gestor@teste.com', 'Gestor de Obras (Teste)', 'CTR-2026-SYS', 'GESTOR', 'ATIVO'),
  
  -- Fornecedor (Vinculado à Construtora Alpha)
  ('uid-fornecedor-mock', 'fornecedor@teste.com', 'João Fornecedor (Teste)', 'CTR-2026-SYS', 'FORNECEDOR', 'ATIVO'),
  
  -- Visitante (Recém-cadastrado via SSO)
  ('uid-visitante-mock', 'visitante@teste.com', 'Visitante (Teste)', 'CTR-2026-SYS', 'VISITANTE', 'ATIVO'),
  
  -- Usuário Bloqueado para testar permissões
  ('uid-bloqueado-mock', 'bloqueado@teste.com', 'Usuário Bloqueado', 'CTR-2026-SYS', 'FORNECEDOR', 'BLOQUEADO')
ON CONFLICT (uid) DO NOTHING;

-- (O usuário sagacitas.sistemas@gmail.com como ADMIN já é inserido na Migration 03)
