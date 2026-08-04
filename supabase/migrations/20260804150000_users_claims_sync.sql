-- Adiciona flag de invalidação de claims no Firebase.
-- Quando um Admin altera o perfil de um usuário, essa flag é ativada.
-- No próximo login do usuário, o backend detecta a flag, re-sincroniza os
-- customClaims no Firebase e limpa a flag automaticamente.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS claims_pendentes BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN usuarios.claims_pendentes IS
  'Sinaliza que os customClaims no Firebase estão desatualizados e devem ser re-sincronizados no próximo login.';
