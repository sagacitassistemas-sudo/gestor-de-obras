


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calc_datas_eap_cascade_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
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
$_$;


ALTER FUNCTION "public"."calc_datas_eap_cascade_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calc_datas_eap_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
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
$_$;


ALTER FUNCTION "public"."calc_datas_eap_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_funcionario_rdo_eligibility"("p_funcionario_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_media_comunicacao NUMERIC;
    v_cargo TEXT;
    v_result JSON;
BEGIN
    SELECT f.cargo INTO v_cargo FROM funcionarios f WHERE f.id = p_funcionario_id;

    -- Pega a média de comunicação da ÚLTIMA avaliação concluída
    SELECT AVG(ai.nota_alcancada) INTO v_media_comunicacao
    FROM avaliacao_itens ai
    JOIN competencias_catalogo cc ON ai.competencia_id = cc.id
    JOIN avaliacoes_desempenho ad ON ai.avaliacao_id = ad.id
    WHERE ad.funcionario_id = p_funcionario_id 
      AND ad.status = 'Concluido'
      AND cc.eixo = 'Comunicacao';

    v_media_comunicacao := COALESCE(v_media_comunicacao, 0);

    -- Regra de negócio descrita
    IF v_media_comunicacao >= 3 AND v_cargo IN ('Mestre de Obras', 'Coordenador de Campo', 'Técnico de Segurança') THEN
        v_result := json_build_object('can_sign_rdo', true, 'can_report_production', true, 'media_comunicacao', v_media_comunicacao);
    ELSIF v_media_comunicacao >= 3 THEN
        v_result := json_build_object('can_sign_rdo', false, 'can_report_production', true, 'media_comunicacao', v_media_comunicacao);
    ELSE
        v_result := json_build_object('can_sign_rdo', false, 'can_report_production', false, 'media_comunicacao', v_media_comunicacao);
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."check_funcionario_rdo_eligibility"("p_funcionario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalcular_eap_projeto_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.data_inicio IS DISTINCT FROM NEW.data_inicio THEN
        UPDATE itens_eap
        SET duracao_dias = COALESCE(duracao_dias, 1)
        WHERE projeto_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."recalcular_eap_projeto_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_summary_eap_dates_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_summary_eap_dates_trigger"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contrato_id" "text" NOT NULL,
    "usuario_uid" "text",
    "usuario_email" "text",
    "cod_evento" "text" NOT NULL,
    "descricao" "text",
    "entidade_tipo" "text",
    "entidade_id" "text",
    "ip_origem" "text",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avaliacao_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "avaliacao_id" "uuid" NOT NULL,
    "competencia_id" "uuid" NOT NULL,
    "nota_alcancada" integer,
    "observacao" "text",
    CONSTRAINT "avaliacao_itens_nota_alcancada_check" CHECK ((("nota_alcancada" >= 1) AND ("nota_alcancada" <= 5)))
);


ALTER TABLE "public"."avaliacao_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avaliacoes_desempenho" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "funcionario_id" "uuid" NOT NULL,
    "avaliador_uid" "text" NOT NULL,
    "data_avaliacao" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" character varying(50) DEFAULT 'Rascunho'::character varying,
    "observacao_geral" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "avaliacoes_desempenho_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Rascunho'::character varying, 'Concluido'::character varying])::"text"[])))
);


ALTER TABLE "public"."avaliacoes_desempenho" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cessoes_pessoal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "funcionario_id" "uuid" NOT NULL,
    "equipe_origem_id" "uuid" NOT NULL,
    "equipe_destino_id" "uuid" NOT NULL,
    "os_destino_id" "uuid",
    "data_inicio" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_fim" "date",
    "motivo" "text",
    "status" character varying(20) DEFAULT 'ATIVA'::character varying,
    "autorizado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cessoes_pessoal_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ATIVA'::character varying, 'ENCERRADA'::character varying, 'CANCELADA'::character varying])::"text"[]))),
    CONSTRAINT "diff_equipes" CHECK (("equipe_origem_id" <> "equipe_destino_id"))
);


ALTER TABLE "public"."cessoes_pessoal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competencias_catalogo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "especialidade_id" "uuid" NOT NULL,
    "eixo" character varying(50) NOT NULL,
    "descricao" "text" NOT NULL,
    "peso_esperado" integer DEFAULT 3,
    "treinamento_obrigatorio" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "competencias_catalogo_eixo_check" CHECK ((("eixo")::"text" = ANY ((ARRAY['Tecnicas'::character varying, 'Calculo'::character varying, 'Comunicacao'::character varying, 'SSMA'::character varying])::"text"[]))),
    CONSTRAINT "competencias_catalogo_peso_esperado_check" CHECK ((("peso_esperado" >= 1) AND ("peso_esperado" <= 5)))
);


ALTER TABLE "public"."competencias_catalogo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contratos_obra" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "fornecedor_id" "text" NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "numero_contrato" character varying(100) NOT NULL,
    "objeto" "text",
    "valor_global" numeric(15,2) DEFAULT 0.00,
    "data_assinatura" "date",
    "data_vigencia" "date",
    "status" character varying(30) DEFAULT 'VIGENTE'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contratos_obra_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['RASCUNHO'::character varying, 'VIGENTE'::character varying, 'ENCERRADO'::character varying, 'RESCINDIDO'::character varying, 'ADITIVO'::character varying])::"text"[])))
);


ALTER TABLE "public"."contratos_obra" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."convites" (
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "contrato_id" "text",
    "empresa_id" "text",
    "entidade_id" "text",
    "perfil" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDENTE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    CONSTRAINT "convites_status_check" CHECK (("status" = ANY (ARRAY['PENDENTE'::"text", 'USADO'::"text", 'EXPIRADO'::"text"])))
);


ALTER TABLE "public"."convites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cronograma_financeiro_semanas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "item_eap_id" "uuid" NOT NULL,
    "eap_codigo" character varying(100) NOT NULL,
    "semana_inicio" "date" NOT NULL,
    "semana_fim" "date" NOT NULL,
    "valor_planejado" numeric(15,2) DEFAULT 0.00,
    "valor_realizado" numeric(15,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."cronograma_financeiro_semanas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cronograma_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "versao" integer NOT NULL,
    "descricao" "text",
    "arquivo_url" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" "text"
);


ALTER TABLE "public"."cronograma_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dispositivos_mobile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "device_id" character varying(255) NOT NULL,
    "funcionario_id" "uuid",
    "status" character varying(50) DEFAULT 'PENDENTE'::character varying,
    "modelo" character varying(100),
    "os_version" character varying(50),
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dispositivos_mobile_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDENTE'::character varying, 'APROVADO'::character varying, 'BLOQUEADO'::character varying])::"text"[])))
);


ALTER TABLE "public"."dispositivos_mobile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa_contratante" (
    "contrato_id" "text" NOT NULL,
    "natureza" "text",
    "nome" "text" NOT NULL,
    "area" "text",
    "departamento" "text",
    "cnpj" "text",
    "email" "text",
    "telefone" "text",
    "gestor_responsavel" "text",
    "unidade_administrativa" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "empresa_contratante_natureza_check" CHECK (("natureza" = ANY (ARRAY['Privada'::"text", 'Publica'::"text"])))
);


ALTER TABLE "public"."empresa_contratante" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresas_fornecedores" (
    "id" "text" NOT NULL,
    "contrato_id" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "cnpj_cpf" "text" NOT NULL,
    "tipo" "text",
    "email_contato" "text",
    "telefone" "text",
    "status" "text" DEFAULT 'ATIVO'::"text",
    "total_faturado" numeric DEFAULT 0,
    "created_at" "text",
    "detalhes" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "empresas_fornecedores_status_check" CHECK (("status" = ANY (ARRAY['ATIVO'::"text", 'BLOQUEADO'::"text", 'EM_ANALISE'::"text"]))),
    CONSTRAINT "empresas_fornecedores_tipo_check" CHECK (("tipo" = ANY (ARRAY['FORNECEDOR'::"text", 'CLIENTE'::"text", 'PARCEIRO'::"text", 'CONTRATANTE'::"text"])))
);


ALTER TABLE "public"."empresas_fornecedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipe_membros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipe_id" "uuid" NOT NULL,
    "funcionario_id" "uuid" NOT NULL,
    "funcao_na_equipe" "text" DEFAULT 'MEMBRO'::"text",
    "adicionado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "equipe_membros_funcao_na_equipe_check" CHECK (("funcao_na_equipe" = ANY (ARRAY['LIDER'::"text", 'COORDENADOR'::"text", 'MEMBRO'::"text", 'SUPORTE_TECNICO'::"text", 'AUXILIAR'::"text"])))
);


ALTER TABLE "public"."equipe_membros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "empresa_id" "text" NOT NULL,
    "contrato_id" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "lider_id" "uuid",
    "status" "text" DEFAULT 'ATIVA'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "equipes_status_check" CHECK (("status" = ANY (ARRAY['ATIVA'::"text", 'INATIVA'::"text", 'EM_CAMPO'::"text"])))
);


ALTER TABLE "public"."equipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."especialidades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "cor" "text" DEFAULT '#005daa'::"text",
    "icone" "text" DEFAULT 'engineering'::"text",
    "status" "text" DEFAULT 'ATIVO'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "especialidades_status_check" CHECK (("status" = ANY (ARRAY['ATIVO'::"text", 'INATIVO'::"text"])))
);


ALTER TABLE "public"."especialidades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funcionario_treinamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "funcionario_id" "uuid" NOT NULL,
    "nome_curso" character varying(100) NOT NULL,
    "data_conclusao" "date" NOT NULL,
    "data_vencimento" "date" NOT NULL,
    "certificado_url" "text",
    "status" character varying(50) DEFAULT 'Regular'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."funcionario_treinamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funcionarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "empresa_id" "text" NOT NULL,
    "contrato_id" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "cpf" character varying(14),
    "cargo" "text",
    "telefone" character varying(20),
    "email" "text",
    "especialidade_id" "uuid",
    "data_admissao" "date",
    "status" "text" DEFAULT 'ATIVO'::"text",
    "foto_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "funcionarios_status_check" CHECK (("status" = ANY (ARRAY['ATIVO'::"text", 'INATIVO'::"text", 'AFASTADO'::"text"])))
);


