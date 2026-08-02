ALTER TABLE public.empresas_fornecedores ADD CONSTRAINT empresas_fornecedores_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.empresa_contratante(contrato_id) ON DELETE CASCADE;
