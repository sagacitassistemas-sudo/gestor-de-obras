CREATE OR REPLACE VIEW v_resumo_eap_medicao AS
WITH RECURSIVE hierarquia_eap AS (
    SELECT 
        id, projeto_id, eap_codigo, eap_pai_codigo, descricao_servico,
        unidade_medida, preco_unitario, quantidade_contratada, 
        valor_total_contratado, valor_desembolsado, e_analitico, ordem,
        eap_codigo::TEXT AS caminho, 1 AS nivel
    FROM itens_eap
    WHERE eap_pai_codigo IS NULL
    UNION ALL
    SELECT 
        i.id, i.projeto_id, i.eap_codigo, i.eap_pai_codigo, i.descricao_servico,
        i.unidade_medida, i.preco_unitario, i.quantidade_contratada, 
        i.valor_total_contratado, i.valor_desembolsado, i.e_analitico, i.ordem,
        (h.caminho || '.' || i.eap_codigo)::TEXT, h.nivel + 1
    FROM itens_eap i
    INNER JOIN hierarquia_eap h ON i.projeto_id = h.projeto_id AND i.eap_pai_codigo = h.eap_codigo
),
agregacao_contrato AS (
    SELECT 
        h1.id AS pai_id,
        SUM(h2.valor_total_contratado) AS total_contratado_calc,
        SUM(h2.valor_desembolsado) AS total_desembolsado_calc
    FROM hierarquia_eap h1
    LEFT JOIN hierarquia_eap h2 ON h2.projeto_id = h1.projeto_id 
        AND (h2.caminho LIKE h1.caminho || '.%' OR h2.id = h1.id)
        AND h2.e_analitico = TRUE
    GROUP BY h1.id
)
SELECT 
    h.id, h.projeto_id, h.eap_codigo, h.eap_pai_codigo, h.descricao_servico,
    h.unidade_medida, h.preco_unitario, h.quantidade_contratada, 
    COALESCE(ac.total_contratado_calc, 0) AS valor_total_contratado,
    COALESCE(ac.total_desembolsado_calc, 0) AS valor_desembolsado,
    h.e_analitico, h.ordem, h.nivel
FROM hierarquia_eap h
LEFT JOIN agregacao_contrato ac ON ac.pai_id = h.id;