ALTER TABLE "public"."funcionarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_eap" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "eap_codigo" character varying(100) NOT NULL,
    "eap_pai_codigo" character varying(100),
    "descricao_servico" "text" NOT NULL,
    "unidade_medida" character varying(20),
    "preco_unitario" numeric(15,2) DEFAULT 0.00,
    "quantidade_contratada" numeric(15,4) DEFAULT 0.0000,
    "valor_total_contratado" numeric(15,2) DEFAULT 0.00,
    "e_analitico" boolean DEFAULT false NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "data_execucao" "date",
    "duracao_dias" integer DEFAULT 1,
    "predecessores" "jsonb" DEFAULT '[]'::"jsonb",
    "data_inicio" "date",
    "data_fim" "date",
    "percentual_executado_financeiro" numeric(5,2) DEFAULT 0.00,
    "valor_desembolsado" numeric(15,2) DEFAULT 0.00,
    "data_inicio_financeiro" "date",
    "data_fim_financeiro" "date",
    CONSTRAINT "chk_analitico_valores" CHECK ((("e_analitico" = false) OR (("e_analitico" = true) AND ("unidade_medida" IS NOT NULL))))
);


ALTER TABLE "public"."itens_eap" OWNER TO "postgres";


COMMENT ON COLUMN "public"."itens_eap"."data_inicio_financeiro" IS 'Data de início do desembolso financeiro (pode diferir do cronograma executivo)';



COMMENT ON COLUMN "public"."itens_eap"."data_fim_financeiro" IS 'Data de fim do desembolso financeiro (pode diferir do cronograma executivo)';



CREATE TABLE IF NOT EXISTS "public"."itens_medicao_detalhe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "medicao_id" "uuid" NOT NULL,
    "item_eap_id" "uuid" NOT NULL,
    "quantidade_periodo" numeric(15,4) DEFAULT 0.0000 NOT NULL,
    "valor_periodo" numeric(15,2) DEFAULT 0.00 NOT NULL,
    "quantidade_acumulada" numeric(15,4) DEFAULT 0.0000 NOT NULL,
    "valor_acumulado" numeric(15,2) DEFAULT 0.00 NOT NULL,
    "percentual_executado_acumulado" numeric(8,4) DEFAULT 0.0000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."itens_medicao_detalhe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medicoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "numero_medicao" integer NOT NULL,
    "data_medicao" "date" NOT NULL,
    "periodo_inicio" "date" NOT NULL,
    "periodo_fim" "date" NOT NULL,
    "status" character varying(50) DEFAULT 'RASCUNHO'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "contrato_obra_id" "uuid"
);


ALTER TABLE "public"."medicoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordens_servico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "item_eap_id" "uuid" NOT NULL,
    "numero_os" character varying(100) NOT NULL,
    "descricao" "text",
    "status" character varying(50) DEFAULT 'Emitida'::character varying,
    "data_emissao" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "equipe_id" "uuid",
    "materiais" "text",
    "ferramentas" "text",
    "equipamentos" "text",
    "responsavel_rdo_id" "uuid",
    "valor_materiais" numeric(15,2) DEFAULT 0.00,
    "valor_ferramentas" numeric(15,2) DEFAULT 0.00,
    "valor_equipamentos" numeric(15,2) DEFAULT 0.00
);


ALTER TABLE "public"."ordens_servico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissoes_contratante" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contrato_id" "text" NOT NULL,
    "empresas_criar" boolean DEFAULT false,
    "empresas_ler" boolean DEFAULT false,
    "empresas_editar" boolean DEFAULT false,
    "empresas_excluir" boolean DEFAULT false,
    "projetos_criar" boolean DEFAULT false,
    "projetos_ler" boolean DEFAULT false,
    "projetos_editar" boolean DEFAULT false,
    "projetos_excluir" boolean DEFAULT false,
    "medicoes_criar" boolean DEFAULT false,
    "medicoes_ler" boolean DEFAULT false,
    "medicoes_editar" boolean DEFAULT false,
    "medicoes_excluir" boolean DEFAULT false,
    "financeiro_criar" boolean DEFAULT false,
    "financeiro_ler" boolean DEFAULT false,
    "financeiro_editar" boolean DEFAULT false,
    "financeiro_excluir" boolean DEFAULT false,
    "relatorios_ler" boolean DEFAULT false,
    "usuarios_criar" boolean DEFAULT false,
    "usuarios_ler" boolean DEFAULT false,
    "usuarios_editar" boolean DEFAULT false,
    "usuarios_excluir" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cronogramas_criar" boolean DEFAULT false,
    "cronogramas_ler" boolean DEFAULT false,
    "cronogramas_editar" boolean DEFAULT false,
    "cronogramas_excluir" boolean DEFAULT false,
    "rdo_criar" boolean DEFAULT false,
    "rdo_ler" boolean DEFAULT false,
    "rdo_editar" boolean DEFAULT false,
    "rdo_excluir" boolean DEFAULT false,
    "os_criar" boolean DEFAULT false,
    "os_ler" boolean DEFAULT false,
    "os_editar" boolean DEFAULT false,
    "os_excluir" boolean DEFAULT false,
    "contratos_criar" boolean DEFAULT false,
    "contratos_ler" boolean DEFAULT false,
    "contratos_editar" boolean DEFAULT false,
    "contratos_excluir" boolean DEFAULT false,
    "entidades_criar" boolean DEFAULT false,
    "entidades_ler" boolean DEFAULT false,
    "entidades_editar" boolean DEFAULT false,
    "entidades_excluir" boolean DEFAULT false,
    "configuracoes_criar" boolean DEFAULT false,
    "configuracoes_ler" boolean DEFAULT false,
    "configuracoes_editar" boolean DEFAULT false,
    "configuracoes_excluir" boolean DEFAULT false
);


ALTER TABLE "public"."permissoes_contratante" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissoes_empresa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contrato_id" "text" NOT NULL,
    "empresa_id" "text" NOT NULL,
    "empresas_criar" boolean DEFAULT false,
    "empresas_ler" boolean DEFAULT false,
    "empresas_editar" boolean DEFAULT false,
    "empresas_excluir" boolean DEFAULT false,
    "projetos_criar" boolean DEFAULT false,
    "projetos_ler" boolean DEFAULT false,
    "projetos_editar" boolean DEFAULT false,
    "projetos_excluir" boolean DEFAULT false,
    "medicoes_criar" boolean DEFAULT false,
    "medicoes_ler" boolean DEFAULT false,
    "medicoes_editar" boolean DEFAULT false,
    "medicoes_excluir" boolean DEFAULT false,
    "financeiro_criar" boolean DEFAULT false,
    "financeiro_ler" boolean DEFAULT false,
    "financeiro_editar" boolean DEFAULT false,
    "financeiro_excluir" boolean DEFAULT false,
    "relatorios_ler" boolean DEFAULT false,
    "usuarios_criar" boolean DEFAULT false,
    "usuarios_ler" boolean DEFAULT false,
    "usuarios_editar" boolean DEFAULT false,
    "usuarios_excluir" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cronogramas_criar" boolean DEFAULT false,
    "cronogramas_ler" boolean DEFAULT false,
    "cronogramas_editar" boolean DEFAULT false,
    "cronogramas_excluir" boolean DEFAULT false,
    "rdo_criar" boolean DEFAULT false,
    "rdo_ler" boolean DEFAULT false,
    "rdo_editar" boolean DEFAULT false,
    "rdo_excluir" boolean DEFAULT false,
    "os_criar" boolean DEFAULT false,
    "os_ler" boolean DEFAULT false,
    "os_editar" boolean DEFAULT false,
    "os_excluir" boolean DEFAULT false,
    "contratos_criar" boolean DEFAULT false,
    "contratos_ler" boolean DEFAULT false,
    "contratos_editar" boolean DEFAULT false,
    "contratos_excluir" boolean DEFAULT false,
    "entidades_criar" boolean DEFAULT false,
    "entidades_ler" boolean DEFAULT false,
    "entidades_editar" boolean DEFAULT false,
    "entidades_excluir" boolean DEFAULT false,
    "configuracoes_criar" boolean DEFAULT false,
    "configuracoes_ler" boolean DEFAULT false,
    "configuracoes_editar" boolean DEFAULT false,
    "configuracoes_excluir" boolean DEFAULT false
);


ALTER TABLE "public"."permissoes_empresa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissoes_tipo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contrato_id" "text" NOT NULL,
    "perfil" "text" NOT NULL,
    "empresas_criar" boolean DEFAULT false,
    "empresas_ler" boolean DEFAULT false,
    "empresas_editar" boolean DEFAULT false,
    "empresas_excluir" boolean DEFAULT false,
    "projetos_criar" boolean DEFAULT false,
    "projetos_ler" boolean DEFAULT false,
    "projetos_editar" boolean DEFAULT false,
    "projetos_excluir" boolean DEFAULT false,
    "medicoes_criar" boolean DEFAULT false,
    "medicoes_ler" boolean DEFAULT false,
    "medicoes_editar" boolean DEFAULT false,
    "medicoes_excluir" boolean DEFAULT false,
    "financeiro_criar" boolean DEFAULT false,
    "financeiro_ler" boolean DEFAULT false,
    "financeiro_editar" boolean DEFAULT false,
    "financeiro_excluir" boolean DEFAULT false,
    "relatorios_ler" boolean DEFAULT false,
    "usuarios_criar" boolean DEFAULT false,
    "usuarios_ler" boolean DEFAULT false,
    "usuarios_editar" boolean DEFAULT false,
    "usuarios_excluir" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cronogramas_criar" boolean DEFAULT false,
    "cronogramas_ler" boolean DEFAULT false,
    "cronogramas_editar" boolean DEFAULT false,
    "cronogramas_excluir" boolean DEFAULT false,
    "rdo_criar" boolean DEFAULT false,
    "rdo_ler" boolean DEFAULT false,
    "rdo_editar" boolean DEFAULT false,
    "rdo_excluir" boolean DEFAULT false,
    "os_criar" boolean DEFAULT false,
    "os_ler" boolean DEFAULT false,
    "os_editar" boolean DEFAULT false,
    "os_excluir" boolean DEFAULT false,
    "contratos_criar" boolean DEFAULT false,
    "contratos_ler" boolean DEFAULT false,
    "contratos_editar" boolean DEFAULT false,
    "contratos_excluir" boolean DEFAULT false,
    "entidades_criar" boolean DEFAULT false,
    "entidades_ler" boolean DEFAULT false,
    "entidades_editar" boolean DEFAULT false,
    "entidades_excluir" boolean DEFAULT false,
    "configuracoes_criar" boolean DEFAULT false,
    "configuracoes_ler" boolean DEFAULT false,
    "configuracoes_editar" boolean DEFAULT false,
    "configuracoes_excluir" boolean DEFAULT false
);


