-- 20260817000000_schema_matriz_competencias.sql
-- Módulo: Matriz de Competências, Avaliações e Integração SSMA/RDO

-- 1. Inserir Especialidade faltante
INSERT INTO especialidades (tenant_id, nome, descricao, cor, icone)
VALUES ('CTR-2026-SYS', 'Operador de Máquinas de Terraplenagem', 'Operação de escavadeira, rolo e tratores pesados', '#ea580c', 'front_loader')
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- 2. CATÁLOGO DE COMPETÊNCIAS
CREATE TABLE IF NOT EXISTS competencias_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    especialidade_id UUID NOT NULL REFERENCES especialidades(id) ON DELETE CASCADE,
    eixo VARCHAR(50) CHECK (eixo IN ('Tecnicas', 'Calculo', 'Comunicacao', 'SSMA')) NOT NULL,
    descricao TEXT NOT NULL,
    peso_esperado INTEGER CHECK (peso_esperado BETWEEN 1 AND 5) DEFAULT 3,
    treinamento_obrigatorio VARCHAR(100), -- Ex: 'NR-10', 'NR-35'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT comp_catalogo_unico UNIQUE(tenant_id, especialidade_id, eixo, descricao)
);

-- 3. AVALIAÇÕES DE DESEMPENHO (Cabeçalho)
CREATE TABLE IF NOT EXISTS avaliacoes_desempenho (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    avaliador_uid TEXT NOT NULL REFERENCES usuarios(uid) ON DELETE CASCADE,
    data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) CHECK (status IN ('Rascunho', 'Concluido')) DEFAULT 'Rascunho',
    observacao_geral TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ITENS DA AVALIAÇÃO (Notas)
CREATE TABLE IF NOT EXISTS avaliacao_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avaliacao_id UUID NOT NULL REFERENCES avaliacoes_desempenho(id) ON DELETE CASCADE,
    competencia_id UUID NOT NULL REFERENCES competencias_catalogo(id) ON DELETE CASCADE,
    nota_alcancada INTEGER CHECK (nota_alcancada BETWEEN 1 AND 5),
    observacao TEXT,
    CONSTRAINT avaliacao_item_unico UNIQUE(avaliacao_id, competencia_id)
);

-- 5. TREINAMENTOS E LICENÇAS DOS FUNCIONÁRIOS
CREATE TABLE IF NOT EXISTS funcionario_treinamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    nome_curso VARCHAR(100) NOT NULL,
    data_conclusao DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    certificado_url TEXT,
    status VARCHAR(50) DEFAULT 'Regular',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INTEGRAÇÃO RDO: Frentes de Serviço Assumidas por Funcionários
CREATE TABLE IF NOT EXISTS rdo_frentes_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    rdo_id UUID NOT NULL REFERENCES rdos(id) ON DELETE CASCADE,
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    papel VARCHAR(50) CHECK (papel IN ('Assinante', 'Apontador_Producao', 'Membro')),
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT rdo_frente_unica UNIQUE(rdo_id, funcionario_id)
);

-- 7. RLS e Políticas
ALTER TABLE competencias_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionario_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_frentes_servico ENABLE ROW LEVEL SECURITY;

-- Tenants Policies
CREATE POLICY tenant_competencias ON competencias_catalogo FOR ALL USING (tenant_id = current_setting('app.current_contrato_id', true));
CREATE POLICY tenant_avaliacoes ON avaliacoes_desempenho FOR ALL USING (tenant_id = current_setting('app.current_contrato_id', true));
CREATE POLICY tenant_avaliacao_itens ON avaliacao_itens FOR ALL 
    USING (EXISTS (SELECT 1 FROM avaliacoes_desempenho a WHERE a.id = avaliacao_itens.avaliacao_id AND a.tenant_id = current_setting('app.current_contrato_id', true)));
CREATE POLICY tenant_treinamentos ON funcionario_treinamentos FOR ALL USING (tenant_id = current_setting('app.current_contrato_id', true));
CREATE POLICY tenant_rdo_frentes ON rdo_frentes_servico FOR ALL USING (tenant_id = current_setting('app.current_contrato_id', true));

-- Grants
GRANT ALL ON TABLE competencias_catalogo TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE avaliacoes_desempenho TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE avaliacao_itens TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE funcionario_treinamentos TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE rdo_frentes_servico TO postgres, anon, authenticated, service_role;

