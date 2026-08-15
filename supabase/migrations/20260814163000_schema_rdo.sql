-- 20260814163000_schema_rdo.sql

-- 1. TABELA DE CABEÇALHO DO RDO
CREATE TABLE IF NOT EXISTS rdos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    numero_rdo VARCHAR(100) NOT NULL,
    data_rdo DATE NOT NULL DEFAULT CURRENT_DATE,
    responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    clima_manha VARCHAR(50),
    clima_tarde VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Rascunho', -- Rascunho, Consolidado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT rdos_numero_unico_por_projeto UNIQUE(projeto_id, numero_rdo)
);

-- 2. TABELA DE ITENS DO RDO (APONTAMENTOS)
CREATE TABLE IF NOT EXISTS rdo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    rdo_id UUID NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
    item_eap_id UUID NOT NULL REFERENCES itens_eap(id) ON DELETE CASCADE,
    qtd_medida NUMERIC(15,4) NOT NULL DEFAULT 0,
    valor_unitario_contrato NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_total_dia NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE FOTOS/EVIDÊNCIAS
CREATE TABLE IF NOT EXISTS rdo_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rdo_item_id UUID NOT NULL REFERENCES rdo_items(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. VIEWS AUXILIARES PARA CONSOLIDAÇÃO DE RDOs POR PERÍODO
CREATE OR REPLACE VIEW v_rdo_totais_por_projeto AS
SELECT 
    r.projeto_id,
    r.id AS rdo_id,
    r.data_rdo,
    r.status,
    COALESCE(SUM(ri.valor_total_dia), 0) AS valor_total_rdo
FROM rdos r
LEFT JOIN rdo_items ri ON ri.rdo_id = r.id
GROUP BY r.projeto_id, r.id, r.data_rdo, r.status;


-- SECURITY POLICIES (RLS)
ALTER TABLE rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for rdos"
    ON rdos FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "Tenant isolation for rdo_items"
    ON rdo_items FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY "Read access to rdo_photos for tenant"
    ON rdo_photos FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM rdo_items ri
        WHERE ri.id = rdo_photos.rdo_item_id
        AND ri.tenant_id = current_setting('app.current_tenant', true)
    ));

CREATE POLICY "Insert access to rdo_photos for tenant"
    ON rdo_photos FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM rdo_items ri
        WHERE ri.id = rdo_photos.rdo_item_id
        AND ri.tenant_id = current_setting('app.current_tenant', true)
    ));

CREATE POLICY "Update access to rdo_photos for tenant"
    ON rdo_photos FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM rdo_items ri
        WHERE ri.id = rdo_photos.rdo_item_id
        AND ri.tenant_id = current_setting('app.current_tenant', true)
    ));

CREATE POLICY "Delete access to rdo_photos for tenant"
    ON rdo_photos FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM rdo_items ri
        WHERE ri.id = rdo_photos.rdo_item_id
        AND ri.tenant_id = current_setting('app.current_tenant', true)
    ));