ALTER TABLE "public"."permissoes_tipo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissoes_usuario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_uid" "text" NOT NULL,
    "contrato_id" "text" NOT NULL,
    "empresa_id" "text",
    "empresas_criar" boolean DEFAULT false,
    "empresas_ler" boolean DEFAULT false,
    "empresas_editar" boolean DEFAULT false,
    "empresas_excluir" boolean DEFAULT false,
    "projetos_criar" boolean DEFAULT false,
    "projetos_ler" boolean DEFAULT false,
    "projetos_editar" boolean DEFAULT false,
    "projetos_excluir" boolean DEFAULT false,
    "medicoes_criar" boolean DEFAULT false,
    "medicoes_ler" boolean DEFAULT false,
    "medicoes_editar" boolean DEFAULT false,
    "medicoes_excluir" boolean DEFAULT false,
    "financeiro_criar" boolean DEFAULT false,
    "financeiro_ler" boolean DEFAULT false,
    "financeiro_editar" boolean DEFAULT false,
    "financeiro_excluir" boolean DEFAULT false,
    "relatorios_ler" boolean DEFAULT false,
    "usuarios_criar" boolean DEFAULT false,
    "usuarios_ler" boolean DEFAULT false,
    "usuarios_editar" boolean DEFAULT false,
    "usuarios_excluir" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cronogramas_criar" boolean DEFAULT false,
    "cronogramas_ler" boolean DEFAULT false,
    "cronogramas_editar" boolean DEFAULT false,
    "cronogramas_excluir" boolean DEFAULT false,
    "rdo_criar" boolean DEFAULT false,
    "rdo_ler" boolean DEFAULT false,
    "rdo_editar" boolean DEFAULT false,
    "rdo_excluir" boolean DEFAULT false,
    "os_criar" boolean DEFAULT false,
    "os_ler" boolean DEFAULT false,
    "os_editar" boolean DEFAULT false,
    "os_excluir" boolean DEFAULT false,
    "contratos_criar" boolean DEFAULT false,
    "contratos_ler" boolean DEFAULT false,
    "contratos_editar" boolean DEFAULT false,
    "contratos_excluir" boolean DEFAULT false,
    "entidades_criar" boolean DEFAULT false,
    "entidades_ler" boolean DEFAULT false,
    "entidades_editar" boolean DEFAULT false,
    "entidades_excluir" boolean DEFAULT false,
    "configuracoes_criar" boolean DEFAULT false,
    "configuracoes_ler" boolean DEFAULT false,
    "configuracoes_editar" boolean DEFAULT false,
    "configuracoes_excluir" boolean DEFAULT false
);


ALTER TABLE "public"."permissoes_usuario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projetos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_projeto" character varying(255) NOT NULL,
    "data_inicio" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" "text" NOT NULL,
    "codigo_projeto" character varying(50),
    "empresa_id" "text"
);


ALTER TABLE "public"."projetos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rdo_frentes_servico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "rdo_id" "uuid" NOT NULL,
    "funcionario_id" "uuid" NOT NULL,
    "papel" character varying(50),
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rdo_frentes_servico_papel_check" CHECK ((("papel")::"text" = ANY ((ARRAY['Assinante'::character varying, 'Apontador_Producao'::character varying, 'Membro'::character varying])::"text"[])))
);


ALTER TABLE "public"."rdo_frentes_servico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rdo_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "rdo_id" "uuid" NOT NULL,
    "item_eap_id" "uuid" NOT NULL,
    "qtd_medida" numeric(15,4) DEFAULT 0 NOT NULL,
    "valor_unitario_contrato" numeric(15,2) DEFAULT 0 NOT NULL,
    "valor_total_dia" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."rdo_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rdo_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rdo_item_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."rdo_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rdos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "projeto_id" "uuid" NOT NULL,
    "numero_rdo" character varying(100) NOT NULL,
    "data_rdo" "date" DEFAULT CURRENT_DATE NOT NULL,
    "responsavel_id" "uuid",
    "clima_manha" character varying(50),
    "clima_tarde" character varying(50),
    "status" character varying(50) DEFAULT 'Rascunho'::character varying,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "ordem_servico_id" "uuid",
    "responsavel_rdo_id" "uuid"
);


ALTER TABLE "public"."rdos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ref_cargos_salarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uf" character varying(2) NOT NULL,
    "codigo_cbo" character varying(10) NOT NULL,
    "nome_cargo" character varying(150) NOT NULL,
    "salario_piso" numeric(12,2),
    "salario_medio" numeric(12,2),
    "salario_maior" numeric(12,2),
    "cuai_valor" numeric(8,2),
    "fc_valor" numeric(8,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ref_cargos_salarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ref_matriz_encargos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uf" character varying(2) NOT NULL,
    "codigo_item" character varying(10),
    "grupo" character(1) NOT NULL,
    "descricao" character varying(255),
    "pct_com_deson_horista" numeric(6,4),
    "pct_com_deson_mensalista" numeric(6,4),
    "pct_sem_deson_horista" numeric(6,4),
    "pct_sem_deson_mensalista" numeric(6,4),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ref_matriz_encargos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sistema_eventos_catalogo" (
    "cod_evento" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "categoria" "text" NOT NULL
);


