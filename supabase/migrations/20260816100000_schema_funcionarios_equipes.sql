-- 20260816100000_schema_funcionarios_equipes.sql
-- Módulo: Especialidades, Funcionários e Equipes (Relacionamento N:N com Empresas Fornecedoras)

-- 1. TABELA DE ESPECIALIDADES (Catálogo de classificação da mão de obra por tenant)
CREATE TABLE IF NOT EXISTS especialidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT DEFAULT '#005daa',
    icone TEXT DEFAULT 'engineering',
    status TEXT CHECK (status IN ('ATIVO', 'INATIVO')) DEFAULT 'ATIVO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT especialidades_nome_unico UNIQUE(tenant_id, nome)
);

-- 2. TABELA DE FUNCIONÁRIOS (Pertencem a uma Empresa Fornecedora + 1 Especialidade)
CREATE TABLE IF NOT EXISTS funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    empresa_id TEXT NOT NULL,
    contrato_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    cpf VARCHAR(14),
    cargo TEXT,
    telefone VARCHAR(20),
    email TEXT,
    especialidade_id UUID REFERENCES especialidades(id) ON DELETE SET NULL,
    data_admissao DATE,
    status TEXT CHECK (status IN ('ATIVO', 'INATIVO', 'AFASTADO')) DEFAULT 'ATIVO',
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_func_empresa 
        FOREIGN KEY (empresa_id, contrato_id) 
        REFERENCES empresas_fornecedores(id, contrato_id) ON DELETE CASCADE,
    CONSTRAINT funcionarios_cpf_unico UNIQUE(tenant_id, cpf)
);

-- 3. TABELA DE EQUIPES (Pertencem a uma Empresa Fornecedora)
CREATE TABLE IF NOT EXISTS equipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    empresa_id TEXT NOT NULL,
    contrato_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    lider_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('ATIVA', 'INATIVA', 'EM_CAMPO')) DEFAULT 'ATIVA',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_equipe_empresa 
        FOREIGN KEY (empresa_id, contrato_id) 
        REFERENCES empresas_fornecedores(id, contrato_id) ON DELETE CASCADE,
    CONSTRAINT equipes_nome_empresa_unico UNIQUE(tenant_id, empresa_id, nome)
);

-- 4. TABELA DE ALOCAÇÃO DE MEMBROS DA EQUIPE (N:N — Permite que 1 funcionário componha N equipes)
CREATE TABLE IF NOT EXISTS equipe_membros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipe_id UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    funcao_na_equipe TEXT CHECK (funcao_na_equipe IN ('LIDER', 'COORDENADOR', 'MEMBRO', 'SUPORTE_TECNICO', 'AUXILIAR')) DEFAULT 'MEMBRO',
    adicionado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT equipe_membro_unico UNIQUE(equipe_id, funcionario_id)
);

-- 5. ATUALIZAR TABELA DE ORDENS DE SERVIÇO (Vínculo opcional de Equipe)
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS equipe_id UUID REFERENCES equipes(id) ON DELETE SET NULL;

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_membros ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE RLS (Isolamento por tenant_id / contrato_id)
DROP POLICY IF EXISTS tenant_especialidades ON especialidades;
CREATE POLICY tenant_especialidades ON especialidades FOR ALL
    USING (tenant_id = current_setting('app.current_contrato_id', true));

DROP POLICY IF EXISTS tenant_funcionarios ON funcionarios;
CREATE POLICY tenant_funcionarios ON funcionarios FOR ALL
    USING (tenant_id = current_setting('app.current_contrato_id', true));

DROP POLICY IF EXISTS tenant_equipes ON equipes;
CREATE POLICY tenant_equipes ON equipes FOR ALL
    USING (tenant_id = current_setting('app.current_contrato_id', true));

DROP POLICY IF EXISTS tenant_equipe_membros ON equipe_membros;
CREATE POLICY tenant_equipe_membros ON equipe_membros FOR ALL
    USING (EXISTS (
        SELECT 1 FROM equipes e 
        WHERE e.id = equipe_membros.equipe_id 
        AND e.tenant_id = current_setting('app.current_contrato_id', true)
    ));

-- 7. CONCEDER PERMISSÕES (GRANTS)
GRANT ALL ON TABLE especialidades TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE funcionarios TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE equipes TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE equipe_membros TO postgres, anon, authenticated, service_role;

-- 8. SEED DADOS INICIAIS DE ESPECIALIDADES PARA CTR-2026-SYS
INSERT INTO especialidades (tenant_id, nome, descricao, cor, icone)
VALUES 
    ('CTR-2026-SYS', 'Pedreiro', 'Alvenaria, estrutura e acabamento bruto', '#005daa', 'construction'),
    ('CTR-2026-SYS', 'Eletricista', 'Instalações elétricas de baixa e média tensão', '#f59e0b', 'bolt'),
    ('CTR-2026-SYS', 'Encanador', 'Instalações hidráulicas, sanitárias e pluviais', '#06b6d4', 'plumbing'),
    ('CTR-2026-SYS', 'Pintor', 'Pintura imobiliária, seladores e acabamentos', '#8b5cf6', 'format_paint'),
    ('CTR-2026-SYS', 'Soldador', 'Solda estrutural, serralheria e tubulações', '#ef4444', 'hardware'),
    ('CTR-2026-SYS', 'Carpinteiro', 'Formas de madeira, escoramentos e estruturas', '#d97706', 'carpentry'),
    ('CTR-2026-SYS', 'Armador', 'Corte, dobra e armação de ferragens para concreto', '#4b5563', 'grid_view'),
    ('CTR-2026-SYS', 'Mestre de Obras', 'Supervisão direta de canteiro e equipes', '#10b981', 'supervisor_account'),
    ('CTR-2026-SYS', 'Coordenador de Campo', 'Coordenação técnica entre frentes de trabalho', '#6366f1', 'manage_accounts'),
    ('CTR-2026-SYS', 'Técnico de Segurança', 'Gestão de EPIs, NR-35, NR-18 e prevenção', '#ec4899', 'health_and_safety'),
    ('CTR-2026-SYS', 'Servente', 'Apoio geral de canteiro, transporte e limpeza', '#64748b', 'handyman')
ON CONFLICT (tenant_id, nome) DO NOTHING;
