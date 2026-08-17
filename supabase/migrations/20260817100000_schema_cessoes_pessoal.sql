-- 20260817100000_schema_cessoes_pessoal.sql

-- 1. Registrar códigos de evento no catálogo de compliance
INSERT INTO sistema_eventos_catalogo (cod_evento, descricao, categoria) VALUES
('CESSAO_CREATE', 'Cessão de pessoal registrada', 'CRUD'),
('CESSAO_ENCERRAR', 'Cessão de pessoal encerrada', 'CRUD'),
('CESSAO_CANCELAR', 'Cessão de pessoal cancelada', 'CRUD')
ON CONFLICT (cod_evento) DO NOTHING;

-- 2. Criar a tabela de Cessões de Pessoal
CREATE TABLE IF NOT EXISTS cessoes_pessoal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    equipe_origem_id UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
    equipe_destino_id UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
    os_destino_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fim DATE,
    motivo TEXT,
    status VARCHAR(20) CHECK (status IN ('ATIVA', 'ENCERRADA', 'CANCELADA')) DEFAULT 'ATIVA',
    autorizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT diff_equipes CHECK (equipe_origem_id != equipe_destino_id)
);

-- 3. Índices para performance
CREATE INDEX idx_cessoes_funcionario ON cessoes_pessoal(funcionario_id);
CREATE INDEX idx_cessoes_equipe_origem ON cessoes_pessoal(equipe_origem_id);
CREATE INDEX idx_cessoes_equipe_destino ON cessoes_pessoal(equipe_destino_id);
CREATE INDEX idx_cessoes_status ON cessoes_pessoal(status);

-- 4. Security Policies (RLS)
ALTER TABLE cessoes_pessoal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for cessoes_pessoal"
    ON cessoes_pessoal FOR ALL
    USING (tenant_id = current_setting('app.current_contrato_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_contrato_id', true));

-- 5. Conceder permissões
GRANT ALL ON TABLE cessoes_pessoal TO postgres, anon, authenticated, service_role;