ALTER TABLE "public"."sistema_eventos_catalogo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_error_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contrato_id" "text",
    "usuario_uid" "text",
    "cod_evento" "text" NOT NULL,
    "rota" "text",
    "mensagem" "text" NOT NULL,
    "stack_trace" "text",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_error_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_bdi_configuracao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "obra_id" "uuid",
    "tipo_composicao" character varying(20) DEFAULT 'SERVICO'::character varying NOT NULL,
    "pct_administracao_central" numeric(6,4) DEFAULT 0,
    "pct_seguros_garantias" numeric(6,4) DEFAULT 0,
    "pct_riscos" numeric(6,4) DEFAULT 0,
    "pct_despesas_financeiras" numeric(6,4) DEFAULT 0,
    "pct_lucro" numeric(6,4) DEFAULT 0,
    "pct_iss" numeric(6,4) DEFAULT 0,
    "pct_pis" numeric(6,4) DEFAULT 0,
    "pct_cofins" numeric(6,4) DEFAULT 0,
    "pct_cprb" numeric(6,4) DEFAULT 0,
    "bdi_calculado" numeric(6,4) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_bdi_configuracao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_cargos_salarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "obra_id" "uuid",
    "ref_cargo_id" "uuid",
    "codigo_cbo" character varying(10),
    "nome_cargo" character varying(150) NOT NULL,
    "salario_base_adotado" numeric(12,2),
    "cuai_adotado" numeric(8,2),
    "fc_adotado" numeric(8,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_cargos_salarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "uid" "text" NOT NULL,
    "email" "text" NOT NULL,
    "nome" "text",
    "foto_url" "text",
    "contrato_id" "text",
    "perfil" "text" DEFAULT 'FORNECEDOR'::"text" NOT NULL,
    "status" "text" DEFAULT 'ATIVO'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "claims_pendentes" boolean DEFAULT false,
    "empresa_id" "text",
    CONSTRAINT "usuarios_status_check" CHECK (("status" = ANY (ARRAY['ATIVO'::"text", 'INATIVO'::"text", 'BLOQUEADO'::"text", 'PENDENTE'::"text"])))
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usuarios"."claims_pendentes" IS 'Sinaliza que os customClaims no Firebase estão desatualizados e devem ser re-sincronizados no próximo login.';



CREATE OR REPLACE VIEW "public"."v_contratos_obra_resumo" AS
 SELECT "co"."id" AS "contrato_obra_id",
    "co"."tenant_id",
    "co"."numero_contrato",
    "co"."objeto",
    "co"."valor_global",
    "co"."data_assinatura",
    "co"."data_vigencia",
    "co"."status" AS "contrato_status",
    "ef"."nome" AS "fornecedor_nome",
    "ef"."cnpj_cpf" AS "fornecedor_cnpj",
    "p"."id" AS "projeto_id",
    "p"."nome_projeto",
    COALESCE("med_agg"."total_medicoes", (0)::bigint) AS "total_medicoes",
    COALESCE("med_agg"."valor_acumulado", (0)::numeric) AS "medicao_valor_acumulado",
        CASE
            WHEN ("co"."valor_global" > (0)::numeric) THEN "round"(((COALESCE("med_agg"."valor_acumulado", (0)::numeric) / "co"."valor_global") * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "percentual_executado"
   FROM ((("public"."contratos_obra" "co"
     JOIN "public"."empresas_fornecedores" "ef" ON ((("ef"."id" = "co"."fornecedor_id") AND ("ef"."contrato_id" = "co"."tenant_id"))))
     JOIN "public"."projetos" "p" ON (("p"."id" = "co"."projeto_id")))
     LEFT JOIN LATERAL ( SELECT "count"(*) AS "total_medicoes",
            "sum"("imd"."valor_acumulado") AS "valor_acumulado"
           FROM ("public"."medicoes" "m"
             JOIN "public"."itens_medicao_detalhe" "imd" ON (("imd"."medicao_id" = "m"."id")))
          WHERE (("m"."contrato_obra_id" = "co"."id") AND ("m"."numero_medicao" = ( SELECT "max"("medicoes"."numero_medicao") AS "max"
                   FROM "public"."medicoes"
                  WHERE (("medicoes"."contrato_obra_id" = "co"."id") AND (("medicoes"."status")::"text" <> 'RASCUNHO'::"text")))))) "med_agg" ON (true));


ALTER VIEW "public"."v_contratos_obra_resumo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_permissoes_efetivas" AS
 SELECT "pu"."usuario_uid",
    "pu"."contrato_id",
    "pu"."empresa_id",
    "u"."email",
    "u"."nome",
    "u"."perfil",
    ("pu"."empresas_criar" AND "pe"."empresas_criar" AND "pc"."empresas_criar") AS "empresas_criar",
    ("pu"."empresas_ler" AND "pe"."empresas_ler" AND "pc"."empresas_ler") AS "empresas_ler",
    ("pu"."empresas_editar" AND "pe"."empresas_editar" AND "pc"."empresas_editar") AS "empresas_editar",
    ("pu"."empresas_excluir" AND "pe"."empresas_excluir" AND "pc"."empresas_excluir") AS "empresas_excluir",
    ("pu"."projetos_criar" AND "pe"."projetos_criar" AND "pc"."projetos_criar") AS "projetos_criar",
    ("pu"."projetos_ler" AND "pe"."projetos_ler" AND "pc"."projetos_ler") AS "projetos_ler",
    ("pu"."projetos_editar" AND "pe"."projetos_editar" AND "pc"."projetos_editar") AS "projetos_editar",
    ("pu"."projetos_excluir" AND "pe"."projetos_excluir" AND "pc"."projetos_excluir") AS "projetos_excluir",
    ("pu"."medicoes_criar" AND "pe"."medicoes_criar" AND "pc"."medicoes_criar") AS "medicoes_criar",
    ("pu"."medicoes_ler" AND "pe"."medicoes_ler" AND "pc"."medicoes_ler") AS "medicoes_ler",
    ("pu"."medicoes_editar" AND "pe"."medicoes_editar" AND "pc"."medicoes_editar") AS "medicoes_editar",
    ("pu"."medicoes_excluir" AND "pe"."medicoes_excluir" AND "pc"."medicoes_excluir") AS "medicoes_excluir",
    ("pu"."financeiro_criar" AND "pe"."financeiro_criar" AND "pc"."financeiro_criar") AS "financeiro_criar",
    ("pu"."financeiro_ler" AND "pe"."financeiro_ler" AND "pc"."financeiro_ler") AS "financeiro_ler",
    ("pu"."financeiro_editar" AND "pe"."financeiro_editar" AND "pc"."financeiro_editar") AS "financeiro_editar",
    ("pu"."financeiro_excluir" AND "pe"."financeiro_excluir" AND "pc"."financeiro_excluir") AS "financeiro_excluir",
    ("pu"."relatorios_ler" AND "pe"."relatorios_ler" AND "pc"."relatorios_ler") AS "relatorios_ler",
    ("pu"."usuarios_criar" AND "pe"."usuarios_criar" AND "pc"."usuarios_criar") AS "usuarios_criar",
    ("pu"."usuarios_ler" AND "pe"."usuarios_ler" AND "pc"."usuarios_ler") AS "usuarios_ler",
    ("pu"."usuarios_editar" AND "pe"."usuarios_editar" AND "pc"."usuarios_editar") AS "usuarios_editar",
    ("pu"."usuarios_excluir" AND "pe"."usuarios_excluir" AND "pc"."usuarios_excluir") AS "usuarios_excluir",
    ("pu"."cronogramas_criar" AND "pe"."cronogramas_criar" AND "pc"."cronogramas_criar") AS "cronogramas_criar",
    ("pu"."cronogramas_ler" AND "pe"."cronogramas_ler" AND "pc"."cronogramas_ler") AS "cronogramas_ler",
    ("pu"."cronogramas_editar" AND "pe"."cronogramas_editar" AND "pc"."cronogramas_editar") AS "cronogramas_editar",
    ("pu"."cronogramas_excluir" AND "pe"."cronogramas_excluir" AND "pc"."cronogramas_excluir") AS "cronogramas_excluir",
    ("pu"."rdo_criar" AND "pe"."rdo_criar" AND "pc"."rdo_criar") AS "rdo_criar",
    ("pu"."rdo_ler" AND "pe"."rdo_ler" AND "pc"."rdo_ler") AS "rdo_ler",
    ("pu"."rdo_editar" AND "pe"."rdo_editar" AND "pc"."rdo_editar") AS "rdo_editar",
    ("pu"."rdo_excluir" AND "pe"."rdo_excluir" AND "pc"."rdo_excluir") AS "rdo_excluir",
    ("pu"."os_criar" AND "pe"."os_criar" AND "pc"."os_criar") AS "os_criar",
    ("pu"."os_ler" AND "pe"."os_ler" AND "pc"."os_ler") AS "os_ler",
    ("pu"."os_editar" AND "pe"."os_editar" AND "pc"."os_editar") AS "os_editar",
    ("pu"."os_excluir" AND "pe"."os_excluir" AND "pc"."os_excluir") AS "os_excluir",
    ("pu"."contratos_criar" AND "pe"."contratos_criar" AND "pc"."contratos_criar") AS "contratos_criar",
    ("pu"."contratos_ler" AND "pe"."contratos_ler" AND "pc"."contratos_ler") AS "contratos_ler",
    ("pu"."contratos_editar" AND "pe"."contratos_editar" AND "pc"."contratos_editar") AS "contratos_editar",
    ("pu"."contratos_excluir" AND "pe"."contratos_excluir" AND "pc"."contratos_excluir") AS "contratos_excluir",
    ("pu"."entidades_criar" AND "pe"."entidades_criar" AND "pc"."entidades_criar") AS "entidades_criar",
    ("pu"."entidades_ler" AND "pe"."entidades_ler" AND "pc"."entidades_ler") AS "entidades_ler",
    ("pu"."entidades_editar" AND "pe"."entidades_editar" AND "pc"."entidades_editar") AS "entidades_editar",
    ("pu"."entidades_excluir" AND "pe"."entidades_excluir" AND "pc"."entidades_excluir") AS "entidades_excluir",
    ("pu"."configuracoes_criar" AND "pe"."configuracoes_criar" AND "pc"."configuracoes_criar") AS "configuracoes_criar",
    ("pu"."configuracoes_ler" AND "pe"."configuracoes_ler" AND "pc"."configuracoes_ler") AS "configuracoes_ler",
    ("pu"."configuracoes_editar" AND "pe"."configuracoes_editar" AND "pc"."configuracoes_editar") AS "configuracoes_editar",
    ("pu"."configuracoes_excluir" AND "pe"."configuracoes_excluir" AND "pc"."configuracoes_excluir") AS "configuracoes_excluir"
   FROM ((("public"."permissoes_usuario" "pu"
     JOIN "public"."permissoes_empresa" "pe" ON ((("pe"."empresa_id" = "pu"."empresa_id") AND ("pe"."contrato_id" = "pu"."contrato_id"))))
     JOIN "public"."permissoes_contratante" "pc" ON (("pc"."contrato_id" = "pu"."contrato_id")))
     JOIN "public"."usuarios" "u" ON (("u"."uid" = "pu"."usuario_uid")))
  WHERE ("pu"."empresa_id" IS NOT NULL)
UNION ALL
 SELECT "pu"."usuario_uid",
    "pu"."contrato_id",
    "pu"."empresa_id",
    "u"."email",
    "u"."nome",
    "u"."perfil",
    ("pu"."empresas_criar" AND "pc"."empresas_criar") AS "empresas_criar",
    ("pu"."empresas_ler" AND "pc"."empresas_ler") AS "empresas_ler",
    ("pu"."empresas_editar" AND "pc"."empresas_editar") AS "empresas_editar",
    ("pu"."empresas_excluir" AND "pc"."empresas_excluir") AS "empresas_excluir",
    ("pu"."projetos_criar" AND "pc"."projetos_criar") AS "projetos_criar",
    ("pu"."projetos_ler" AND "pc"."projetos_ler") AS "projetos_ler",
    ("pu"."projetos_editar" AND "pc"."projetos_editar") AS "projetos_editar",
    ("pu"."projetos_excluir" AND "pc"."projetos_excluir") AS "projetos_excluir",
    ("pu"."medicoes_criar" AND "pc"."medicoes_criar") AS "medicoes_criar",
    ("pu"."medicoes_ler" AND "pc"."medicoes_ler") AS "medicoes_ler",
    ("pu"."medicoes_editar" AND "pc"."medicoes_editar") AS "medicoes_editar",
    ("pu"."medicoes_excluir" AND "pc"."medicoes_excluir") AS "medicoes_excluir",
    ("pu"."financeiro_criar" AND "pc"."financeiro_criar") AS "financeiro_criar",
    ("pu"."financeiro_ler" AND "pc"."financeiro_ler") AS "financeiro_ler",
    ("pu"."financeiro_editar" AND "pc"."financeiro_editar") AS "financeiro_editar",
    ("pu"."financeiro_excluir" AND "pc"."financeiro_excluir") AS "financeiro_excluir",
    ("pu"."relatorios_ler" AND "pc"."relatorios_ler") AS "relatorios_ler",
    ("pu"."usuarios_criar" AND "pc"."usuarios_criar") AS "usuarios_criar",
    ("pu"."usuarios_ler" AND "pc"."usuarios_ler") AS "usuarios_ler",
    ("pu"."usuarios_editar" AND "pc"."usuarios_editar") AS "usuarios_editar",
    ("pu"."usuarios_excluir" AND "pc"."usuarios_excluir") AS "usuarios_excluir",
    ("pu"."cronogramas_criar" AND "pc"."cronogramas_criar") AS "cronogramas_criar",
    ("pu"."cronogramas_ler" AND "pc"."cronogramas_ler") AS "cronogramas_ler",
    ("pu"."cronogramas_editar" AND "pc"."cronogramas_editar") AS "cronogramas_editar",
    ("pu"."cronogramas_excluir" AND "pc"."cronogramas_excluir") AS "cronogramas_excluir",
    ("pu"."rdo_criar" AND "pc"."rdo_criar") AS "rdo_criar",
    ("pu"."rdo_ler" AND "pc"."rdo_ler") AS "rdo_ler",
    ("pu"."rdo_editar" AND "pc"."rdo_editar") AS "rdo_editar",
    ("pu"."rdo_excluir" AND "pc"."rdo_excluir") AS "rdo_excluir",
    ("pu"."os_criar" AND "pc"."os_criar") AS "os_criar",
    ("pu"."os_ler" AND "pc"."os_ler") AS "os_ler",
    ("pu"."os_editar" AND "pc"."os_editar") AS "os_editar",
    ("pu"."os_excluir" AND "pc"."os_excluir") AS "os_excluir",
    ("pu"."contratos_criar" AND "pc"."contratos_criar") AS "contratos_criar",
    ("pu"."contratos_ler" AND "pc"."contratos_ler") AS "contratos_ler",
    ("pu"."contratos_editar" AND "pc"."contratos_editar") AS "contratos_editar",
    ("pu"."contratos_excluir" AND "pc"."contratos_excluir") AS "contratos_excluir",
    ("pu"."entidades_criar" AND "pc"."entidades_criar") AS "entidades_criar",
    ("pu"."entidades_ler" AND "pc"."entidades_ler") AS "entidades_ler",
    ("pu"."entidades_editar" AND "pc"."entidades_editar") AS "entidades_editar",
    ("pu"."entidades_excluir" AND "pc"."entidades_excluir") AS "entidades_excluir",
    ("pu"."configuracoes_criar" AND "pc"."configuracoes_criar") AS "configuracoes_criar",
    ("pu"."configuracoes_ler" AND "pc"."configuracoes_ler") AS "configuracoes_ler",
    ("pu"."configuracoes_editar" AND "pc"."configuracoes_editar") AS "configuracoes_editar",
    ("pu"."configuracoes_excluir" AND "pc"."configuracoes_excluir") AS "configuracoes_excluir"
   FROM (("public"."permissoes_usuario" "pu"
     JOIN "public"."permissoes_contratante" "pc" ON (("pc"."contrato_id" = "pu"."contrato_id")))
     JOIN "public"."usuarios" "u" ON (("u"."uid" = "pu"."usuario_uid")))
  WHERE ("pu"."empresa_id" IS NULL);


ALTER VIEW "public"."v_permissoes_efetivas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_rdo_totais_por_projeto" AS
 SELECT "r"."projeto_id",
    "r"."id" AS "rdo_id",
    "r"."data_rdo",
    "r"."status",
    COALESCE("sum"("ri"."valor_total_dia"), (0)::numeric) AS "valor_total_rdo"
   FROM ("public"."rdos" "r"
     LEFT JOIN "public"."rdo_items" "ri" ON (("ri"."rdo_id" = "r"."id")))
  GROUP BY "r"."projeto_id", "r"."id", "r"."data_rdo", "r"."status";


ALTER VIEW "public"."v_rdo_totais_por_projeto" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_resumo_eap_medicao" AS
 WITH RECURSIVE "hierarquia_eap" AS (
         SELECT "itens_eap"."id",
            "itens_eap"."projeto_id",
            "itens_eap"."eap_codigo",
            "itens_eap"."eap_pai_codigo",
            "itens_eap"."e_analitico",
            "itens_eap"."id" AS "id_raiz",
            "itens_eap"."eap_codigo" AS "codigo_raiz"
           FROM "public"."itens_eap"
        UNION ALL
         SELECT "e_1"."id",
            "e_1"."projeto_id",
            "e_1"."eap_codigo",
            "e_1"."eap_pai_codigo",
            "e_1"."e_analitico",
            "h"."id_raiz",
            "h"."codigo_raiz"
           FROM ("public"."itens_eap" "e_1"
             JOIN "hierarquia_eap" "h" ON (((("e_1"."eap_pai_codigo")::"text" = ("h"."eap_codigo")::"text") AND ("e_1"."projeto_id" = "h"."projeto_id"))))
        ), "agregacao_contrato" AS (
         SELECT "h"."id_raiz" AS "id",
            "sum"("e_1"."valor_total_contratado") AS "total_contratado_calc"
           FROM ("hierarquia_eap" "h"
             JOIN "public"."itens_eap" "e_1" ON (("h"."id" = "e_1"."id")))
          WHERE ("e_1"."e_analitico" = true)
          GROUP BY "h"."id_raiz"
        ), "ultima_medicao" AS (
         SELECT "m"."projeto_id",
            "m"."id" AS "medicao_id"
           FROM ( SELECT "medicoes"."projeto_id",
                    "medicoes"."id",
                    "row_number"() OVER (PARTITION BY "medicoes"."projeto_id" ORDER BY "medicoes"."numero_medicao" DESC) AS "rn"
                   FROM "public"."medicoes"
                  WHERE (("medicoes"."status")::"text" <> 'RASCUNHO'::"text")) "m"
          WHERE ("m"."rn" = 1)
        ), "agregacao_medicao" AS (
         SELECT "h"."id_raiz" AS "id",
            "sum"("imd"."valor_periodo") AS "total_periodo_calc",
            "sum"("imd"."valor_acumulado") AS "total_acumulado_calc"
           FROM ((("hierarquia_eap" "h"
             JOIN "public"."itens_eap" "e_1" ON (("h"."id" = "e_1"."id")))
             JOIN "public"."itens_medicao_detalhe" "imd" ON (("imd"."item_eap_id" = "e_1"."id")))
             JOIN "ultima_medicao" "um" ON (("um"."medicao_id" = "imd"."medicao_id")))
          WHERE ("e_1"."e_analitico" = true)
          GROUP BY "h"."id_raiz"
        )
 SELECT "e"."projeto_id",
    "p"."nome_projeto",
    "p"."data_inicio" AS "projeto_data_inicio",
    "e"."eap_codigo",
    "e"."descricao_servico",
    "e"."unidade_medida",
    "e"."preco_unitario",
    "e"."quantidade_contratada",
        CASE
            WHEN "e"."e_analitico" THEN "e"."valor_total_contratado"
            ELSE COALESCE("ac"."total_contratado_calc", (0)::numeric)
        END AS "valor_total_contratado",
    "e"."e_analitico",
    COALESCE("am"."total_periodo_calc", (0)::numeric) AS "medicao_corrente_valor",
    COALESCE("am"."total_acumulado_calc", (0)::numeric) AS "medicao_acumulada_valor",
        CASE
            WHEN "e"."e_analitico" THEN
            CASE
                WHEN ("e"."valor_total_contratado" > (0)::numeric) THEN ((COALESCE("am"."total_acumulado_calc", (0)::numeric) / "e"."valor_total_contratado") * (100)::numeric)
                ELSE (0)::numeric
            END
            ELSE
            CASE
                WHEN (COALESCE("ac"."total_contratado_calc", (0)::numeric) > (0)::numeric) THEN ((COALESCE("am"."total_acumulado_calc", (0)::numeric) / "ac"."total_contratado_calc") * (100)::numeric)
                ELSE (0)::numeric
            END
        END AS "percentual_executado_financeiro",
    "e"."data_execucao",
    "e"."duracao_dias",
    "e"."predecessores",
    "e"."data_inicio",
    "e"."data_fim",
    "e"."id" AS "item_eap_id"
   FROM ((("public"."itens_eap" "e"
     LEFT JOIN "public"."projetos" "p" ON (("e"."projeto_id" = "p"."id")))
     LEFT JOIN "agregacao_contrato" "ac" ON (("e"."id" = "ac"."id")))
     LEFT JOIN "agregacao_medicao" "am" ON (("e"."id" = "am"."id")))
  ORDER BY "e"."projeto_id", ("string_to_array"("regexp_replace"(("e"."eap_codigo")::"text", '[^0-9\.]'::"text", ''::"text", 'g'::"text"), '.'::"text"))::integer[];


ALTER VIEW "public"."v_resumo_eap_medicao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."validacoes_desenvolvedor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "agente" "text" DEFAULT 'Antigravity'::"text" NOT NULL,
    "status" "text" DEFAULT 'PENDENTE'::"text" NOT NULL,
    "notas_validacao" "text",
    "link_referencia" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "validado_em" timestamp with time zone,
    "responsavel_uid" "text",
    CONSTRAINT "validacoes_desenvolvedor_status_check" CHECK (("status" = ANY (ARRAY['PENDENTE'::"text", 'VALIDADO'::"text", 'FALHOU'::"text"])))
);


ALTER TABLE "public"."validacoes_desenvolvedor" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacao_itens"
    ADD CONSTRAINT "avaliacao_item_unico" UNIQUE ("avaliacao_id", "competencia_id");



ALTER TABLE ONLY "public"."avaliacao_itens"
    ADD CONSTRAINT "avaliacao_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacoes_desempenho"
    ADD CONSTRAINT "avaliacoes_desempenho_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cessoes_pessoal"
    ADD CONSTRAINT "cessoes_pessoal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competencias_catalogo"
    ADD CONSTRAINT "comp_catalogo_unico" UNIQUE ("tenant_id", "especialidade_id", "eixo", "descricao");



ALTER TABLE ONLY "public"."competencias_catalogo"
    ADD CONSTRAINT "competencias_catalogo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contratos_obra"
    ADD CONSTRAINT "contratos_obra_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."convites"
    ADD CONSTRAINT "convites_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."cronograma_financeiro_semanas"
    ADD CONSTRAINT "cronograma_financeiro_semanas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cronograma_versions"
    ADD CONSTRAINT "cronograma_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cronograma_versions"
    ADD CONSTRAINT "cronograma_versions_projeto_id_versao_key" UNIQUE ("projeto_id", "versao");



ALTER TABLE ONLY "public"."dispositivos_mobile"
    ADD CONSTRAINT "dispositivos_mobile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa_contratante"
    ADD CONSTRAINT "empresa_contratante_pkey" PRIMARY KEY ("contrato_id");



ALTER TABLE ONLY "public"."empresas_fornecedores"
    ADD CONSTRAINT "empresas_fornecedores_pkey" PRIMARY KEY ("id", "contrato_id");



ALTER TABLE ONLY "public"."equipe_membros"
    ADD CONSTRAINT "equipe_membro_unico" UNIQUE ("equipe_id", "funcionario_id");



ALTER TABLE ONLY "public"."equipe_membros"
    ADD CONSTRAINT "equipe_membros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_nome_empresa_unico" UNIQUE ("tenant_id", "empresa_id", "nome");



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."especialidades"
    ADD CONSTRAINT "especialidades_nome_unico" UNIQUE ("tenant_id", "nome");



ALTER TABLE ONLY "public"."especialidades"
    ADD CONSTRAINT "especialidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funcionario_treinamentos"
    ADD CONSTRAINT "funcionario_treinamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funcionarios"
    ADD CONSTRAINT "funcionarios_cpf_unico" UNIQUE ("tenant_id", "cpf");



ALTER TABLE ONLY "public"."funcionarios"
    ADD CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itens_eap"
    ADD CONSTRAINT "itens_eap_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itens_medicao_detalhe"
    ADD CONSTRAINT "itens_medicao_detalhe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medicoes"
    ADD CONSTRAINT "medicoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_numero_unico" UNIQUE ("projeto_id", "numero_os");



ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissoes_contratante"
    ADD CONSTRAINT "permissoes_contratante_contrato_id_key" UNIQUE ("contrato_id");



ALTER TABLE ONLY "public"."permissoes_contratante"
    ADD CONSTRAINT "permissoes_contratante_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissoes_empresa"
    ADD CONSTRAINT "permissoes_empresa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissoes_tipo"
    ADD CONSTRAINT "permissoes_tipo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissoes_usuario"
    ADD CONSTRAINT "permissoes_usuario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rdo_frentes_servico"
    ADD CONSTRAINT "rdo_frente_unica" UNIQUE ("rdo_id", "funcionario_id");



ALTER TABLE ONLY "public"."rdo_frentes_servico"
    ADD CONSTRAINT "rdo_frentes_servico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rdo_items"
    ADD CONSTRAINT "rdo_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rdo_photos"
    ADD CONSTRAINT "rdo_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rdos"
    ADD CONSTRAINT "rdos_numero_unico_por_projeto" UNIQUE ("projeto_id", "numero_rdo");



ALTER TABLE ONLY "public"."rdos"
    ADD CONSTRAINT "rdos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_cargos_salarios"
    ADD CONSTRAINT "ref_cargos_salarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_cargos_salarios"
    ADD CONSTRAINT "ref_cargos_uf_cbo_unico" UNIQUE ("uf", "codigo_cbo");



ALTER TABLE ONLY "public"."ref_matriz_encargos"
    ADD CONSTRAINT "ref_encargos_uf_item_unico" UNIQUE ("uf", "codigo_item");



ALTER TABLE ONLY "public"."ref_matriz_encargos"
    ADD CONSTRAINT "ref_matriz_encargos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sistema_eventos_catalogo"
    ADD CONSTRAINT "sistema_eventos_catalogo_pkey" PRIMARY KEY ("cod_evento");



ALTER TABLE ONLY "public"."system_error_log"
    ADD CONSTRAINT "system_error_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_bdi_configuracao"
    ADD CONSTRAINT "tenant_bdi_configuracao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_cargos_salarios"
    ADD CONSTRAINT "tenant_cargos_salarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dispositivos_mobile"
    ADD CONSTRAINT "uk_device_tenant" UNIQUE ("tenant_id", "device_id");



ALTER TABLE ONLY "public"."permissoes_tipo"
    ADD CONSTRAINT "unique_contrato_perfil_tipo" UNIQUE ("contrato_id", "perfil");



ALTER TABLE ONLY "public"."itens_medicao_detalhe"
    ADD CONSTRAINT "unique_item_por_medicao" UNIQUE ("medicao_id", "item_eap_id");



ALTER TABLE ONLY "public"."contratos_obra"
    ADD CONSTRAINT "unique_numero_contrato_tenant" UNIQUE ("numero_contrato", "tenant_id");



ALTER TABLE ONLY "public"."medicoes"
    ADD CONSTRAINT "unique_numero_medicao_por_projeto" UNIQUE ("projeto_id", "numero_medicao");



ALTER TABLE ONLY "public"."permissoes_empresa"
    ADD CONSTRAINT "unique_permissao_empresa" UNIQUE ("empresa_id", "contrato_id");



ALTER TABLE ONLY "public"."permissoes_usuario"
    ADD CONSTRAINT "unique_permissao_usuario" UNIQUE ("usuario_uid", "contrato_id");



ALTER TABLE ONLY "public"."cronograma_financeiro_semanas"
    ADD CONSTRAINT "unique_semana_por_item" UNIQUE ("item_eap_id", "semana_inicio");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("uid");



ALTER TABLE ONLY "public"."validacoes_desenvolvedor"
    ADD CONSTRAINT "validacoes_desenvolvedor_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_log_contrato_data" ON "public"."audit_log" USING "btree" ("contrato_id", "criado_em" DESC);



CREATE INDEX "idx_audit_log_usuario" ON "public"."audit_log" USING "btree" ("usuario_uid");



CREATE INDEX "idx_cessoes_equipe_destino" ON "public"."cessoes_pessoal" USING "btree" ("equipe_destino_id");



CREATE INDEX "idx_cessoes_equipe_origem" ON "public"."cessoes_pessoal" USING "btree" ("equipe_origem_id");



CREATE INDEX "idx_cessoes_funcionario" ON "public"."cessoes_pessoal" USING "btree" ("funcionario_id");



CREATE INDEX "idx_cessoes_status" ON "public"."cessoes_pessoal" USING "btree" ("status");



CREATE INDEX "idx_cfs_item" ON "public"."cronograma_financeiro_semanas" USING "btree" ("item_eap_id");



CREATE INDEX "idx_cfs_projeto" ON "public"."cronograma_financeiro_semanas" USING "btree" ("projeto_id");



CREATE INDEX "idx_empresas_fornecedores_detalhes" ON "public"."empresas_fornecedores" USING "gin" ("detalhes");



CREATE INDEX "idx_itens_eap_pai" ON "public"."itens_eap" USING "btree" ("projeto_id", "eap_pai_codigo");



CREATE OR REPLACE TRIGGER "trigger_calc_datas_eap" BEFORE INSERT OR UPDATE ON "public"."itens_eap" FOR EACH ROW EXECUTE FUNCTION "public"."calc_datas_eap_trigger"();



CREATE OR REPLACE TRIGGER "trigger_calc_datas_eap_cascade" AFTER UPDATE OF "data_fim", "data_inicio" ON "public"."itens_eap" FOR EACH ROW EXECUTE FUNCTION "public"."calc_datas_eap_cascade_trigger"();



CREATE OR REPLACE TRIGGER "trigger_recalcular_eap_projeto" AFTER UPDATE OF "data_inicio" ON "public"."projetos" FOR EACH ROW EXECUTE FUNCTION "public"."recalcular_eap_projeto_trigger"();



CREATE OR REPLACE TRIGGER "trigger_sync_summary_eap_dates" AFTER INSERT OR DELETE OR UPDATE ON "public"."itens_eap" FOR EACH ROW EXECUTE FUNCTION "public"."sync_summary_eap_dates_trigger"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_cod_evento_fkey" FOREIGN KEY ("cod_evento") REFERENCES "public"."sistema_eventos_catalogo"("cod_evento") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."avaliacao_itens"
    ADD CONSTRAINT "avaliacao_itens_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."avaliacoes_desempenho"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacao_itens"
    ADD CONSTRAINT "avaliacao_itens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "public"."competencias_catalogo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes_desempenho"
    ADD CONSTRAINT "avaliacoes_desempenho_avaliador_uid_fkey" FOREIGN KEY ("avaliador_uid") REFERENCES "public"."usuarios"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes_desempenho"
    ADD CONSTRAINT "avaliacoes_desempenho_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes_desempenho"
    ADD CONSTRAINT "avaliacoes_desempenho_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cessoes_pessoal"
    ADD CONSTRAINT "cessoes_pessoal_autorizado_por_fkey" FOREIGN KEY ("autorizado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cessoes_pessoal"
    ADD CONSTRAINT "cessoes_pessoal_equipe_destino_id_fkey" FOREIGN KEY ("equipe_destino_id") REFERENCES "public"."equipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cessoes_pessoal"
    ADD CONSTRAINT "cessoes_pessoal_equipe_origem_id_fkey" FOREIGN KEY ("equipe_origem_id") REFERENCES "public"."equipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cessoes_pessoal"
    ADD CONSTRAINT "cessoes_pessoal_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cessoes_pessoal"
    ADD CONSTRAINT "cessoes_pessoal_os_destino_id_fkey" FOREIGN KEY ("os_destino_id") REFERENCES "public"."ordens_servico"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cessoes_pessoal"
    ADD CONSTRAINT "cessoes_pessoal_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competencias_catalogo"
    ADD CONSTRAINT "competencias_catalogo_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "public"."especialidades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competencias_catalogo"
    ADD CONSTRAINT "competencias_catalogo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contratos_obra"
    ADD CONSTRAINT "contratos_obra_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contratos_obra"
    ADD CONSTRAINT "contratos_obra_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cronograma_financeiro_semanas"
    ADD CONSTRAINT "cronograma_financeiro_semanas_item_eap_id_fkey" FOREIGN KEY ("item_eap_id") REFERENCES "public"."itens_eap"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cronograma_financeiro_semanas"
    ADD CONSTRAINT "cronograma_financeiro_semanas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cronograma_versions"
    ADD CONSTRAINT "cronograma_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."usuarios"("uid") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cronograma_versions"
    ADD CONSTRAINT "cronograma_versions_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dispositivos_mobile"
    ADD CONSTRAINT "dispositivos_mobile_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dispositivos_mobile"
    ADD CONSTRAINT "dispositivos_mobile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresas_fornecedores"
    ADD CONSTRAINT "empresas_fornecedores_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipe_membros"
    ADD CONSTRAINT "equipe_membros_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipe_membros"
    ADD CONSTRAINT "equipe_membros_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_lider_id_fkey" FOREIGN KEY ("lider_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."especialidades"
    ADD CONSTRAINT "especialidades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contratos_obra"
    ADD CONSTRAINT "fk_contrato_fornecedor" FOREIGN KEY ("fornecedor_id", "tenant_id") REFERENCES "public"."empresas_fornecedores"("id", "contrato_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "fk_equipe_empresa" FOREIGN KEY ("empresa_id", "contrato_id") REFERENCES "public"."empresas_fornecedores"("id", "contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funcionarios"
    ADD CONSTRAINT "fk_func_empresa" FOREIGN KEY ("empresa_id", "contrato_id") REFERENCES "public"."empresas_fornecedores"("id", "contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissoes_empresa"
    ADD CONSTRAINT "fk_pe_empresa" FOREIGN KEY ("empresa_id", "contrato_id") REFERENCES "public"."empresas_fornecedores"("id", "contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "fk_projetos_empresa" FOREIGN KEY ("empresa_id", "tenant_id") REFERENCES "public"."empresas_fornecedores"("id", "contrato_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "fk_usuarios_empresa" FOREIGN KEY ("empresa_id", "contrato_id") REFERENCES "public"."empresas_fornecedores"("id", "contrato_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."funcionario_treinamentos"
    ADD CONSTRAINT "funcionario_treinamentos_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funcionario_treinamentos"
    ADD CONSTRAINT "funcionario_treinamentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funcionarios"
    ADD CONSTRAINT "funcionarios_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "public"."especialidades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."funcionarios"
    ADD CONSTRAINT "funcionarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_eap"
    ADD CONSTRAINT "itens_eap_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_medicao_detalhe"
    ADD CONSTRAINT "itens_medicao_detalhe_item_eap_id_fkey" FOREIGN KEY ("item_eap_id") REFERENCES "public"."itens_eap"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."itens_medicao_detalhe"
    ADD CONSTRAINT "itens_medicao_detalhe_medicao_id_fkey" FOREIGN KEY ("medicao_id") REFERENCES "public"."medicoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medicoes"
    ADD CONSTRAINT "medicoes_contrato_obra_id_fkey" FOREIGN KEY ("contrato_obra_id") REFERENCES "public"."contratos_obra"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medicoes"
    ADD CONSTRAINT "medicoes_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_item_eap_id_fkey" FOREIGN KEY ("item_eap_id") REFERENCES "public"."itens_eap"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_responsavel_rdo_id_fkey" FOREIGN KEY ("responsavel_rdo_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."permissoes_contratante"
    ADD CONSTRAINT "permissoes_contratante_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissoes_tipo"
    ADD CONSTRAINT "permissoes_tipo_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissoes_usuario"
    ADD CONSTRAINT "permissoes_usuario_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissoes_usuario"
    ADD CONSTRAINT "permissoes_usuario_usuario_uid_fkey" FOREIGN KEY ("usuario_uid") REFERENCES "public"."usuarios"("uid") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projetos"
    ADD CONSTRAINT "projetos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdo_frentes_servico"
    ADD CONSTRAINT "rdo_frentes_servico_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdo_frentes_servico"
    ADD CONSTRAINT "rdo_frentes_servico_rdo_id_fkey" FOREIGN KEY ("rdo_id") REFERENCES "public"."rdos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdo_items"
    ADD CONSTRAINT "rdo_items_item_eap_id_fkey" FOREIGN KEY ("item_eap_id") REFERENCES "public"."itens_eap"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdo_items"
    ADD CONSTRAINT "rdo_items_rdo_id_fkey" FOREIGN KEY ("rdo_id") REFERENCES "public"."rdos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdo_photos"
    ADD CONSTRAINT "rdo_photos_rdo_item_id_fkey" FOREIGN KEY ("rdo_item_id") REFERENCES "public"."rdo_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdos"
    ADD CONSTRAINT "rdos_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "public"."ordens_servico"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdos"
    ADD CONSTRAINT "rdos_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdos"
    ADD CONSTRAINT "rdos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rdos"
    ADD CONSTRAINT "rdos_responsavel_rdo_id_fkey" FOREIGN KEY ("responsavel_rdo_id") REFERENCES "public"."funcionarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_error_log"
    ADD CONSTRAINT "system_error_log_cod_evento_fkey" FOREIGN KEY ("cod_evento") REFERENCES "public"."sistema_eventos_catalogo"("cod_evento") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tenant_bdi_configuracao"
    ADD CONSTRAINT "tenant_bdi_configuracao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_cargos_salarios"
    ADD CONSTRAINT "tenant_cargos_salarios_ref_cargo_id_fkey" FOREIGN KEY ("ref_cargo_id") REFERENCES "public"."ref_cargos_salarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_cargos_salarios"
    ADD CONSTRAINT "tenant_cargos_salarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."empresa_contratante"("contrato_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."validacoes_desenvolvedor"
    ADD CONSTRAINT "validacoes_desenvolvedor_responsavel_uid_fkey" FOREIGN KEY ("responsavel_uid") REFERENCES "public"."usuarios"("uid");



CREATE POLICY "Admin pode ler audit log do tenant" ON "public"."audit_log" FOR SELECT USING ((("contrato_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")) AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'perfil'::"text") = 'ADMIN'::"text")));



CREATE POLICY "Admin pode ler erros do tenant" ON "public"."system_error_log" FOR SELECT USING (((("contrato_id" IS NULL) OR ("contrato_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"))) AND ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'perfil'::"text") = 'ADMIN'::"text")));



CREATE POLICY "Delete access to rdo_photos for tenant" ON "public"."rdo_photos" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."rdo_items" "ri"
  WHERE (("ri"."id" = "rdo_photos"."rdo_item_id") AND (("ri"."tenant_id")::"text" = "current_setting"('app.current_tenant'::"text", true))))));



