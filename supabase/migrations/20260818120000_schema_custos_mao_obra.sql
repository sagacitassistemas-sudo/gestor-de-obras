-- 20260818120000_schema_custos_mao_obra.sql
-- Módulo de Custos de Mão de Obra e BDI
-- Inclui tabelas de referência regional (SINAPI) e customizações por Tenant

-- 1. Tabela de Referência Regional: Cargos e Salários (Somente Leitura)
CREATE TABLE IF NOT EXISTS ref_cargos_salarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uf VARCHAR(2) NOT NULL,
    codigo_cbo VARCHAR(10) NOT NULL,
    nome_cargo VARCHAR(150) NOT NULL,
    salario_piso NUMERIC(12,2),
    salario_medio NUMERIC(12,2),
    salario_maior NUMERIC(12,2),
    cuai_valor NUMERIC(8,2),
    fc_valor NUMERIC(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ref_cargos_uf_cbo_unico UNIQUE (uf, codigo_cbo)
);

-- 2. Tabela de Referência Regional: Matriz de Encargos Sociais (SINAPI)
CREATE TABLE IF NOT EXISTS ref_matriz_encargos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uf VARCHAR(2) NOT NULL,
    codigo_item VARCHAR(10),
    grupo CHAR(1) NOT NULL,
    descricao VARCHAR(255),
    pct_com_deson_horista NUMERIC(6,4),
    pct_com_deson_mensalista NUMERIC(6,4),
    pct_sem_deson_horista NUMERIC(6,4),
    pct_sem_deson_mensalista NUMERIC(6,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ref_encargos_uf_item_unico UNIQUE (uf, codigo_item)
);

-- 3. Tabela do Tenant: Cargos e Salários Adotados pela Empresa
CREATE TABLE IF NOT EXISTS tenant_cargos_salarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    obra_id UUID, -- Opcional, se o cargo/salário for específico de uma obra
    ref_cargo_id UUID REFERENCES ref_cargos_salarios(id) ON DELETE SET NULL,
    codigo_cbo VARCHAR(10),
    nome_cargo VARCHAR(150) NOT NULL,
    salario_base_adotado NUMERIC(12,2),
    cuai_adotado NUMERIC(8,2),
    fc_adotado NUMERIC(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela do Tenant: Configuração de BDI por Obra (Acórdão TCU 2622/2013)
CREATE TABLE IF NOT EXISTS tenant_bdi_configuracao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    obra_id UUID,
    tipo_composicao VARCHAR(20) NOT NULL DEFAULT 'SERVICO', -- 'SERVICO' ou 'FORNECIMENTO'
    pct_administracao_central NUMERIC(6,4) DEFAULT 0,
    pct_seguros_garantias NUMERIC(6,4) DEFAULT 0,
    pct_riscos NUMERIC(6,4) DEFAULT 0,
    pct_despesas_financeiras NUMERIC(6,4) DEFAULT 0,
    pct_lucro NUMERIC(6,4) DEFAULT 0,
    pct_iss NUMERIC(6,4) DEFAULT 0,
    pct_pis NUMERIC(6,4) DEFAULT 0,
    pct_cofins NUMERIC(6,4) DEFAULT 0,
    pct_cprb NUMERIC(6,4) DEFAULT 0,
    bdi_calculado NUMERIC(6,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ==========================================

-- A) Tabelas de Referência (Acesso Público para Leitura para usuários autenticados)
ALTER TABLE ref_cargos_salarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ref_cargos_select ON ref_cargos_salarios;
CREATE POLICY ref_cargos_select ON ref_cargos_salarios FOR SELECT
    USING (current_setting('role', true) = 'service_role'
        OR auth.role() = 'service_role'
        OR auth.role() = 'authenticated');

ALTER TABLE ref_matriz_encargos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ref_encargos_select ON ref_matriz_encargos;
CREATE POLICY ref_encargos_select ON ref_matriz_encargos FOR SELECT
    USING (current_setting('role', true) = 'service_role'
        OR auth.role() = 'service_role'
        OR auth.role() = 'authenticated');


-- B) Tabelas do Tenant (Isolamento por contrato_id)
ALTER TABLE tenant_cargos_salarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_cargos_rls ON tenant_cargos_salarios;
CREATE POLICY tenant_cargos_rls ON tenant_cargos_salarios FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

ALTER TABLE tenant_bdi_configuracao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_bdi_rls ON tenant_bdi_configuracao;
CREATE POLICY tenant_bdi_rls ON tenant_bdi_configuracao FOR ALL
    USING (
        current_setting('role', true) = 'service_role' OR
        auth.role() = 'service_role' OR
        tenant_id = COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
            NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
            'CTR-2026-SYS'
        )
    );

-- ==========================================
-- SEED DATA - ESPÍRITO SANTO (ES)
-- ==========================================

