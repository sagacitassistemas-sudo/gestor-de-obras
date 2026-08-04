-- Apenas falhas de backend (system_error_log) devem ser purgadas mensalmente.
-- O audit_log (CRUD/Eventos) deve ser preservado.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Desagendar o job de expurgo do audit_log
    PERFORM cron.unschedule('purge_audit_log_daily');
  END IF;
END $$;
