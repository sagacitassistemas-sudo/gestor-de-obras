-- 20260820180000_equipes_composicao_especialidades.sql
-- Adicionar valor da hora na especialidade e criar tabela de composição da equipe

-- 1. ADICIONAR VALOR HORA
ALTER TABLE especialidades 
ADD COLUMN IF NOT EXISTS valor_hora NUMERIC(10,2) DEFAULT 0;

-- 2. CRIAR TABELA DE COMPOSIÇÃO DE EQUIPES
CREATE TABLE IF NOT EXISTS equipe_composicao_especialidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    equipe_id UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
    especialidade_id UUID NOT NULL REFERENCES especialidades(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT equipe_especialidade_unica UNIQUE(equipe_id, especialidade_id)
);

-- 3. HABILITAR RLS E POLÍTICAS
ALTER TABLE equipe_composicao_especialidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_equipe_composicao_especialidades ON equipe_composicao_especialidades;
CREATE POLICY tenant_equipe_composicao_especialidades ON equipe_composicao_especialidades FOR ALL
    USING (tenant_id = current_setting('app.current_contrato_id', true));

-- 4. PRIVILÉGIOS
GRANT ALL ON TABLE equipe_composicao_especialidades TO postgres, anon, authenticated, service_role;

-- 5. ATUALIZAR VALORES SEMENTE
UPDATE especialidades SET valor_hora = 25.00 WHERE nome IN ('Pedreiro', 'Armador', 'Carpinteiro', 'Soldador');
UPDATE especialidades SET valor_hora = 30.00 WHERE nome IN ('Eletricista', 'Encanador');
UPDATE especialidades SET valor_hora = 45.00 WHERE nome IN ('Mestre de Obras', 'Coordenador de Campo');
UPDATE especialidades SET valor_hora = 35.00 WHERE nome IN ('Técnico de Segurança');
UPDATE especialidades SET valor_hora = 20.00 WHERE nome IN ('Pintor');
UPDATE especialidades SET valor_hora = 15.00 WHERE nome IN ('Servente');
