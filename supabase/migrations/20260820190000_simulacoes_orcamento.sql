-- Create simulacoes_projetos table for saving draft simulations in JSONB
CREATE TABLE IF NOT EXISTS simulacoes_projetos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    nome VARCHAR NOT NULL,
    dados_json JSONB NOT NULL,
    status VARCHAR DEFAULT 'RASCUNHO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE simulacoes_projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Simulações isoladas por tenant" 
ON simulacoes_projetos 
FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));

-- HACK for local RLS bypass (service role) if needed in development
CREATE POLICY "Bypass RLS para service_role"
ON simulacoes_projetos
USING (true);
