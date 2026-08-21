-- ========================================================================================
-- MIGRAÇÃO DE PADRONIZAÇÃO DE RLS E ISOLAMENTO DE TENANT
-- Data: 2026-08-21
-- Descrição: Elimina o uso das variáveis GUC não nativas (app.current_tenant e app.current_contrato_id)
--            que bloqueiam a leitura/escrita via API. Padroniza todas as tabelas afetadas
--            para usarem a extração do claim JWT nativo corporativo. Ativa RLS nas 
--            tabelas esquecidas.
-- ========================================================================================

-- Padronização da string de tenant:
-- COALESCE(
--   NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''),
--   NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
--   'CTR-2026-SYS'
-- )

-- 1. DROP das Políticas Defeituosas
DROP POLICY IF EXISTS "tenant_dispositivos" ON "public"."dispositivos_mobile";
DROP POLICY IF EXISTS "tenant_competencias" ON "public"."competencias_catalogo";
DROP POLICY IF EXISTS "tenant_avaliacoes" ON "public"."avaliacoes_desempenho";
DROP POLICY IF EXISTS "tenant_avaliacao_itens" ON "public"."avaliacao_itens";
DROP POLICY IF EXISTS "tenant_treinamentos" ON "public"."funcionario_treinamentos";
DROP POLICY IF EXISTS "tenant_rdo_frentes" ON "public"."rdo_frentes_servico";
DROP POLICY IF EXISTS "Tenant isolation for cessoes_pessoal" ON "public"."cessoes_pessoal";
DROP POLICY IF EXISTS "tenant_equipe_composicao_especialidades" ON "public"."equipe_composicao_especialidades";

DROP POLICY IF EXISTS "Tenant isolation for calendarios" ON "public"."calendarios";
DROP POLICY IF EXISTS "tenant_calendarios" ON "public"."calendarios";
DROP POLICY IF EXISTS "tenant_calendario_excecoes" ON "public"."calendario_excecoes";

DROP POLICY IF EXISTS "Simulações isoladas por tenant" ON "public"."simulacoes_projetos";
DROP POLICY IF EXISTS "Bypass RLS para service_role" ON "public"."simulacoes_projetos";

DROP POLICY IF EXISTS "Tenant isolation for rdo_items" ON "public"."rdo_items";
DROP POLICY IF EXISTS "Read access to rdo_photos for tenant" ON "public"."rdo_photos";
DROP POLICY IF EXISTS "Insert access to rdo_photos for tenant" ON "public"."rdo_photos";
DROP POLICY IF EXISTS "Update access to rdo_photos for tenant" ON "public"."rdo_photos";
DROP POLICY IF EXISTS "Delete access to rdo_photos for tenant" ON "public"."rdo_photos";

-- 2. RECRIAR COM O PADRÃO CORP RLS
CREATE POLICY "tenant_dispositivos" ON "public"."dispositivos_mobile" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_competencias" ON "public"."competencias_catalogo" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_avaliacoes" ON "public"."avaliacoes_desempenho" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_avaliacao_itens" ON "public"."avaliacao_itens" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  EXISTS (SELECT 1 FROM avaliacoes_desempenho a WHERE a.id = avaliacao_itens.avaliacao_id AND a.tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS'))
);

CREATE POLICY "tenant_treinamentos" ON "public"."funcionario_treinamentos" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_rdo_frentes" ON "public"."rdo_frentes_servico" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_cessoes_pessoal" ON "public"."cessoes_pessoal" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_equipe_composicao" ON "public"."equipe_composicao_especialidades" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_calendarios_unified" ON "public"."calendarios" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_calendario_excecoes_unified" ON "public"."calendario_excecoes" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  EXISTS (SELECT 1 FROM calendarios c WHERE c.id = calendario_excecoes.calendario_id AND c.tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS'))
);

CREATE POLICY "tenant_simulacoes_projetos_unified" ON "public"."simulacoes_projetos" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_rdo_items_unified" ON "public"."rdo_items" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS')
);

CREATE POLICY "tenant_rdo_photos_unified" ON "public"."rdo_photos" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR 
  EXISTS (SELECT 1 FROM rdo_items ri WHERE ri.id = rdo_photos.rdo_item_id AND ri.tenant_id::text = COALESCE(NULLIF((current_setting('request.jwt.claims', true)::json ->> 'contrato_id')::text, ''), NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''), 'CTR-2026-SYS'))
);

-- 3. Ativar RLS em tabelas expostas e criar políticas de leitura e manipulação
ALTER TABLE "public"."ref_encargos_especificos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sistema_eventos_catalogo" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_encargos_especificos_select_all" ON "public"."ref_encargos_especificos" FOR SELECT USING (true);
CREATE POLICY "ref_encargos_especificos_modify_admin" ON "public"."ref_encargos_especificos" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role'
);

CREATE POLICY "sistema_eventos_catalogo_select_all" ON "public"."sistema_eventos_catalogo" FOR SELECT USING (true);
CREATE POLICY "sistema_eventos_catalogo_modify_admin" ON "public"."sistema_eventos_catalogo" FOR ALL USING (
  current_setting('role', true) = 'service_role' OR auth.role() = 'service_role'
);
