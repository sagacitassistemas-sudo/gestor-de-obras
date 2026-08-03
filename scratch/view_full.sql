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
