-- Adiciona data de inicio na tabela projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS data_inicio DATE NOT NULL DEFAULT CURRENT_DATE;

-- Adiciona colunas para controle do cronograma na tabela itens_eap
ALTER TABLE public.itens_eap ADD COLUMN IF NOT EXISTS predecessores JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.itens_eap ADD COLUMN IF NOT EXISTS data_inicio DATE;
ALTER TABLE public.itens_eap ADD COLUMN IF NOT EXISTS data_fim DATE;

-- Atualiza a view v_resumo_eap_medicao para incluir os novos campos
DROP VIEW IF EXISTS public.v_resumo_eap_medicao CASCADE;
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
    p.data_inicio AS projeto_data_inicio,
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
    e.data_execucao,
    e.duracao_dias,
    e.predecessores,
    e.data_inicio,
    e.data_fim,
    e.id AS item_eap_id
   FROM itens_eap e
     LEFT JOIN projetos p ON e.projeto_id = p.id
     LEFT JOIN agregacao_contrato ac ON e.id = ac.id
     LEFT JOIN agregacao_medicao am ON e.id = am.id
  ORDER BY e.projeto_id, (string_to_array(regexp_replace(e.eap_codigo::text, '[^0-9\.]'::text, ''::text, 'g'::text), '.'::text)::integer[]);

-- Restaurar permissões após DROP/CREATE
GRANT SELECT ON public.v_resumo_eap_medicao TO anon, authenticated, service_role;

-- Lógica para calcular a data_inicio e data_fim dos itens na EAP
CREATE OR REPLACE FUNCTION calc_datas_eap_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_data_inicio_projeto DATE;
    v_maior_data_fim DATE;
    v_pred_codigo TEXT;
    v_pred_id UUID;
    v_pred_data_fim DATE;
    v_predecessores_array JSONB;
BEGIN
    -- Busca a data de inicio do projeto associado
    SELECT data_inicio INTO v_data_inicio_projeto
    FROM projetos
    WHERE id = NEW.projeto_id;
    
    -- Se não encontrar data (por alguma anomalia), assume o dia atual
    IF v_data_inicio_projeto IS NULL THEN
        v_data_inicio_projeto := CURRENT_DATE;
    END IF;

    -- Extrai array de predecessores
    v_predecessores_array := NEW.predecessores;
    
    -- Determina a maior data fim entre os predecessores
    v_maior_data_fim := NULL;
    
    IF v_predecessores_array IS NOT NULL AND jsonb_array_length(v_predecessores_array) > 0 THEN
        FOR v_pred_codigo IN SELECT jsonb_array_elements_text(v_predecessores_array)
        LOOP
            -- Busca o item EAP correspondente a esse código dentro do mesmo projeto
            SELECT data_fim INTO v_pred_data_fim
            FROM itens_eap
            WHERE projeto_id = NEW.projeto_id AND eap_codigo = v_pred_codigo;
            
            IF v_pred_data_fim IS NOT NULL THEN
                IF v_maior_data_fim IS NULL OR v_pred_data_fim > v_maior_data_fim THEN
                    v_maior_data_fim := v_pred_data_fim;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Calcula data_inicio (maior data_fim predecessor + 1 dia, ou data_inicio_projeto)
    IF v_maior_data_fim IS NOT NULL THEN
        NEW.data_inicio := v_maior_data_fim + INTERVAL '1 day';
    ELSE
        NEW.data_inicio := v_data_inicio_projeto;
    END IF;

    -- Calcula data_fim (data_inicio + duracao_dias - 1 dia)
    -- Evita intervalo negativo se duracao_dias for menor ou igual a 0, assume minimo 1
    IF NEW.duracao_dias IS NULL OR NEW.duracao_dias <= 0 THEN
        NEW.duracao_dias := 1;
    END IF;
    
    NEW.data_fim := NEW.data_inicio + ((NEW.duracao_dias - 1) || ' days')::interval;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_datas_eap ON itens_eap;
CREATE TRIGGER trigger_calc_datas_eap
    BEFORE INSERT OR UPDATE
    ON itens_eap
    FOR EACH ROW
    EXECUTE FUNCTION calc_datas_eap_trigger();

-- Trigger para recálculo em cascata (se a data fim de um pai mudar, os dependentes devem ser avisados)
CREATE OR REPLACE FUNCTION calc_datas_eap_cascade_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.data_fim IS DISTINCT FROM NEW.data_fim THEN
        UPDATE itens_eap
        SET duracao_dias = duracao_dias
        WHERE projeto_id = NEW.projeto_id
          AND predecessores @> to_jsonb(NEW.eap_codigo::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_datas_eap_cascade ON itens_eap;
CREATE TRIGGER trigger_calc_datas_eap_cascade
    AFTER UPDATE OF data_fim
    ON itens_eap
    FOR EACH ROW
    EXECUTE FUNCTION calc_datas_eap_cascade_trigger();

-- Trigger para recalcular EAP quando a data_inicio do projeto for alterada
CREATE OR REPLACE FUNCTION recalcular_eap_projeto_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.data_inicio IS DISTINCT FROM NEW.data_inicio THEN
        UPDATE itens_eap
        SET duracao_dias = COALESCE(duracao_dias, 1)
        WHERE projeto_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalcular_eap_projeto ON projetos;
CREATE TRIGGER trigger_recalcular_eap_projeto
    AFTER UPDATE OF data_inicio
    ON projetos
    FOR EACH ROW
    EXECUTE FUNCTION recalcular_eap_projeto_trigger();

-- Forçar cálculo inicial de registros existentes
UPDATE public.itens_eap SET duracao_dias = COALESCE(duracao_dias, 1);

