-- 20260816223500_fix_convites_schema.sql
-- Converte contrato_id, empresa_id, entidade_id para TEXT em convites e adiciona expires_at

ALTER TABLE public.convites DROP CONSTRAINT IF EXISTS convites_contrato_id_fkey;
ALTER TABLE public.convites ALTER COLUMN contrato_id TYPE TEXT USING contrato_id::text;
ALTER TABLE public.convites ALTER COLUMN empresa_id TYPE TEXT USING empresa_id::text;
ALTER TABLE public.convites ALTER COLUMN entidade_id TYPE TEXT USING entidade_id::text;

ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');

GRANT ALL ON TABLE public.convites TO postgres, anon, authenticated, service_role;
