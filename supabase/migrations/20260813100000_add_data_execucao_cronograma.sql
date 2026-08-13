-- Adiciona coluna de data_execucao na tabela de itens_eap
ALTER TABLE public.itens_eap ADD COLUMN IF NOT EXISTS data_execucao DATE;

-- Cria tabela de versionamento de cronograma
CREATE TABLE IF NOT EXISTS public.cronograma_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL,
    descricao TEXT,
    arquivo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES public.usuarios(uid) ON DELETE SET NULL,
    UNIQUE(projeto_id, versao)
);

-- Ativa RLS para cronograma_versions
ALTER TABLE public.cronograma_versions ENABLE ROW LEVEL SECURITY;

-- Política de RLS para cronograma_versions
CREATE POLICY "tenant_cronograma_versions" ON public.cronograma_versions
    FOR ALL
    USING (
        projeto_id IN (
            SELECT id FROM public.projetos
            WHERE tenant_id = current_setting('request.jwt.claims', true)::json->>'contrato_id'
        )
    );
