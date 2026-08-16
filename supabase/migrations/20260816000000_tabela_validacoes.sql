-- supabase/migrations/20260816000000_tabela_validacoes.sql
-- Tabela para rastreamento de tarefas de validação do desenvolvedor (operações manuais/externas pendentes)

CREATE TABLE IF NOT EXISTS public.validacoes_desenvolvedor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    agente TEXT NOT NULL DEFAULT 'Antigravity',
    status TEXT NOT NULL CHECK (status IN ('PENDENTE', 'VALIDADO', 'FALHOU')) DEFAULT 'PENDENTE',
    notas_validacao TEXT,
    link_referencia TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    validado_em TIMESTAMPTZ,
    responsavel_uid TEXT REFERENCES public.usuarios(uid)
);

-- RLS
ALTER TABLE public.validacoes_desenvolvedor ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins podem ver validacoes"
    ON public.validacoes_desenvolvedor
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.v_permissoes_efetivas
            WHERE v_permissoes_efetivas.usuario_uid = (auth.uid()::text)
              AND v_permissoes_efetivas.perfil = 'ADMIN'
        )
    );

CREATE POLICY "Admins podem alterar validacoes"
    ON public.validacoes_desenvolvedor
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.v_permissoes_efetivas
            WHERE v_permissoes_efetivas.usuario_uid = (auth.uid()::text)
              AND v_permissoes_efetivas.perfil = 'ADMIN'
        )
    );

CREATE POLICY "Admins podem inserir validacoes"
    ON public.validacoes_desenvolvedor
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.v_permissoes_efetivas
            WHERE v_permissoes_efetivas.usuario_uid = (auth.uid()::text)
              AND v_permissoes_efetivas.perfil = 'ADMIN'
        )
    );

CREATE POLICY "Admins podem deletar validacoes"
    ON public.validacoes_desenvolvedor
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.v_permissoes_efetivas
            WHERE v_permissoes_efetivas.usuario_uid = (auth.uid()::text)
              AND v_permissoes_efetivas.perfil = 'ADMIN'
        )
    );
