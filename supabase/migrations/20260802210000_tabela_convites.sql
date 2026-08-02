-- Migration para a tabela de convites
CREATE TABLE IF NOT EXISTS convites (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    contrato_id UUID REFERENCES contratos_obra(id) ON DELETE CASCADE,
    empresa_id UUID,
    entidade_id UUID,
    perfil TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'USADO', 'EXPIRADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar RLS
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS admin_all_convites ON convites;
CREATE POLICY admin_all_convites ON convites
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM usuarios u 
            WHERE u.uid = current_setting('request.jwt.claim.sub', true) 
            AND u.perfil = 'ADMIN'
        )
    );

-- Serviço / Backend bypass
GRANT ALL ON TABLE convites TO postgres, anon, authenticated, service_role;
