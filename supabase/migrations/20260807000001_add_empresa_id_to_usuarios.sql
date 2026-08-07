-- Adiciona a coluna empresa_id na tabela usuarios para vinculação de fornecedor

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS empresa_id TEXT;

-- Adiciona a restrição de chave estrangeira (empresa_id, contrato_id) -> empresas_fornecedores(id, contrato_id)
-- Note: Se o usuário for da empresa contratante (admin/gestor), empresa_id será nulo, logo a FK não é forçada
ALTER TABLE usuarios
ADD CONSTRAINT fk_usuarios_empresa 
FOREIGN KEY (empresa_id, contrato_id) 
REFERENCES empresas_fornecedores(id, contrato_id) 
ON DELETE SET NULL;

