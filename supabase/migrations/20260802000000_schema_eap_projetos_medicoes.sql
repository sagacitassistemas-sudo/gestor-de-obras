-- ==============================================================================
-- GESTOR DE OBRAS - Schema EAP e Medições
-- Migração: 20260802000000
-- ==============================================================================

-- 1. Tabela de Projetos / Contratos
CREATE TABLE IF NOT EXISTS projetos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_contrato VARCHAR(100) NOT NULL,
    nome_projeto VARCHAR(255) NOT NULL,
    data_inicio DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Itens da EAP (Estrutura Analítica do Projeto)
CREATE TABLE IF NOT EXISTS itens_eap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    eap_codigo VARCHAR(100) NOT NULL, -- Ex: "2.2.1"
    eap_pai_codigo VARCHAR(100),      -- Ex: "2.2" (Nulo se for raiz)
    descricao_servico TEXT NOT NULL,
    unidade_medida VARCHAR(20),       -- Ex: ud, hm, km, mes. Nulo para agrupadores.
    preco_unitario NUMERIC(15,2) DEFAULT 0.00,
    quantidade_contratada NUMERIC(15,4) DEFAULT 0.0000,
    valor_total_contratado NUMERIC(15,2) DEFAULT 0.00, 
    e_analitico BOOLEAN NOT NULL DEFAULT FALSE,        
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Restrições removendo unique_eap_por_projeto pois vimos duplicidades no mundo real
    CONSTRAINT chk_analitico_valores CHECK (
        (e_analitico = FALSE) OR 
        (e_analitico = TRUE AND unidade_medida IS NOT NULL)
    )
);

-- Índice para acelerar a busca hierárquica e auto-relacionamento lógico
CREATE INDEX IF NOT EXISTS idx_itens_eap_pai ON itens_eap(projeto_id, eap_pai_codigo);

-- 3. Tabela de Medições (Cabeçalho)
CREATE TABLE IF NOT EXISTS medicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    numero_medicao INTEGER NOT NULL,
    data_medicao DATE NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RASCUNHO', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_numero_medicao_por_projeto UNIQUE (projeto_id, numero_medicao)
);

-- 4. Tabela de Detalhes da Medição (Apuração Físico-Financeira)
CREATE TABLE IF NOT EXISTS itens_medicao_detalhe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicao_id UUID NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
    item_eap_id UUID NOT NULL REFERENCES itens_eap(id) ON DELETE RESTRICT,
    
    -- Valores do Período Corrente (Mês atual)
    quantidade_periodo NUMERIC(15,4) NOT NULL DEFAULT 0.0000,
    valor_periodo NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    
    -- Valores Acumulados (Até o mês atual)
    quantidade_acumulada NUMERIC(15,4) NOT NULL DEFAULT 0.0000,
    valor_acumulado NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    
    -- Avanço Físico-Financeiro
    percentual_executado_acumulado NUMERIC(8,4) NOT NULL DEFAULT 0.0000,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_item_por_medicao UNIQUE (medicao_id, item_eap_id)
);

-- ==============================================================================
-- 📊 VIEW DE CONSOLIDAÇÃO: RESUMO EAP E MEDIÇÃO
-- ==============================================================================
CREATE OR REPLACE VIEW v_resumo_eap_medicao AS
WITH RECURSIVE hierarquia_eap AS (
    SELECT 
        id, projeto_id, eap_codigo, eap_pai_codigo, e_analitico, id AS id_raiz, eap_codigo as codigo_raiz
    FROM itens_eap
    UNION ALL
    SELECT 
        e.id, e.projeto_id, e.eap_codigo, e.eap_pai_codigo, e.e_analitico, h.id_raiz, h.codigo_raiz
    FROM itens_eap e
    INNER JOIN hierarquia_eap h ON e.eap_pai_codigo = h.eap_codigo AND e.projeto_id = h.projeto_id
),
agregacao_contrato AS (
    SELECT 
        h.id_raiz as id,
        SUM(e.valor_total_contratado) as total_contratado_calc
    FROM hierarquia_eap h
    JOIN itens_eap e ON h.id = e.id
    WHERE e.e_analitico = TRUE
    GROUP BY h.id_raiz
),
ultima_medicao AS (
    SELECT projeto_id, id as medicao_id
    FROM (
        SELECT projeto_id, id, ROW_NUMBER() OVER(PARTITION BY projeto_id ORDER BY numero_medicao DESC) as rn
        FROM medicoes WHERE status != 'RASCUNHO'
    ) m
    WHERE rn = 1
),
agregacao_medicao AS (
    SELECT 
        h.id_raiz as id,
        SUM(imd.valor_periodo) as total_periodo_calc,
        SUM(imd.valor_acumulado) as total_acumulado_calc
    FROM hierarquia_eap h
    JOIN itens_eap e ON h.id = e.id
    JOIN itens_medicao_detalhe imd ON imd.item_eap_id = e.id
    JOIN ultima_medicao um ON um.medicao_id = imd.medicao_id
    WHERE e.e_analitico = TRUE
    GROUP BY h.id_raiz
)
SELECT 
    e.projeto_id,
    p.nome_projeto,
    e.eap_codigo,
    e.descricao_servico,
    e.unidade_medida,
    e.preco_unitario,
    e.quantidade_contratada,
    CASE WHEN e.e_analitico THEN e.valor_total_contratado ELSE COALESCE(ac.total_contratado_calc, 0) END AS valor_total_contratado,
    e.e_analitico,
    COALESCE(am.total_periodo_calc, 0) AS medicao_corrente_valor,
    COALESCE(am.total_acumulado_calc, 0) AS medicao_acumulada_valor,
    CASE 
        WHEN e.e_analitico THEN 
            CASE WHEN e.valor_total_contratado > 0 THEN (COALESCE(am.total_acumulado_calc, 0) / e.valor_total_contratado) * 100 ELSE 0 END
        ELSE 
            CASE WHEN COALESCE(ac.total_contratado_calc, 0) > 0 THEN (COALESCE(am.total_acumulado_calc, 0) / ac.total_contratado_calc) * 100 ELSE 0 END
    END AS percentual_executado_financeiro
FROM itens_eap e
LEFT JOIN projetos p ON e.projeto_id = p.id
LEFT JOIN agregacao_contrato ac ON e.id = ac.id
LEFT JOIN agregacao_medicao am ON e.id = am.id
ORDER BY e.projeto_id, string_to_array(regexp_replace(e.eap_codigo, '[^0-9\.]', '', 'g'), '.')::int[];

-- ===================================================================
-- GRANTS E RLS
-- ===================================================================
ALTER TABLE projetos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_eap             ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_medicao_detalhe ENABLE ROW LEVEL SECURITY;

-- Exemplo simples de bypass global provisório.
-- Na prática, deverá vincular com a role de autenticação do auth.users.
CREATE POLICY tenant_projetos ON projetos FOR ALL USING (true);
CREATE POLICY tenant_itens_eap ON itens_eap FOR ALL USING (true);
CREATE POLICY tenant_medicoes ON medicoes FOR ALL USING (true);
CREATE POLICY tenant_itens_medicao ON itens_medicao_detalhe FOR ALL USING (true);

GRANT ALL ON TABLE projetos TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE itens_eap TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE medicoes TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE itens_medicao_detalhe TO postgres, anon, authenticated, service_role;
GRANT SELECT ON v_resumo_eap_medicao TO anon, authenticated, service_role;
