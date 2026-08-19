-- 20260819100000_schema_dispositivos.sql

-- 1. Tabela de Dispositivos Mobile (Carteira)
CREATE TABLE IF NOT EXISTS dispositivos_mobile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    funcionario_id UUID REFERENCES funcionarios(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'BLOQUEADO')),
    modelo VARCHAR(100),
    os_version VARCHAR(50),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_device_tenant UNIQUE(tenant_id, device_id)
);

-- 2. Security Policies (RLS)
ALTER TABLE dispositivos_mobile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_dispositivos ON dispositivos_mobile;
CREATE POLICY tenant_dispositivos ON dispositivos_mobile FOR ALL
    USING (tenant_id = current_setting('app.current_contrato_id', true));

-- 3. Grants
GRANT ALL ON TABLE dispositivos_mobile TO postgres, anon, authenticated, service_role;
