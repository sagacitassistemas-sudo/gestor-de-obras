-- Fix JWT custom claims mapping in RLS policies for usuarios table

DROP POLICY IF EXISTS tenant_usuarios ON usuarios;
CREATE POLICY tenant_usuarios ON usuarios
  FOR ALL USING (
    uid = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') OR
    contrato_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'contrato_id')
  );