-- 10 Cargos CBO
INSERT INTO ref_cargos_salarios (uf, codigo_cbo, nome_cargo, salario_piso, salario_medio, salario_maior, cuai_valor, fc_valor)
VALUES 
    ('ES', '7170-20', 'Servente de Obras', 1780.00, 2050.00, 2400.00, 320.00, 85.00),
    ('ES', '7152-10', 'Pedreiro', 2200.00, 2680.00, 3200.00, 320.00, 120.00),
    ('ES', '7102-05', 'Mestre de Obras', 4200.00, 5800.00, 7500.00, 380.00, 150.00),
    ('ES', '7155-05', 'Carpinteiro', 2100.00, 2550.00, 3100.00, 320.00, 130.00),
    ('ES', '7153-05', 'Armador de Ferragens', 2050.00, 2500.00, 3000.00, 320.00, 110.00),
    ('ES', '7241-10', 'Encanador', 2150.00, 2700.00, 3300.00, 320.00, 125.00),
    ('ES', '7156-15', 'Eletricista de Obras', 2300.00, 2850.00, 3500.00, 320.00, 140.00),
    ('ES', '7166-10', 'Pintor de Obras', 1950.00, 2350.00, 2800.00, 320.00, 95.00),
    ('ES', '2141-05', 'Engenheiro Civil', 7500.00, 10200.00, 15000.00, 450.00, 180.00),
    ('ES', '3121-05', 'Técnico em Edificações', 3200.00, 4100.00, 5500.00, 380.00, 130.00)
ON CONFLICT (uf, codigo_cbo) DO UPDATE SET 
    salario_piso = EXCLUDED.salario_piso, 
    salario_medio = EXCLUDED.salario_medio, 
    salario_maior = EXCLUDED.salario_maior, 
    cuai_valor = EXCLUDED.cuai_valor, 
    fc_valor = EXCLUDED.fc_valor;

-- SINAPI 8ª Edição ES
INSERT INTO ref_matriz_encargos (uf, codigo_item, grupo, descricao, pct_com_deson_horista, pct_com_deson_mensalista, pct_sem_deson_horista, pct_sem_deson_mensalista)
VALUES
    ('ES', 'A1', 'A', 'INSS (Patronal)', 10.0000, 10.0000, 20.0000, 20.0000),
    ('ES', 'A2', 'A', 'SESI', 1.5000, 1.5000, 1.5000, 1.5000),
    ('ES', 'A3', 'A', 'SENAI', 1.0000, 1.0000, 1.0000, 1.0000),
    ('ES', 'A4', 'A', 'INCRA', 0.2000, 0.2000, 0.2000, 0.2000),
    ('ES', 'A5', 'A', 'SEBRAE', 0.6000, 0.6000, 0.6000, 0.6000),
    ('ES', 'A6', 'A', 'Salário Educação', 2.5000, 2.5000, 2.5000, 2.5000),
    ('ES', 'A7', 'A', 'Seguro SEST/SENAT', 0.0000, 0.0000, 0.0000, 0.0000),
    ('ES', 'A8', 'A', 'FGTS', 8.0000, 8.0000, 8.0000, 8.0000),
    ('ES', 'A9', 'A', 'Seguro Acidente Trabalho (RAT)', 3.0000, 3.0000, 3.0000, 3.0000),
    ('ES', 'B1', 'B', 'Repouso Semanal Remunerado', 17.9400, 0.0000, 17.9400, 0.0000),
    ('ES', 'B2', 'B', 'Feriados', 4.0200, 0.0000, 4.0200, 0.0000),
    ('ES', 'B3', 'B', 'Auxílio-Enfermidade', 1.2300, 1.2300, 1.2300, 1.2300),
    ('ES', 'B4', 'B', '13º Salário', 10.8000, 10.8000, 10.8000, 10.8000),
    ('ES', 'B5', 'B', 'Licença Paternidade', 0.0600, 0.0600, 0.0600, 0.0600),
    ('ES', 'B6', 'B', 'Faltas Justificadas', 0.7300, 0.7300, 0.7300, 0.7300),
    ('ES', 'B7', 'B', 'Dias de Chuva', 1.5000, 0.0000, 1.5000, 0.0000),
    ('ES', 'B8', 'B', 'Férias + 1/3', 14.5300, 14.5300, 14.5300, 14.5300),
    ('ES', 'C1', 'C', 'Aviso Prévio Indenizado', 6.1800, 6.1800, 6.1800, 6.1800),
    ('ES', 'C2', 'C', 'Aviso Prévio Trabalhado', 0.1200, 0.1200, 0.1200, 0.1200),
    ('ES', 'C3', 'C', 'FGTS Rescisão s/ J.C.', 4.4800, 4.4800, 4.4800, 4.4800),
    ('ES', 'C4', 'C', 'Indenização Adicional', 0.4600, 0.4600, 0.4600, 0.4600),
    ('ES', 'D1', 'D', 'Reincidência Grupo A sobre B', 6.8200, 3.7800, 7.9400, 4.3900),
    ('ES', 'D2', 'D', 'Reincidência Grupo A sobre C', 2.9800, 2.9800, 3.4600, 3.4600),
    ('ES', 'E1', 'E', 'EPI (Equipamentos de Proteção)', 4.8300, 4.8300, 4.8300, 4.8300),
    ('ES', 'E2', 'E', 'Ferramentas Manuais', 2.0000, 2.0000, 2.0000, 2.0000)
ON CONFLICT (uf, codigo_item) DO UPDATE SET 
    pct_com_deson_horista = EXCLUDED.pct_com_deson_horista,
    pct_com_deson_mensalista = EXCLUDED.pct_com_deson_mensalista,
    pct_sem_deson_horista = EXCLUDED.pct_sem_deson_horista,
    pct_sem_deson_mensalista = EXCLUDED.pct_sem_deson_mensalista;
