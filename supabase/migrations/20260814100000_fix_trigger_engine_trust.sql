-- ==============================================================================
-- GESTOR DE OBRAS - Migration para resolver conflito Trigger vs Engine
-- Migração: 20260814100000
-- ==============================================================================

CREATE OR REPLACE FUNCTION calc_datas_eap_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_data_inicio_projeto DATE;
    v_pred_raw TEXT;
    v_pred_codigo TEXT;
    v_pred_tipo TEXT;
    v_pred_lag INT;
    v_pred_data_inicio DATE;
    v_pred_data_fim DATE;
    v_predecessores_array JSONB;
    v_req_inicio DATE;
    v_max_req_inicio DATE;
    v_base_inicio DATE;
    matches TEXT[];
BEGIN
    -- Se data_inicio, data_fim e duracao_dias já vierem consistentes do motor, confia e pula recálculo
    IF NEW.data_inicio IS NOT NULL AND NEW.data_fim IS NOT NULL AND NEW.duracao_dias IS NOT NULL THEN
        -- Verifica consistência básica: Fim = Inicio + Duracao - 1 (para dias >= 1)
        IF NEW.data_fim = NEW.data_inicio + ((GREATEST(1, NEW.duracao_dias) - 1) || ' days')::interval THEN
            -- Confia totalmente no motor (mantém sincronia com execucao)
            NEW.data_execucao := NEW.data_inicio;
            RETURN NEW;
        END IF;
    END IF;

    SELECT data_inicio INTO v_data_inicio_projeto
    FROM projetos
    WHERE id = NEW.projeto_id;
    
    IF v_data_inicio_projeto IS NULL THEN
        v_data_inicio_projeto := CURRENT_DATE;
    END IF;

    v_predecessores_array := NEW.predecessores;
    v_max_req_inicio := NULL;
    
    IF NEW.duracao_dias IS NULL OR NEW.duracao_dias <= 0 THEN
        NEW.duracao_dias := 1;
    END IF;

    IF v_predecessores_array IS NOT NULL AND jsonb_array_length(v_predecessores_array) > 0 THEN
        FOR v_pred_raw IN SELECT jsonb_array_elements_text(v_predecessores_array)
        LOOP
            SELECT regexp_match(v_pred_raw, '^([A-Za-z0-9\.]+?)(?:(FS|SS|FF|SF))?(?:([+-][0-9]+))?$') INTO matches;
            
            IF matches IS NOT NULL THEN
                v_pred_codigo := matches[1];
                v_pred_tipo := COALESCE(matches[2], 'FS');
                v_pred_lag := COALESCE(matches[3], '0')::int;
                
                -- Se o predecessor for um agrupador (macroetapa), obtém o intervalo real dos seus filhos analíticos
                SELECT MIN(data_inicio), MAX(data_fim) INTO v_pred_data_inicio, v_pred_data_fim
                FROM itens_eap
                WHERE projeto_id = NEW.projeto_id 
                  AND (eap_codigo = v_pred_codigo OR eap_codigo LIKE v_pred_codigo || '.%')
                  AND e_analitico = true;

                -- Fallback se for um item analítico direto sem filhos
                IF v_pred_data_inicio IS NULL OR v_pred_data_fim IS NULL THEN
                    SELECT data_inicio, data_fim INTO v_pred_data_inicio, v_pred_data_fim
                    FROM itens_eap
                    WHERE projeto_id = NEW.projeto_id AND eap_codigo = v_pred_codigo;
                END IF;
                
                IF v_pred_data_inicio IS NOT NULL AND v_pred_data_fim IS NOT NULL THEN
                    v_req_inicio := NULL;
                    
                    IF v_pred_tipo = 'FS' THEN
                        v_req_inicio := v_pred_data_fim + ((1 + v_pred_lag) || ' days')::interval;
                    ELSIF v_pred_tipo = 'SS' THEN
                        v_req_inicio := v_pred_data_inicio + (v_pred_lag || ' days')::interval;
                    ELSIF v_pred_tipo = 'FF' THEN
                        v_req_inicio := v_pred_data_fim + (v_pred_lag || ' days')::interval - ((NEW.duracao_dias - 1) || ' days')::interval;
                    ELSIF v_pred_tipo = 'SF' THEN
                        v_req_inicio := v_pred_data_inicio + (v_pred_lag || ' days')::interval - ((NEW.duracao_dias - 1) || ' days')::interval;
                    END IF;
                    
                    IF v_req_inicio IS NOT NULL THEN
                        IF v_max_req_inicio IS NULL OR v_req_inicio > v_max_req_inicio THEN
                            v_max_req_inicio := v_req_inicio;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Preserva a data_inicio definida pelo usuário desde que atenda o requisito mínimo de predecessora e projeto!
    v_base_inicio := COALESCE(NEW.data_inicio, NEW.data_execucao, v_max_req_inicio, v_data_inicio_projeto);
    
    IF v_max_req_inicio IS NOT NULL THEN
        NEW.data_inicio := GREATEST(v_base_inicio, v_max_req_inicio, v_data_inicio_projeto);
    ELSE
        NEW.data_inicio := GREATEST(v_base_inicio, v_data_inicio_projeto);
    END IF;

    -- Mantém data_execucao sincronizada
    NEW.data_execucao := NEW.data_inicio;

    -- Calcula data_fim com base na duração estipulada
    NEW.data_fim := NEW.data_inicio + ((NEW.duracao_dias - 1) || ' days')::interval;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
