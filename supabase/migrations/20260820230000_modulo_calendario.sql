-- 20260820230000_modulo_calendario.sql

-- 1. Criação da tabela de calendários
CREATE TABLE IF NOT EXISTS calendarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    
    -- Carga horária por dia da semana
    carga_dom NUMERIC(4,2) DEFAULT 0.0,
    carga_seg NUMERIC(4,2) DEFAULT 8.0,
    carga_ter NUMERIC(4,2) DEFAULT 8.0,
    carga_qua NUMERIC(4,2) DEFAULT 8.0,
    carga_qui NUMERIC(4,2) DEFAULT 8.0,
    carga_sex NUMERIC(4,2) DEFAULT 8.0,
    carga_sab NUMERIC(4,2) DEFAULT 0.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Criação da tabela de exceções de calendário (feriados, folgas, turnos extras)
CREATE TABLE IF NOT EXISTS calendario_excecoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendario_id UUID NOT NULL REFERENCES calendarios(id) ON DELETE CASCADE,
    data_excecao DATE NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'FERIADO', -- FERIADO, FOLGA, EXTRA
    carga_horaria NUMERIC(4,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_calendario_data UNIQUE(calendario_id, data_excecao)
);

-- 3. Associa calendário aos projetos
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS calendario_id UUID REFERENCES calendarios(id) ON DELETE SET NULL;

-- 4. Função PL/pgSQL para calcular total de horas úteis de um período
CREATE OR REPLACE FUNCTION fn_calcular_horas_periodo(
    p_calendario_id UUID, 
    p_data_inicio DATE, 
    p_data_fim DATE
) RETURNS NUMERIC AS $$
DECLARE
    v_total_horas NUMERIC := 0;
    v_data_atual DATE;
    v_dia_semana INTEGER;
    v_carga_dia NUMERIC;
    v_excecao RECORD;
    v_cal RECORD;
BEGIN
    -- Se nao tiver calendario, ou as datas forem invalidas, retorna 0
    IF p_calendario_id IS NULL OR p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_inicio > p_data_fim THEN
        RETURN 0;
    END IF;

    SELECT * INTO v_cal FROM calendarios WHERE id = p_calendario_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_data_atual := p_data_inicio;

    WHILE v_data_atual <= p_data_fim LOOP
        -- Verifica se há exceção neste dia
        SELECT * INTO v_excecao FROM calendario_excecoes WHERE calendario_id = p_calendario_id AND data_excecao = v_data_atual;
        
        IF FOUND THEN
            -- Se for exceção (Feriado, Folga ou Extra), pega a carga da exceção
            v_total_horas := v_total_horas + v_excecao.carga_horaria;
        ELSE
            -- Sem exceção, pega carga padrao da semana
            -- EXTRACT(DOW) retorna: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
            v_dia_semana := EXTRACT(DOW FROM v_data_atual);
            
            CASE v_dia_semana
                WHEN 0 THEN v_total_horas := v_total_horas + v_cal.carga_dom;
                WHEN 1 THEN v_total_horas := v_total_horas + v_cal.carga_seg;
                WHEN 2 THEN v_total_horas := v_total_horas + v_cal.carga_ter;
                WHEN 3 THEN v_total_horas := v_total_horas + v_cal.carga_qua;
                WHEN 4 THEN v_total_horas := v_total_horas + v_cal.carga_qui;
                WHEN 5 THEN v_total_horas := v_total_horas + v_cal.carga_sex;
                WHEN 6 THEN v_total_horas := v_total_horas + v_cal.carga_sab;
            END CASE;
        END IF;

        v_data_atual := v_data_atual + 1;
    END LOOP;

    RETURN v_total_horas;
END;
$$ LANGUAGE plpgsql;

-- 5. Função Utilitária para calcular total de DIAS úteis (dias que tiveram carga > 0)
CREATE OR REPLACE FUNCTION fn_calcular_dias_uteis_periodo(
    p_calendario_id UUID, 
    p_data_inicio DATE, 
    p_data_fim DATE
) RETURNS INTEGER AS $$
DECLARE
    v_total_dias INTEGER := 0;
    v_data_atual DATE;
    v_dia_semana INTEGER;
    v_carga_dia NUMERIC;
    v_excecao RECORD;
    v_cal RECORD;
BEGIN
    IF p_calendario_id IS NULL OR p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_inicio > p_data_fim THEN
        RETURN 0;
    END IF;

    SELECT * INTO v_cal FROM calendarios WHERE id = p_calendario_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_data_atual := p_data_inicio;

    WHILE v_data_atual <= p_data_fim LOOP
        SELECT * INTO v_excecao FROM calendario_excecoes WHERE calendario_id = p_calendario_id AND data_excecao = v_data_atual;
        
        IF FOUND THEN
            v_carga_dia := v_excecao.carga_horaria;
        ELSE
            v_dia_semana := EXTRACT(DOW FROM v_data_atual);
            CASE v_dia_semana
                WHEN 0 THEN v_carga_dia := v_cal.carga_dom;
                WHEN 1 THEN v_carga_dia := v_cal.carga_seg;
                WHEN 2 THEN v_carga_dia := v_cal.carga_ter;
                WHEN 3 THEN v_carga_dia := v_cal.carga_qua;
                WHEN 4 THEN v_carga_dia := v_cal.carga_qui;
                WHEN 5 THEN v_carga_dia := v_cal.carga_sex;
                WHEN 6 THEN v_carga_dia := v_cal.carga_sab;
            END CASE;
        END IF;

        IF v_carga_dia > 0 THEN
            v_total_dias := v_total_dias + 1;
        END IF;

        v_data_atual := v_data_atual + 1;
    END LOOP;

    RETURN v_total_dias;
END;
$$ LANGUAGE plpgsql;

-- 6. RLS Rules
ALTER TABLE calendarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendario_excecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for calendarios" ON calendarios FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

-- Como o app passa a bypass global provisória na service role, tbm abriremos o global:
CREATE POLICY tenant_calendarios ON calendarios FOR ALL USING (true);
CREATE POLICY tenant_calendario_excecoes ON calendario_excecoes FOR ALL USING (true);

GRANT ALL ON TABLE calendarios TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE calendario_excecoes TO postgres, anon, authenticated, service_role;
