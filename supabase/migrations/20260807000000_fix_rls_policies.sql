-- Fix RLS Policies to use request.jwt.claims instead of app.current_contrato_id

DROP POLICY IF EXISTS tenant_contratante ON empresa_contratante;
CREATE POLICY tenant_contratante ON empresa_contratante
  FOR ALL USING (
    contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  );

DROP POLICY IF EXISTS tenant_fornecedores ON empresas_fornecedores;
CREATE POLICY tenant_fornecedores ON empresas_fornecedores
  FOR ALL USING (
    contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  );


DROP POLICY IF EXISTS tenant_usuarios ON usuarios;
CREATE POLICY tenant_usuarios ON usuarios
  FOR ALL USING (
    contrato_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
  );
