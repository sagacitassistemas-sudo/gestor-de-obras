-- ==============================================================================
-- 🏗️ ESQUEMA DE DADOS: GESTÃO DE OBRAS, EAP E MEDIÇÕES
-- ==============================================================================
-- Este script cria a estrutura relacional em 3FN para suportar o cadastro
-- de projetos, itens de EAP (com hierarquia) e o histórico de medições.
-- Compatível com PostgreSQL.

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
    valor_total_contratado NUMERIC(15,2) DEFAULT 0.00, -- Armazenado para consistência
    valor_desembolsado NUMERIC(15,2) DEFAULT 0.00,     -- Valor desembolsado efetivo
    e_analitico BOOLEAN NOT NULL DEFAULT FALSE,        -- TRUE se folha, FALSE se agrupador
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Restrições
    CONSTRAINT unique_eap_por_projeto UNIQUE (projeto_id, eap_codigo),
    CONSTRAINT chk_analitico_valores CHECK (
        (e_analitico = FALSE) OR 
        (e_analitico = TRUE AND unidade_medida IS NOT NULL)
    )
);

-- Índice para acelerar a busca hierárquica e auto-relacionamento lógico
CREATE INDEX idx_itens_eap_pai ON itens_eap(projeto_id, eap_pai_codigo);

-- 3. Tabela de Medições (Cabeçalho)
CREATE TABLE IF NOT EXISTS medicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    numero_medicao INTEGER NOT NULL,
    data_medicao DATE NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO, APROVADO, PAGO
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_numero_medicao_por_projeto UNIQUE (projeto_id, numero_medicao)
);

-- 4. Tabela de Detalhes da Medição (Apuração Físico-Financeira)
CREATE TABLE IF NOT EXISTS itens_medicao_detalhe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicao_id UUID NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
    item_eap_id UUID NOT NULL REFERENCES itens_eap(id) ON DELETE CASCADE,
    quantidade_periodo NUMERIC(15,4) DEFAULT 0.0000,
    valor_periodo NUMERIC(15,2) DEFAULT 0.00,
    quantidade_acumulada NUMERIC(15,4) DEFAULT 0.0000,
    valor_acumulado NUMERIC(15,2) DEFAULT 0.00,
    percentual_executado_acumulado NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_item_por_medicao UNIQUE (medicao_id, item_eap_id)
);

-- ==============================================================================
-- 🔍 VIEWS DE APOIO PARA DASHBOARDS E FRONTEND
-- ==============================================================================
-- View que calcula subtotais para os itens Sintéticos (pai) rolando (rollup) os 
-- valores dos itens Analíticos (filhos).

CREATE OR REPLACE VIEW v_resumo_eap_medicao AS
WITH agregacao_contrato AS (
    SELECT 
        h1.id AS pai_id,
        SUM(h2.valor_total_contratado) AS total_contratado_calc,
        SUM(h2.valor_desembolsado) AS total_desembolsado_calc
    FROM itens_eap h1
    LEFT JOIN itens_eap h2 ON h2.projeto_id = h1.projeto_id 
        AND (h2.eap_codigo LIKE h1.eap_codigo || '.%' OR h2.id = h1.id)
        AND h2.e_analitico = TRUE
    GROUP BY h1.id
),
ultima_medicao AS (
    SELECT 
        projeto_id, 
        id as medicao_id,
        numero_medicao
    FROM (
        SELECT 
            projeto_id, id, numero_medicao,
            ROW_NUMBER() OVER (PARTITION BY projeto_id ORDER BY numero_medicao DESC) as rn
        FROM medicoes
        WHERE status = 'APROVADO' OR status = 'PAGO'
    ) m
    WHERE rn = 1
),
agregacao_medicao AS (
    SELECT 
        h1.id as pai_id,
        m.medicao_id,
        SUM(COALESCE(imd.quantidade_periodo, 0)) as quantidade_medida_acumulada,
        SUM(COALESCE(imd.valor_periodo, 0)) as valor_medido_acumulado
    FROM itens_eap h1
    LEFT JOIN itens_eap h2 ON h2.projeto_id = h1.projeto_id 
        AND (h2.eap_codigo LIKE h1.eap_codigo || '.%' OR h2.id = h1.id)
        AND h2.e_analitico = TRUE
    JOIN ultima_medicao m ON m.projeto_id = h1.projeto_id
    LEFT JOIN itens_medicao_detalhe imd ON imd.item_eap_id = h2.id AND imd.medicao_id = m.medicao_id
    GROUP BY h1.id, m.medicao_id
)
SELECT 
    h.id,
    h.projeto_id,
    h.eap_codigo,
    h.eap_pai_codigo,
    h.descricao_servico,
    h.unidade_medida,
    h.preco_unitario,
    h.quantidade_contratada,
    COALESCE(ac.total_contratado_calc, 0) as valor_total_contratado,
    COALESCE(ac.total_desembolsado_calc, 0) as valor_desembolsado,
    h.e_analitico,
    (LENGTH(h.eap_codigo) - LENGTH(REPLACE(h.eap_codigo, '.', ''))) + 1 AS nivel,
    h.ordem,
    COALESCE(am.quantidade_medida_acumulada, 0) as medicao_acumulada_qtd,
    COALESCE(am.valor_medido_acumulado, 0) as medicao_acumulada_valor_legacy,
    CASE 
        WHEN COALESCE(ac.total_contratado_calc, 0) > 0 
        THEN (COALESCE(ac.total_desembolsado_calc, 0) / ac.total_contratado_calc) * 100
        ELSE 0 
    END as percentual_executado_financeiro
FROM itens_eap h
LEFT JOIN agregacao_contrato ac ON ac.pai_id = h.id
LEFT JOIN agregacao_medicao am ON am.pai_id = h.id;
