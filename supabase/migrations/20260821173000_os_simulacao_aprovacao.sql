-- Migration: Arquitetura Previsto vs Realizado (Simulação -> Aprovação)
-- Modificando a tabela de OS para suportar Snapshots JSONB e Compliance de Aprovação

-- 1. Adicionando campos de snapshot, data de início e composição à OS
ALTER TABLE ordens_servico 
ADD COLUMN IF NOT EXISTS composicao_simulada JSONB,
ADD COLUMN IF NOT EXISTS custo_aprovado_snapshot_jsonb JSONB,
ADD COLUMN IF NOT EXISTS data_inicio_confirmada DATE;

-- 2. Tabela de Auditoria e Compliance para Aprovação
CREATE TABLE IF NOT EXISTS os_aprovacoes_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    aprovador_email TEXT NOT NULL,
    data_aprovacao TIMESTAMPTZ DEFAULT NOW(),
    snapshot_congelado JSONB NOT NULL,
    metadata_seguranca JSONB,
    CONSTRAINT aprovacoes_unico_por_os UNIQUE(ordem_servico_id)
);

-- 3. Habilitar RLS
ALTER TABLE os_aprovacoes_compliance ENABLE ROW LEVEL SECURITY;

-- 4. Criar Policy de Tenant Isolation para a Auditoria
DROP POLICY IF EXISTS tenant_aprovacoes ON os_aprovacoes_compliance;
CREATE POLICY tenant_aprovacoes ON os_aprovacoes_compliance FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

-- 5. Atualizar Restrição (Constraint) do Status
-- Como os status originais eram 'Emitida', 'Em Andamento', 'Concluída'
-- Adicionaremos os conceitos: 'Simulada', 'Planejada' (substituindo Emitida como inicial se desejado, mas mantendo retrocompatibilidade).
-- PostgreSQL permite omitir constraints do tipo CHECK nativo para flexibilidade,
-- mas podemos garantir via API as transições.

GRANT ALL ON TABLE os_aprovacoes_compliance TO postgres, anon, authenticated, service_role;
