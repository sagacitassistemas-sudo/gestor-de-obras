-- Migração para Cálculo Avançado de Cronogramas (PMO)
-- Suporta dependências FS, SS, FF, SF e Lags/Leads (ex: 1.1.1FS+2)

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

CREATE OR REPLACE FUNCTION calc_datas_eap_cascade_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.data_fim IS DISTINCT FROM NEW.data_fim OR OLD.data_inicio IS DISTINCT FROM NEW.data_inicio THEN
        UPDATE itens_eap
        SET duracao_dias = duracao_dias
        WHERE projeto_id = NEW.projeto_id
          AND EXISTS (
              SELECT 1 
              FROM jsonb_array_elements_text(predecessores) p 
              WHERE p ~ ('^' || replace(NEW.eap_codigo, '.', '\.') || '(FS|SS|FF|SF|[+-]|$)')
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para recálculo automático rigoroso de agrupadores (tarefas sintéticas com e_analitico = false)
-- Invariante estrito: Nenhuma tarefa sintética pode ter intervalo menor do que a abrangência total dos seus filhos.
CREATE OR REPLACE FUNCTION sync_summary_eap_dates_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_proj_id UUID;
BEGIN
    v_proj_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
    IF v_proj_id IS NULL THEN RETURN NULL; END IF;

    UPDATE itens_eap s
    SET 
        data_inicio = sub.min_start,
        data_execucao = sub.min_start,
        data_fim = sub.max_end,
        duracao_dias = GREATEST(1, (sub.max_end - sub.min_start + 1))
    FROM (
        SELECT 
            parent.id AS parent_id,
            MIN(child.data_inicio) AS min_start,
            MAX(child.data_fim) AS max_end
        FROM itens_eap parent
        JOIN itens_eap child ON child.projeto_id = parent.projeto_id 
                            AND child.eap_codigo LIKE parent.eap_codigo || '.%'
                            AND child.e_analitico = true
        WHERE parent.projeto_id = v_proj_id
          AND parent.e_analitico = false
        GROUP BY parent.id
    ) sub
    WHERE s.id = sub.parent_id
      AND (s.data_inicio IS DISTINCT FROM sub.min_start 
        OR s.data_fim IS DISTINCT FROM sub.max_end
        OR s.duracao_dias IS DISTINCT FROM GREATEST(1, (sub.max_end - sub.min_start + 1)));

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_datas_eap ON itens_eap;
CREATE TRIGGER trigger_calc_datas_eap
    BEFORE INSERT OR UPDATE
    ON itens_eap
    FOR EACH ROW
    EXECUTE FUNCTION calc_datas_eap_trigger();

DROP TRIGGER IF EXISTS trigger_calc_datas_eap_cascade ON itens_eap;
CREATE TRIGGER trigger_calc_datas_eap_cascade
    AFTER UPDATE OF data_fim, data_inicio
    ON itens_eap
    FOR EACH ROW
    EXECUTE FUNCTION calc_datas_eap_cascade_trigger();

DROP TRIGGER IF EXISTS trigger_sync_summary_eap_dates ON itens_eap;
CREATE TRIGGER trigger_sync_summary_eap_dates
    AFTER INSERT OR UPDATE OR DELETE
    ON itens_eap
    FOR EACH ROW
    EXECUTE FUNCTION sync_summary_eap_dates_trigger();

-- Forçar recálculo completo de todos os registros existentes
UPDATE public.itens_eap SET duracao_dias = COALESCE(duracao_dias, 1);
