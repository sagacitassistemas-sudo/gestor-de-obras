# Skill: Atualizar Documentação (.ai e VERSION)
**Trigger Phrase:** "Atualizar Docs", "Atualize nossa documentação"

## Workflow Automático
Quando o usuário acionar o comando "Atualizar Docs", você (Antigravity) deve obrigatoriamente realizar as seguintes ações:

1. **Revisar o Chat Recente:** Analise a sessão atual para capturar bugs resolvidos, novas funcionalidades (features implementadas), decisões de arquitetura e ferramentas criadas.
2. **Atualizar `VERSION.md`:** 
   - Se for uma correção de bugs (hotfix), incremente a versão PATCH (ex: 1.2.0 -> 1.2.1).
   - Se for adição de features novas e significativas, incremente a versão MINOR (ex: 1.2.1 -> 1.3.0).
   - Escreva o changelog no formato padrão usando ícones emoji (🎨, 🛡️, 🗄️, 🚀) e descreva os impactos.
3. **Escrever Post-Mortem em `.ai/errors/`:**
   - Crie um novo arquivo markdown caso bugs críticos tenham sido diagnosticados e resolvidos na sessão (ex: erro no hot-reload, crash na tela branca, exceção no servidor).
   - Use o padrão de nomenclatura: `YYYY-MM-DD_resumo_do_erro.md`.
   - Estrutura obrigatória: **Sintoma**, **Causa**, e **Solução**.
4. **Registrar Log da Sessão em `.ai/history/`:**
   - Crie um arquivo (ex: `YYYY-MM-DD_resumo_da_sessao.md`) com um high-level summary de todas as ações e decisões conjuntas que não se enquadram puramente como erro.
5. **Reportar ao Usuário:** Após consolidar toda a documentação, responda informando que as pastas `.ai/errors`, `.ai/history` e o `VERSION.md` foram devidamente registrados com a memória atualizada do sistema.
