ALTER TABLE public.itens_medicao_detalhe DROP CONSTRAINT IF EXISTS itens_medicao_detalhe_item_eap_id_fkey;
ALTER TABLE public.itens_medicao_detalhe ADD CONSTRAINT itens_medicao_detalhe_item_eap_id_fkey FOREIGN KEY (item_eap_id) REFERENCES itens_eap(id) ON DELETE CASCADE;
