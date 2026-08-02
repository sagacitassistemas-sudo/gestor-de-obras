-- ==============================================================================
-- GESTOR DE OBRAS - Reestruturação Contratos de Obra (Projeto 1:N Contratos)
-- Migração: 20260802200000
-- ==============================================================================

-- 1. ALTER TABLE projetos (Remover campos velhos, adicionar multitenancy)
ALTER TABLE projetos 
    ADD COLUMN tenant_id TEXT REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE;

-- Associar dados antigos ao tenant padrão para manter a integridade antes de tornar NOT NULL
UPDATE projetos SET tenant_id = 'CTR-2026-SYS' WHERE tenant_id IS NULL;

-- Tornar tenant_id NOT NULL e remover o código textual
ALTER TABLE projetos 
    ALTER COLUMN tenant_id SET NOT NULL,
    DROP COLUMN IF EXISTS codigo_contrato;

-- 2. CREATE TABLE contratos_obra (Entidade de relacionamento)
CREATE TABLE IF NOT EXISTS contratos_obra (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         TEXT NOT NULL REFERENCES empresa_contratante(contrato_id) ON DELETE CASCADE,
    fornecedor_id     TEXT NOT NULL,
    projeto_id        UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    numero_contrato   VARCHAR(100) NOT NULL,
    objeto            TEXT,
    valor_global      NUMERIC(15,2) DEFAULT 0.00,
    data_assinatura   DATE,
    data_vigencia     DATE,
    status            VARCHAR(30) DEFAULT 'VIGENTE'
                      CHECK (status IN ('RASCUNHO','VIGENTE','ENCERRADO','RESCINDIDO','ADITIVO')),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_contrato_fornecedor
      FOREIGN KEY (fornecedor_id, tenant_id)
      REFERENCES empresas_fornecedores(id, contrato_id) ON DELETE RESTRICT,
      
    CONSTRAINT unique_numero_contrato_tenant UNIQUE (numero_contrato, tenant_id)
);

-- 3. ALTER TABLE medicoes (Vincular medição ao contrato de obra que a executou)
ALTER TABLE medicoes 
    ADD COLUMN contrato_obra_id UUID REFERENCES contratos_obra(id) ON DELETE CASCADE;

-- ==============================================================================
-- VIEW: Resumo de Contratos de Obra
-- ==============================================================================
CREATE OR REPLACE VIEW v_contratos_obra_resumo AS
SELECT
  co.id AS contrato_obra_id,
  co.tenant_id,
  co.numero_contrato,
  co.objeto,
  co.valor_global,
  co.data_assinatura,
  co.data_vigencia,
  co.status AS contrato_status,
  ef.nome AS fornecedor_nome,
  ef.cnpj_cpf AS fornecedor_cnpj,
  p.id AS projeto_id,
  p.nome_projeto,
  -- Última medição deste contrato
  COALESCE(med_agg.total_medicoes, 0) AS total_medicoes,
  COALESCE(med_agg.valor_acumulado, 0) AS medicao_valor_acumulado,
  CASE WHEN co.valor_global > 0
    THEN ROUND((COALESCE(med_agg.valor_acumulado, 0) / co.valor_global) * 100, 2)
    ELSE 0
  END AS percentual_executado
FROM contratos_obra co
JOIN empresas_fornecedores ef ON ef.id = co.fornecedor_id AND ef.contrato_id = co.tenant_id
JOIN projetos p ON p.id = co.projeto_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_medicoes,
    SUM(imd.valor_acumulado) AS valor_acumulado
  FROM medicoes m
  JOIN itens_medicao_detalhe imd ON imd.medicao_id = m.id
  WHERE m.contrato_obra_id = co.id
    AND m.numero_medicao = (
      SELECT MAX(numero_medicao) 
      FROM medicoes 
      WHERE contrato_obra_id = co.id AND status != 'RASCUNHO'
    )
) med_agg ON TRUE;

-- ==============================================================================
-- SEGURANÇA E RLS (Restrições baseadas no tenant logado)
-- ==============================================================================

-- Remover bypass global anterior
DROP POLICY IF EXISTS tenant_projetos ON projetos;
DROP POLICY IF EXISTS tenant_itens_eap ON itens_eap;
DROP POLICY IF EXISTS tenant_medicoes ON medicoes;
DROP POLICY IF EXISTS tenant_itens_medicao ON itens_medicao_detalhe;

-- 4.1 Projetos
CREATE POLICY tenant_projetos ON projetos FOR ALL USING (
  tenant_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
);

-- 4.2 Contratos de Obra
ALTER TABLE contratos_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_contratos_obra ON contratos_obra FOR ALL USING (
  tenant_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
);

-- 4.3 Itens EAP (Acesso via projeto que por sua vez está no tenant)
CREATE POLICY tenant_itens_eap ON itens_eap FOR ALL USING (
  projeto_id IN (
    SELECT id FROM projetos WHERE tenant_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  )
);

-- 4.4 Medições (Acesso via contrato_obra que está no tenant)
CREATE POLICY tenant_medicoes ON medicoes FOR ALL USING (
  contrato_obra_id IN (
    SELECT id FROM contratos_obra WHERE tenant_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  )
);

-- 4.5 Itens Medição Detalhe
-- Idealmente faríamos a checagem cruzando com medições. Como é um teste de RLS, vamos encadear:
CREATE POLICY tenant_itens_medicao ON itens_medicao_detalhe FOR ALL USING (
  medicao_id IN (
    SELECT id FROM medicoes WHERE contrato_obra_id IN (
      SELECT id FROM contratos_obra WHERE tenant_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
    )
  )
);

-- Grants
GRANT ALL ON TABLE contratos_obra TO postgres, anon, authenticated, service_role;
GRANT SELECT ON v_contratos_obra_resumo TO anon, authenticated, service_role;
