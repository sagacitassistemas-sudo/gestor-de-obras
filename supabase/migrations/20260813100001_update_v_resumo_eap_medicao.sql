CREATE OR REPLACE VIEW public.v_resumo_eap_medicao AS
 WITH RECURSIVE hierarquia_eap AS (
         SELECT itens_eap.id,
            itens_eap.projeto_id,
            itens_eap.eap_codigo,
            itens_eap.eap_pai_codigo,
            itens_eap.e_analitico,
            itens_eap.id AS id_raiz,
            itens_eap.eap_codigo AS codigo_raiz
           FROM itens_eap
        UNION ALL
         SELECT e_1.id,
            e_1.projeto_id,
            e_1.eap_codigo,
            e_1.eap_pai_codigo,
            e_1.e_analitico,
            h.id_raiz,
            h.codigo_raiz
           FROM itens_eap e_1
             JOIN hierarquia_eap h ON e_1.eap_pai_codigo::text = h.eap_codigo::text AND e_1.projeto_id = h.projeto_id
        ), agregacao_contrato AS (
         SELECT h.id_raiz AS id,
            sum(e_1.valor_total_contratado) AS total_contratado_calc
           FROM hierarquia_eap h
             JOIN itens_eap e_1 ON h.id = e_1.id
          WHERE e_1.e_analitico = true
          GROUP BY h.id_raiz
        ), ultima_medicao AS (
         SELECT m.projeto_id,
            m.id AS medicao_id
           FROM ( SELECT medicoes.projeto_id,
                    medicoes.id,
                    row_number() OVER (PARTITION BY medicoes.projeto_id ORDER BY medicoes.numero_medicao DESC) AS rn
                   FROM medicoes
                  WHERE medicoes.status::text <> 'RASCUNHO'::text) m
          WHERE m.rn = 1
        ), agregacao_medicao AS (
         SELECT h.id_raiz AS id,
            sum(imd.valor_periodo) AS total_periodo_calc,
            sum(imd.valor_acumulado) AS total_acumulado_calc
           FROM hierarquia_eap h
             JOIN itens_eap e_1 ON h.id = e_1.id
             JOIN itens_medicao_detalhe imd ON imd.item_eap_id = e_1.id
             JOIN ultima_medicao um ON um.medicao_id = imd.medicao_id
          WHERE e_1.e_analitico = true
          GROUP BY h.id_raiz
        )
 SELECT e.projeto_id,
    p.nome_projeto,
    e.eap_codigo,
    e.descricao_servico,
    e.unidade_medida,
    e.preco_unitario,
    e.quantidade_contratada,
        CASE
            WHEN e.e_analitico THEN e.valor_total_contratado
            ELSE COALESCE(ac.total_contratado_calc, 0::numeric)
        END AS valor_total_contratado,
    e.e_analitico,
    COALESCE(am.total_periodo_calc, 0::numeric) AS medicao_corrente_valor,
    COALESCE(am.total_acumulado_calc, 0::numeric) AS medicao_acumulada_valor,
        CASE
            WHEN e.e_analitico THEN
            CASE
                WHEN e.valor_total_contratado > 0::numeric THEN COALESCE(am.total_acumulado_calc, 0::numeric) / e.valor_total_contratado * 100::numeric
                ELSE 0::numeric
            END
            ELSE
            CASE
                WHEN COALESCE(ac.total_contratado_calc, 0::numeric) > 0::numeric THEN COALESCE(am.total_acumulado_calc, 0::numeric) / ac.total_contratado_calc * 100::numeric
                ELSE 0::numeric
            END
        END AS percentual_executado_financeiro,
    e.data_execucao
   FROM itens_eap e
     LEFT JOIN projetos p ON e.projeto_id = p.id
     LEFT JOIN agregacao_contrato ac ON e.id = ac.id
     LEFT JOIN agregacao_medicao am ON e.id = am.id
  ORDER BY e.projeto_id, (string_to_array(regexp_replace(e.eap_codigo::text, '[^0-9\.]'::text, ''::text, 'g'::text), '.'::text)::integer[]);
