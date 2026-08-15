-- 20260814170000_schema_os.sql

-- 1. Tabela de Ordens de Serviço (OS)
CREATE TABLE IF NOT EXISTS ordens_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    item_eap_id UUID NOT NULL REFERENCES itens_eap(id) ON DELETE CASCADE,
    numero_os VARCHAR(100) NOT NULL,
    descricao TEXT,
    status VARCHAR(50) DEFAULT 'Emitida', -- Emitida, Em Andamento, Concluída
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ordens_servico_numero_unico UNIQUE(projeto_id, numero_os)
);

-- 2. Atualizar tabela rdos
ALTER TABLE rdos 
ADD COLUMN IF NOT EXISTS ordem_servico_id UUID REFERENCES ordens_servico(id) ON DELETE CASCADE;

-- 3. Security Policies (RLS)
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ordens_servico"
    ON ordens_servico FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