CREATE POLICY "Insert access to rdo_photos for tenant" ON "public"."rdo_photos" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rdo_items" "ri"
  WHERE (("ri"."id" = "rdo_photos"."rdo_item_id") AND (("ri"."tenant_id")::"text" = "current_setting"('app.current_tenant'::"text", true))))));



CREATE POLICY "Permite acesso no tenant" ON "public"."permissoes_empresa" USING (("contrato_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")));



CREATE POLICY "Permite acesso no tenant" ON "public"."permissoes_usuario" USING (("contrato_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")));



CREATE POLICY "Permite leitura a todos logados no tenant" ON "public"."permissoes_tipo" FOR SELECT USING (("contrato_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")));



CREATE POLICY "Permite leitura/escrita a todos logados no tenant (simplificado" ON "public"."permissoes_contratante" USING (("contrato_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")));



CREATE POLICY "Read access to rdo_photos for tenant" ON "public"."rdo_photos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."rdo_items" "ri"
  WHERE (("ri"."id" = "rdo_photos"."rdo_item_id") AND (("ri"."tenant_id")::"text" = "current_setting"('app.current_tenant'::"text", true))))));



CREATE POLICY "Service Role pode inserir erros" ON "public"."system_error_log" FOR INSERT WITH CHECK (((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Tenant isolation for cessoes_pessoal" ON "public"."cessoes_pessoal" USING ((("tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true))) WITH CHECK ((("tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true)));



CREATE POLICY "Tenant isolation for rdo_items" ON "public"."rdo_items" USING ((("tenant_id")::"text" = "current_setting"('app.current_tenant'::"text", true))) WITH CHECK ((("tenant_id")::"text" = "current_setting"('app.current_tenant'::"text", true)));



CREATE POLICY "Update access to rdo_photos for tenant" ON "public"."rdo_photos" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."rdo_items" "ri"
  WHERE (("ri"."id" = "rdo_photos"."rdo_item_id") AND (("ri"."tenant_id")::"text" = "current_setting"('app.current_tenant'::"text", true))))));



