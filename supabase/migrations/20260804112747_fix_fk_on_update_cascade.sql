-- Drop existing constraint (assuming default name)
ALTER TABLE permissoes_usuario DROP CONSTRAINT IF EXISTS permissoes_usuario_usuario_uid_fkey;

-- Recreate constraint with ON UPDATE CASCADE
ALTER TABLE permissoes_usuario
  ADD CONSTRAINT permissoes_usuario_usuario_uid_fkey
  FOREIGN KEY (usuario_uid)
  REFERENCES usuarios(uid)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
