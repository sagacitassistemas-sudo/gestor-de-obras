-- 20260820200000_encargos_complementares.sql
-- Módulo de Encargos Complementares e Custos Indiretos de Mão de Obra

-- 1. Referências Globais (Imutáveis, usadas como Base)
CREATE TABLE IF NOT EXISTS ref_encargos_complementares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria VARCHAR(50) NOT NULL,
    item VARCHAR(100) NOT NULL,
    custo_horista_ref NUMERIC(8,2) NOT NULL,
    custo_mensalista_ref NUMERIC(8,2) NOT NULL,
    regra_calculo VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS ref_encargos_especificos_funcao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_funcao VARCHAR(150) NOT NULL,
    epi_horista_ref NUMERIC(8,2) NOT NULL,
    epi_mensalista_ref NUMERIC(8,2) NOT NULL,
    ferramentas_horista_ref NUMERIC(8,2) NOT NULL,
    ferramentas_mensalista_ref NUMERIC(8,2) NOT NULL
);

-- 2. Configurações e Parâmetros por Projeto
CREATE TABLE IF NOT EXISTS tenant_parametros_mao_obra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    obra_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    horas_mes NUMERIC(8,2) DEFAULT 165.00,
    pct_encargos_sociais NUMERIC(8,4) DEFAULT 85.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tenant_param_mo_obra_unico UNIQUE(obra_id)
);

CREATE TABLE IF NOT EXISTS tenant_encargos_complementares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    obra_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    ref_id UUID REFERENCES ref_encargos_complementares(id),
    categoria VARCHAR(50),
    item VARCHAR(100),
    custo_horista NUMERIC(8,2),
    custo_mensalista NUMERIC(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_encargos_especificos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    obra_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    codigo_cbo VARCHAR(10),
    nome_funcao VARCHAR(150),
    epi_horista NUMERIC(8,2),
    ferramentas_horista NUMERIC(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tenant_encargo_funcao_unico UNIQUE(obra_id, codigo_cbo)
);

-- 3. Inserir Dados Referenciais
INSERT INTO ref_encargos_complementares (categoria, item, custo_horista_ref, custo_mensalista_ref, regra_calculo)
VALUES 
    ('Alimentação', 'Café da Manhã + Cesta Básica', 7.63, 1259.03, 'Café (R$ 7,00/dia) + Cesta (R$ 1.100,00/mês)'),
    ('Transporte', 'Vale-Transporte (Líquido)', 0.66, 108.77, 'Passagem (22,86 dias) (-) Desconto Legal 6% s/ Salário'),
    ('Seguro de Vida', 'Morte / Auxílio Funeral', 0.11, 18.28, 'Apólice CCT (Morte R$ 13,5k / Funeral R$ 3,5k)'),
    ('Exames (PCMSO)', 'Exames Clínicos e Complementares', 1.62, 267.33, 'ASO, Audiometria, RX, Espirometria, ECG, Glicemia (Turnover: 13,53 meses)');

INSERT INTO ref_encargos_especificos_funcao (nome_funcao, epi_horista_ref, epi_mensalista_ref, ferramentas_horista_ref, ferramentas_mensalista_ref)
VALUES 
    ('Pedreiro', 1.28, 211.91, 0.68, 113.82),
    ('Soldador', 1.95, 322.90, 1.19, 197.38),
    ('Pintor', 1.63, 269.34, 1.95, 322.67),
    ('Servente', 1.34, 221.88, 0.57, 94.08),
    ('Encanador', 1.07, 177.95, 0.41, 68.67),
    ('Eletricista', 1.20, 198.84, 0.81, 134.93),
    ('Carpinteiro', 1.26, 208.55, 0.28, 46.43),
    ('Topógrafo', 0.65, 107.76, 0.07, 12.86),
    ('Op. de Escavadeira', 0.80, 133.12, 0.02, 4.73),
    ('Encarregado', 1.11, 183.81, 0.11, 19.52),
    ('Engenheiro', 0.80, 132.38, 0.02, 4.14),
    ('Almoxarife', 0.65, 107.76, 0.05, 9.12);

-- 4. View de Custo Hora Real
-- Esta view faz join do ref_cargos_salarios (salário base) com o tenant_parametros_mao_obra e tenant_encargos para chegar no custo real por obra
CREATE OR REPLACE VIEW v_custo_hora_real_mao_obra AS
SELECT 
    p.obra_id,
    p.tenant_id,
    c.codigo_cbo,
    c.nome_cargo,
    c.salario_medio AS salario_base_mensal,
    (c.salario_medio / p.horas_mes) AS salario_base_horista,
    p.pct_encargos_sociais,
    
    -- Encargo Social
    ((c.salario_medio / p.horas_mes) * (p.pct_encargos_sociais / 100.0)) AS valor_encargos_sociais_horista,
    
    -- Encargos Gerais Consolidados (Soma dos Encargos Gerais Ativos do Projeto)
    COALESCE((
        SELECT SUM(tec.custo_horista) 
        FROM tenant_encargos_complementares tec 
        WHERE tec.obra_id = p.obra_id
    ), 0.00) AS total_encargos_gerais_horista,
    
    -- EPI Específico da Função
    COALESCE(tef.epi_horista, 0.00) AS epi_horista,
    
    -- Ferramentas da Função
    COALESCE(tef.ferramentas_horista, 0.00) AS ferramentas_horista,
    
    -- Matemática Final (Salario_H * (1 + Pct) + EC + EPI + Ferr)
    (
        (c.salario_medio / p.horas_mes) * (1 + (p.pct_encargos_sociais / 100.0))
        + COALESCE((SELECT SUM(tec.custo_horista) FROM tenant_encargos_complementares tec WHERE tec.obra_id = p.obra_id), 0.00)
        + COALESCE(tef.epi_horista, 0.00)
        + COALESCE(tef.ferramentas_horista, 0.00)
    ) AS custo_hora_real
    
FROM tenant_parametros_mao_obra p
CROSS JOIN ref_cargos_salarios c
LEFT JOIN tenant_encargos_especificos tef ON (tef.obra_id = p.obra_id AND tef.codigo_cbo = c.codigo_cbo)
WHERE c.uf = 'ES'; -- Por default, podemos vincular a UF da obra, mas como a base inteira roda num tenant único por enq, fixamos.

-- Políticas RLS
ALTER TABLE ref_encargos_complementares ENABLE ROW LEVEL SECURITY;
CREATE POLICY ref_encargos_comp_select ON ref_encargos_complementares FOR SELECT USING (true);

ALTER TABLE ref_encargos_especificos_funcao ENABLE ROW LEVEL SECURITY;
CREATE POLICY ref_encargos_esp_select ON ref_encargos_especificos_funcao FOR SELECT USING (true);

ALTER TABLE tenant_parametros_mao_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_parametros_mo_rls ON tenant_parametros_mao_obra FOR ALL USING (
    current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR tenant_id = COALESCE(NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

ALTER TABLE tenant_encargos_complementares ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_encargos_comp_rls ON tenant_encargos_complementares FOR ALL USING (
    current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR tenant_id = COALESCE(NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

ALTER TABLE tenant_encargos_especificos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_encargos_esp_rls ON tenant_encargos_especificos FOR ALL USING (
    current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR tenant_id = COALESCE(NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);