CREATE POLICY "Usuários autenticados podem inserir" ON "public"."audit_log" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "admin_all_convites" ON "public"."convites" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios" "u"
  WHERE (("u"."uid" = "current_setting"('request.jwt.claim.sub'::"text", true)) AND ("u"."perfil" = 'ADMIN'::"text")))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avaliacao_itens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avaliacoes_desempenho" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cessoes_pessoal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competencias_catalogo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contratos_obra" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."convites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cronograma_financeiro_semanas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cronograma_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dispositivos_mobile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresa_contratante" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresas_fornecedores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipe_membros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."especialidades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funcionario_treinamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funcionarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itens_eap" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itens_medicao_detalhe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medicoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ordens_servico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissoes_contratante" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissoes_empresa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissoes_tipo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissoes_usuario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projetos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rdo_frentes_servico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rdo_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rdo_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rdos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_cargos_salarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ref_cargos_select" ON "public"."ref_cargos_salarios" FOR SELECT USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "ref_encargos_select" ON "public"."ref_matriz_encargos" FOR SELECT USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR ("auth"."role"() = 'authenticated'::"text")));



ALTER TABLE "public"."ref_matriz_encargos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_error_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_avaliacao_itens" ON "public"."avaliacao_itens" USING ((EXISTS ( SELECT 1
   FROM "public"."avaliacoes_desempenho" "a"
  WHERE (("a"."id" = "avaliacao_itens"."avaliacao_id") AND (("a"."tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true))))));



CREATE POLICY "tenant_avaliacoes" ON "public"."avaliacoes_desempenho" USING ((("tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true)));



ALTER TABLE "public"."tenant_bdi_configuracao" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_bdi_rls" ON "public"."tenant_bdi_configuracao" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (("tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_cargos_rls" ON "public"."tenant_cargos_salarios" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (("tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



ALTER TABLE "public"."tenant_cargos_salarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_cfs_policy" ON "public"."cronograma_financeiro_semanas" USING (("projeto_id" IN ( SELECT "projetos"."id"
   FROM "public"."projetos"
  WHERE ("projetos"."tenant_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")))));



CREATE POLICY "tenant_competencias" ON "public"."competencias_catalogo" USING ((("tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true)));



CREATE POLICY "tenant_contratante" ON "public"."empresa_contratante" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR ("contrato_id" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_contratos_obra" ON "public"."contratos_obra" USING (("tenant_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")));



CREATE POLICY "tenant_cronograma_versions" ON "public"."cronograma_versions" USING (("projeto_id" IN ( SELECT "projetos"."id"
   FROM "public"."projetos"
  WHERE ("projetos"."tenant_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")))));



CREATE POLICY "tenant_dispositivos" ON "public"."dispositivos_mobile" USING ((("tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true)));



CREATE POLICY "tenant_equipe_membros" ON "public"."equipe_membros" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."equipes" "e"
  WHERE (("e"."id" = "equipe_membros"."equipe_id") AND (("e"."tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text")))))));



CREATE POLICY "tenant_equipes" ON "public"."equipes" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (("tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_especialidades" ON "public"."especialidades" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (("tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_fornecedores" ON "public"."empresas_fornecedores" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR ("contrato_id" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_funcionarios" ON "public"."funcionarios" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (("tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_itens_eap" ON "public"."itens_eap" USING (("projeto_id" IN ( SELECT "projetos"."id"
   FROM "public"."projetos"
  WHERE ("projetos"."tenant_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")))));



CREATE POLICY "tenant_itens_medicao" ON "public"."itens_medicao_detalhe" USING (("medicao_id" IN ( SELECT "medicoes"."id"
   FROM "public"."medicoes"
  WHERE ("medicoes"."contrato_obra_id" IN ( SELECT "contratos_obra"."id"
           FROM "public"."contratos_obra"
          WHERE ("contratos_obra"."tenant_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")))))));



CREATE POLICY "tenant_medicoes" ON "public"."medicoes" USING (("contrato_obra_id" IN ( SELECT "contratos_obra"."id"
   FROM "public"."contratos_obra"
  WHERE ("contratos_obra"."tenant_id" = (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text")))));



CREATE POLICY "tenant_ordens_servico" ON "public"."ordens_servico" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (("tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_projetos" ON "public"."projetos" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR ("tenant_id" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_rdo_frentes" ON "public"."rdo_frentes_servico" USING ((("tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true)));



CREATE POLICY "tenant_rdos" ON "public"."rdos" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (("tenant_id")::"text" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_treinamentos" ON "public"."funcionario_treinamentos" USING ((("tenant_id")::"text" = "current_setting"('app.current_contrato_id'::"text", true)));



CREATE POLICY "tenant_usuarios" ON "public"."usuarios" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR ("contrato_id" = COALESCE(NULLIF((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'contrato_id'::"text"), ''::"text"), NULLIF("current_setting"('request.jwt.claim.contrato_id'::"text", true), ''::"text"), 'CTR-2026-SYS'::"text"))));



CREATE POLICY "tenant_validacoes_desenvolvedor" ON "public"."validacoes_desenvolvedor" USING ((("current_setting"('role'::"text", true) = 'service_role'::"text") OR ("auth"."role"() = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."usuarios" "u"
  WHERE ("u"."perfil" = 'ADMIN'::"text")))));



ALTER TABLE "public"."usuarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."validacoes_desenvolvedor" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."calc_datas_eap_cascade_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."calc_datas_eap_cascade_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_datas_eap_cascade_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calc_datas_eap_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."calc_datas_eap_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_datas_eap_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_funcionario_rdo_eligibility"("p_funcionario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_funcionario_rdo_eligibility"("p_funcionario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_funcionario_rdo_eligibility"("p_funcionario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalcular_eap_projeto_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalcular_eap_projeto_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalcular_eap_projeto_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_summary_eap_dates_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_summary_eap_dates_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_summary_eap_dates_trigger"() TO "service_role";
























GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacao_itens" TO "anon";
GRANT ALL ON TABLE "public"."avaliacao_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacao_itens" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacoes_desempenho" TO "anon";
GRANT ALL ON TABLE "public"."avaliacoes_desempenho" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacoes_desempenho" TO "service_role";



GRANT ALL ON TABLE "public"."cessoes_pessoal" TO "anon";
GRANT ALL ON TABLE "public"."cessoes_pessoal" TO "authenticated";
GRANT ALL ON TABLE "public"."cessoes_pessoal" TO "service_role";



GRANT ALL ON TABLE "public"."competencias_catalogo" TO "anon";
GRANT ALL ON TABLE "public"."competencias_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."competencias_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."contratos_obra" TO "anon";
GRANT ALL ON TABLE "public"."contratos_obra" TO "authenticated";
GRANT ALL ON TABLE "public"."contratos_obra" TO "service_role";



GRANT ALL ON TABLE "public"."convites" TO "anon";
GRANT ALL ON TABLE "public"."convites" TO "authenticated";
GRANT ALL ON TABLE "public"."convites" TO "service_role";



GRANT ALL ON TABLE "public"."cronograma_financeiro_semanas" TO "anon";
GRANT ALL ON TABLE "public"."cronograma_financeiro_semanas" TO "authenticated";
GRANT ALL ON TABLE "public"."cronograma_financeiro_semanas" TO "service_role";



GRANT ALL ON TABLE "public"."cronograma_versions" TO "anon";
GRANT ALL ON TABLE "public"."cronograma_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."cronograma_versions" TO "service_role";



GRANT ALL ON TABLE "public"."dispositivos_mobile" TO "anon";
GRANT ALL ON TABLE "public"."dispositivos_mobile" TO "authenticated";
GRANT ALL ON TABLE "public"."dispositivos_mobile" TO "service_role";



GRANT ALL ON TABLE "public"."empresa_contratante" TO "anon";
GRANT ALL ON TABLE "public"."empresa_contratante" TO "authenticated";
GRANT ALL ON TABLE "public"."empresa_contratante" TO "service_role";



GRANT ALL ON TABLE "public"."empresas_fornecedores" TO "anon";
GRANT ALL ON TABLE "public"."empresas_fornecedores" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas_fornecedores" TO "service_role";



GRANT ALL ON TABLE "public"."equipe_membros" TO "anon";
GRANT ALL ON TABLE "public"."equipe_membros" TO "authenticated";
GRANT ALL ON TABLE "public"."equipe_membros" TO "service_role";



GRANT ALL ON TABLE "public"."equipes" TO "anon";
GRANT ALL ON TABLE "public"."equipes" TO "authenticated";
GRANT ALL ON TABLE "public"."equipes" TO "service_role";



GRANT ALL ON TABLE "public"."especialidades" TO "anon";
GRANT ALL ON TABLE "public"."especialidades" TO "authenticated";
GRANT ALL ON TABLE "public"."especialidades" TO "service_role";



GRANT ALL ON TABLE "public"."funcionario_treinamentos" TO "anon";
GRANT ALL ON TABLE "public"."funcionario_treinamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."funcionario_treinamentos" TO "service_role";



GRANT ALL ON TABLE "public"."funcionarios" TO "anon";
GRANT ALL ON TABLE "public"."funcionarios" TO "authenticated";
GRANT ALL ON TABLE "public"."funcionarios" TO "service_role";



GRANT ALL ON TABLE "public"."itens_eap" TO "anon";
GRANT ALL ON TABLE "public"."itens_eap" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_eap" TO "service_role";



GRANT ALL ON TABLE "public"."itens_medicao_detalhe" TO "anon";
GRANT ALL ON TABLE "public"."itens_medicao_detalhe" TO "authenticated";
GRANT ALL ON TABLE "public"."itens_medicao_detalhe" TO "service_role";



GRANT ALL ON TABLE "public"."medicoes" TO "anon";
GRANT ALL ON TABLE "public"."medicoes" TO "authenticated";
GRANT ALL ON TABLE "public"."medicoes" TO "service_role";



GRANT ALL ON TABLE "public"."ordens_servico" TO "anon";
GRANT ALL ON TABLE "public"."ordens_servico" TO "authenticated";
GRANT ALL ON TABLE "public"."ordens_servico" TO "service_role";



GRANT ALL ON TABLE "public"."permissoes_contratante" TO "anon";
GRANT ALL ON TABLE "public"."permissoes_contratante" TO "authenticated";
GRANT ALL ON TABLE "public"."permissoes_contratante" TO "service_role";



GRANT ALL ON TABLE "public"."permissoes_empresa" TO "anon";
GRANT ALL ON TABLE "public"."permissoes_empresa" TO "authenticated";
GRANT ALL ON TABLE "public"."permissoes_empresa" TO "service_role";



GRANT ALL ON TABLE "public"."permissoes_tipo" TO "anon";
GRANT ALL ON TABLE "public"."permissoes_tipo" TO "authenticated";
GRANT ALL ON TABLE "public"."permissoes_tipo" TO "service_role";



GRANT ALL ON TABLE "public"."permissoes_usuario" TO "anon";
GRANT ALL ON TABLE "public"."permissoes_usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."permissoes_usuario" TO "service_role";



GRANT ALL ON TABLE "public"."projetos" TO "anon";
GRANT ALL ON TABLE "public"."projetos" TO "authenticated";
GRANT ALL ON TABLE "public"."projetos" TO "service_role";



GRANT ALL ON TABLE "public"."rdo_frentes_servico" TO "anon";
GRANT ALL ON TABLE "public"."rdo_frentes_servico" TO "authenticated";
GRANT ALL ON TABLE "public"."rdo_frentes_servico" TO "service_role";



GRANT ALL ON TABLE "public"."rdo_items" TO "anon";
GRANT ALL ON TABLE "public"."rdo_items" TO "authenticated";
GRANT ALL ON TABLE "public"."rdo_items" TO "service_role";



GRANT ALL ON TABLE "public"."rdo_photos" TO "anon";
GRANT ALL ON TABLE "public"."rdo_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."rdo_photos" TO "service_role";



GRANT ALL ON TABLE "public"."rdos" TO "anon";
GRANT ALL ON TABLE "public"."rdos" TO "authenticated";
GRANT ALL ON TABLE "public"."rdos" TO "service_role";



GRANT ALL ON TABLE "public"."ref_cargos_salarios" TO "anon";
GRANT ALL ON TABLE "public"."ref_cargos_salarios" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_cargos_salarios" TO "service_role";



GRANT ALL ON TABLE "public"."ref_matriz_encargos" TO "anon";
GRANT ALL ON TABLE "public"."ref_matriz_encargos" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_matriz_encargos" TO "service_role";



GRANT ALL ON TABLE "public"."sistema_eventos_catalogo" TO "anon";
GRANT ALL ON TABLE "public"."sistema_eventos_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."sistema_eventos_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."system_error_log" TO "anon";
GRANT ALL ON TABLE "public"."system_error_log" TO "authenticated";
GRANT ALL ON TABLE "public"."system_error_log" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_bdi_configuracao" TO "anon";
GRANT ALL ON TABLE "public"."tenant_bdi_configuracao" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_bdi_configuracao" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_cargos_salarios" TO "anon";
GRANT ALL ON TABLE "public"."tenant_cargos_salarios" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_cargos_salarios" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."v_contratos_obra_resumo" TO "anon";
GRANT ALL ON TABLE "public"."v_contratos_obra_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_contratos_obra_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."v_permissoes_efetivas" TO "anon";
GRANT ALL ON TABLE "public"."v_permissoes_efetivas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_permissoes_efetivas" TO "service_role";



GRANT ALL ON TABLE "public"."v_rdo_totais_por_projeto" TO "anon";
GRANT ALL ON TABLE "public"."v_rdo_totais_por_projeto" TO "authenticated";
GRANT ALL ON TABLE "public"."v_rdo_totais_por_projeto" TO "service_role";



GRANT ALL ON TABLE "public"."v_resumo_eap_medicao" TO "anon";
GRANT ALL ON TABLE "public"."v_resumo_eap_medicao" TO "authenticated";
GRANT ALL ON TABLE "public"."v_resumo_eap_medicao" TO "service_role";



GRANT ALL ON TABLE "public"."validacoes_desenvolvedor" TO "anon";
GRANT ALL ON TABLE "public"."validacoes_desenvolvedor" TO "authenticated";
GRANT ALL ON TABLE "public"."validacoes_desenvolvedor" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































