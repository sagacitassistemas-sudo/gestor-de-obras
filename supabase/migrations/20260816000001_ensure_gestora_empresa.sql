-- Garante que a empresa gestora padrão exista no banco
INSERT INTO empresas_fornecedores (id, contrato_id, nome, cnpj_cpf, tipo, status, total_faturado)
VALUES ('GER-2026-SYS', 'CTR-2026-SYS', 'Gestora do Sistema', '00.000.000/0001-00', 'CONTRATANTE', 'ATIVO', 0)
ON CONFLICT (id, contrato_id) DO NOTHING;
