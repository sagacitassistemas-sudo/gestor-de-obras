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
)
SELECT 
    h.id, h.projeto_id, h.eap_codigo, h.eap_pai_codigo, h.descricao_servico,
    h.unidade_medida, h.preco_unitario, h.quantidade_contratada, 
    COALESCE(ac.total_contratado_calc, 0) AS valor_total_contratado,
    COALESCE(ac.total_desembolsado_calc, 0) AS valor_desembolsado,
    h.e_analitico, h.ordem,
    (LENGTH(h.eap_codigo) - LENGTH(REPLACE(h.eap_codigo, '.', ''))) + 1 AS nivel
FROM itens_eap h
LEFT JOIN agregacao_contrato ac ON ac.pai_id = h.id;