-- 8. FUNÇÃO ÚTIL PARA AVALIAR SE O FUNCIONÁRIO PODE ASSINAR/REPORTAR RDO
CREATE OR REPLACE FUNCTION check_funcionario_rdo_eligibility(p_funcionario_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. SEED DATA PARA O CATÁLOGO DE COMPETÊNCIAS (Inserindo usando os IDs recuperados de especialidades)
DO $$
DECLARE
    esp RECORD;
BEGIN
    -- 1. Armador
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Armador' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Corte, dobragem e montagem de armaduras para OAC e OAE; Instalação de espaçadores.', 4),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Leitura de projetos estruturais; Estimativa de arame recozido.', 3),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Apontamento diário de kg de aço montado.', 3),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Uso de EPIs específicos (luvas de raspa); Práticas ergonômicas.', 4) ON CONFLICT DO NOTHING;
    END IF;

    -- 2. Carpinteiro
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Carpinteiro' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado, treinamento_obrigatorio) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Confecção e montagem de fôrmas (madeira/metal); Execução de escoramentos.', 4, NULL),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Leitura de projetos de fôrmas; Cálculo prático de esquadro (3-4-5), prumo e nível.', 4, NULL),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Informação de área (m²) de fôrma para o RDO.', 3, NULL),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Operação segura de serra circular; Trabalho em altura.', 5, 'NR-18, NR-35') ON CONFLICT DO NOTHING;
    END IF;

    -- 3. Coordenador de Campo
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Coordenador de Campo' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Gestão de frentes (corte, aterro, pavimentação); Sincronização logística.', 5),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Análise de diagrama de massas (Bruckner); Cálculo de produtividade (m³/h).', 5),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Validação final do RDO; Interface com fiscalização do DER.', 5),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Gestão de sinalização viária; Controle de passivos ambientais.', 4) ON CONFLICT DO NOTHING;
    END IF;

    -- 4. Eletricista
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Eletricista' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado, treinamento_obrigatorio) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Manutenção de rede elétrica provisória; Montagem de quadros com proteção DR.', 5, NULL),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Leitura de diagramas unifilares; Dimensionamento de cabos e disjuntores.', 4, NULL),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Registro de paralisações por energia no RDO.', 3, NULL),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Cumprimento da norma e LOTO; Ferramentas isoladas.', 5, 'NR-10') ON CONFLICT DO NOTHING;
    END IF;

    -- 5. Encanador
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Encanador' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado, treinamento_obrigatorio) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Assentamento de tubulações (drenagem profunda e superficial).', 4, NULL),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Leitura de cotas de fundo de vala; Declividades.', 4, NULL),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Reporte de metragem linear de rede ao RDO.', 3, NULL),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Segurança no interior de valas; Içamento seguro.', 4, 'NR-18') ON CONFLICT DO NOTHING;
    END IF;

    -- 6. Mestre de Obras
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Mestre de Obras' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Supervisão da execução; Controle de aplicação de CBUQ.', 5),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Cálculo de distribuição de volume por estaca; Conferência de produtividade.', 4),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Consolidação do RDO (clima, ocorrências, equipamentos).', 5),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'DDS diário; Autoridade de parada por condição insegura.', 5) ON CONFLICT DO NOTHING;
    END IF;

    -- 7. Pedreiro
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Pedreiro' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Construção de bocas de lobo, meio-fio, sarjetas; Preparo de concretos.', 4),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Nível, prumo e declividade de águas pluviais; Dosagem (traço em volume).', 3),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Reporte de unidades executadas ao Mestre de Obras.', 3),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Manuseio seguro de cimento/aditivos químicos.', 3) ON CONFLICT DO NOTHING;
    END IF;

    -- 8. Pintor
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Pintor' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Sinalização horizontal; Pintura de OAE e barreiras.', 4),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Cálculo de consumo de tinta por m²; Controle de espessura.', 3),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Sincronização com batedores/tráfego.', 3),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'FISPQ de tintas e solventes; Proteção respiratória.', 4) ON CONFLICT DO NOTHING;
    END IF;

    -- 9. Servente
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Servente' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Apoio operacional; Espalhamento manual de solos; Carga e descarga.', 3),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Compreensão de marcações topográficas simples.', 2),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Reporte de horas e materiais à liderança.', 2),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Uso de EPIs básicos; Atenção ao trânsito de máquinas.', 3) ON CONFLICT DO NOTHING;
    END IF;

    -- 10. Soldador
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Soldador' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Soldagem estrutural e reparos mecânicos; Processos SMAW e MIG/MAG.', 5),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Leitura de simbologia de solda; Dimensionamento de chanfro/amperagem.', 4),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Status de liberação de peças mecânicas.', 3),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Permissão de Trabalho a Quente (PT); Isolamento com biombos.', 5) ON CONFLICT DO NOTHING;
    END IF;

    -- 11. Técnico de Segurança
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Técnico de Segurança' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Inspeção em frentes de serviço; Auditoria de PGR e EPIs.', 5),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Taxas de frequência/gravidade (ABNT); Avaliações ambientais.', 4),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Condução de DDS; Interface com DER sobre segurança.', 5),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Fiscalização soberana das NRs; Gestão de emergências.', 5) ON CONFLICT DO NOTHING;
    END IF;

    -- 12. Operador de Máquinas de Terraplenagem
    SELECT id INTO esp FROM especialidades WHERE tenant_id = 'CTR-2026-SYS' AND nome = 'Operador de Máquinas de Terraplenagem' LIMIT 1;
    IF FOUND THEN
        INSERT INTO competencias_catalogo (tenant_id, especialidade_id, eixo, descricao, peso_esperado, treinamento_obrigatorio) VALUES 
        ('CTR-2026-SYS', esp.id, 'Tecnicas', 'Operação de equipamentos (escavadeira, rolo, etc.); Checklist diário.', 5, NULL),
        ('CTR-2026-SYS', esp.id, 'Calculo', 'Leitura de offsets, cotas e greide.', 4, NULL),
        ('CTR-2026-SYS', esp.id, 'Comunicacao', 'Apontamento de horímetro e paradas para o RDO.', 3, NULL),
        ('CTR-2026-SYS', esp.id, 'SSMA', 'Gestão de pontos cegos e raio de giro.', 4, 'NR-12') ON CONFLICT DO NOTHING;
    END IF;

END $$;
