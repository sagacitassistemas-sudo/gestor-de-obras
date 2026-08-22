-- Habilita o "security_invoker" nas views para que sejam executadas com os privilégios do usuário atual
-- e não do criador da view. Isso remove o alerta CRITICAL de "Security Definer View" no linter do Supabase.

ALTER VIEW public.v_permissoes_efetivas SET (security_invoker = true);
ALTER VIEW public.v_custo_hora_real_mao_obra SET (security_invoker = true);
ALTER VIEW public.v_resumo_eap_medicao SET (security_invoker = true);
ALTER VIEW public.v_contratos_obra_resumo SET (security_invoker = true);
ALTER VIEW public.v_rdo_totais_por_projeto SET (security_invoker = true);
