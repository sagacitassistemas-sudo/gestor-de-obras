CREATE TABLE IF NOT EXISTS permissoes_tipo (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         TEXT NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
  perfil              TEXT NOT NULL,

  -- Módulo: Empresas
  empresas_criar      BOOLEAN DEFAULT FALSE,
  empresas_ler        BOOLEAN DEFAULT FALSE,
  empresas_editar     BOOLEAN DEFAULT FALSE,
  empresas_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Projetos/EAP
  projetos_criar      BOOLEAN DEFAULT FALSE,
  projetos_ler        BOOLEAN DEFAULT FALSE,
  projetos_editar     BOOLEAN DEFAULT FALSE,
  projetos_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Medições
  medicoes_criar      BOOLEAN DEFAULT FALSE,
  medicoes_ler        BOOLEAN DEFAULT FALSE,
  medicoes_editar     BOOLEAN DEFAULT FALSE,
  medicoes_excluir    BOOLEAN DEFAULT FALSE,
  -- Módulo: Financeiro
  financeiro_criar    BOOLEAN DEFAULT FALSE,
  financeiro_ler      BOOLEAN DEFAULT FALSE,
  financeiro_editar   BOOLEAN DEFAULT FALSE,
  financeiro_excluir  BOOLEAN DEFAULT FALSE,
  -- Módulo: Relatórios
  relatorios_ler      BOOLEAN DEFAULT FALSE,
  -- Módulo: Usuários
  usuarios_criar      BOOLEAN DEFAULT FALSE,
  usuarios_ler        BOOLEAN DEFAULT FALSE,
  usuarios_editar     BOOLEAN DEFAULT FALSE,
  usuarios_excluir    BOOLEAN DEFAULT FALSE,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_contrato_perfil_tipo UNIQUE (contrato_id, perfil)
);

ALTER TABLE permissoes_tipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permite leitura a todos logados no tenant"
  ON permissoes_tipo FOR SELECT
  USING (contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id');

-- Insert initial templates for CTR-2026-SYS
INSERT INTO permissoes_tipo (
  contrato_id, perfil, 
  empresas_ler, projetos_ler, medicoes_ler, financeiro_ler, usuarios_ler, 
  empresas_criar, projetos_criar, medicoes_criar, usuarios_criar
)
VALUES 
('CTR-2026-SYS', 'ADMIN', true, true, true, true, true, true, true, true, true),
('CTR-2026-SYS', 'GESTOR', true, true, true, true, false, false, false, false, false),
('CTR-2026-SYS', 'FINANCEIRO', true, false, true, true, false, false, false, false, false),
('CTR-2026-SYS', 'FORNECEDOR', false, false, false, false, false, false, false, false, false),
('CTR-2026-SYS', 'VISITANTE', false, false, false, false, false, false, false, false, false)
ON CONFLICT DO NOTHING;
