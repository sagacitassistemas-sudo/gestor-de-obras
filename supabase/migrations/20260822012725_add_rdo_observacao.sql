-- Adiciona coluna para registrar observação do aprovador quando um RDO é rejeitado/mandado para revisão
ALTER TABLE rdos ADD COLUMN IF NOT EXISTS observacao_revisao TEXT;
