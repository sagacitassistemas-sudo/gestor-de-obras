# Competências da Pipeline de Agentes — Works Manager

Este arquivo define as skills, responsabilidades e regras de raciocínio que a IA deve aplicar ao trabalhar neste projeto. Deve ser lido em conjunto com a `especificacao_sistema.md`.

---

## 🧠 Skills Prioritárias (por domínio)

### AUTH — Autenticação e Sessão
- **Reconhecer** que o sistema usa DOIS tokens distintos: Firebase ID Token (identidade) e Supabase JWT (autorização de negócio).
- **Lembrar** do fallback de token: `supabase.auth.getSession().access_token || authSession?.idToken`.
- **Saber** que o `supabase.auth.setSession()` deve ser chamado no frontend após o retorno do `session.idToken` do backend.
- **Identificar** o fluxo completo: OAuth SSO → `/api/auth/oauth-login` → JWT Supabase assinado → `setSession()` → RLS habilitado.

### PERMISSÕES — Hierarquia de 4 Níveis
- **Mapear** automaticamente qual tabela de permissão corresponde a cada nível:
  - `permissoes_contratante` (Nível 1 — Teto Global)
  - `permissoes_tipo` (Nível 2 — Template por Perfil)
  - `permissoes_empresa` (Nível 3 — Teto por Empresa)
  - `permissoes_usuario` (Nível 4 — Efetiva Individual)
- **Aplicar** seeding automático de permissões ao criar usuários (copiar de `permissoes_tipo[perfil]` → `permissoes_usuario`).
- **Usar** sempre `v_permissoes_efetivas` para consultar permissões computadas — nunca recalcular na aplicação.

### BACKEND — server.ts (1900+ linhas)
- **Preferir** scripts `.mjs` de patch com `String.prototype.replace` para edições cirúrgicas.
- **Usar** `grep -n` para localizar funções/rotas antes de editar.
- **Conhecer** a localização das seções:
  - Auth: linhas ~150-400
  - Permissões: linhas ~1400-1520
  - Usuários: linhas ~1700-1800
  - `getComputedPermissions`: linhas ~1843+

### FRONTEND — React + Sidebar Guards
- **Passar** `permissions` e `userRole` como props para `Sidebar.tsx`.
- **Usar** `hasAccess(tab)` para guard de abas em `App.tsx`.
- **Renderizar** `"Acesso Restrito"` para abas sem permissão (não redirecionar).
- **Conhecer** todos os `NavigationTab` válidos definidos em `types.ts`.

### UI — Design System
- `rounded-md` obrigatório para painéis e botões.
- `shadow-2xs` para cards; `shadow-md` para modais.
- Paleta: `#005daa` (primário), emerald (sucesso), amber (alerta), red (erro), indigo (tech).

### SECURITY & COMPLIANCE — Isolamento RLS e Governança de Acesso
- **Garantir** que toda tabela transacional no PostgreSQL possua RLS habilitado e utilize o padrão unificado `(request.jwt.claims->>'contrato_id')`.
- **Validar** que convites possuam controle de ciclo de vida (`expires_at` com 7 dias e status `PENDENTE`/`USADO`/`EXPIRADO`).
- **Respeitar** o princípio do *Deny-by-Default* no fallback de permissões para módulos sensíveis (`financeiro`, `usuarios`, `medicoes`, `relatorios`).
- **Bloquear** edições em `permissoes_usuario` para perfis não-administradores no nível de banco via policy `pu_admin_modify`.
- **Reconhecer** a empresa `GER-2026-SYS` do tipo `GESTORA` como administradora do sistema com permissões máximas irrestritas.
- **Registrar** em `audit_log` e `system_error_log` qualquer tentativa de acesso não autorizado ou violação de permissão.

---

## 🔧 Técnicas Operacionais

### Ao investigar um bug de acesso/permissão:
1. Verificar se o token chegou ao middleware (`verifyFirebaseJWT`).
2. Verificar as claims decodificadas (`req.decodedToken.perfil`, `contrato_id`).
3. Chamar `/api/permissoes/efetivas/:uid` manualmente e inspecionar retorno.
4. Inspecionar `v_permissoes_efetivas` no Supabase Studio com o JWT assinado.

### Ao adicionar uma nova aba/módulo:
1. Adicionar o novo valor ao tipo `NavigationTab` em `src/types.ts`.
2. Adicionar botão na `Sidebar.tsx` com `{hasAccess('chave_permissao') && <button>}`.
3. Renderizar a view no `App.tsx` com `{activeTab === 'nova_aba' && (hasAccess('nova_aba') ? <NovaView /> : <Restrito />)}`.
4. Criar a rota correspondente no `server.ts` com `checkPermission`.

### Ao adicionar uma nova permissão (nova chave):
1. Adicionar o campo à interface `PermissoesBase` em `src/types/cerne.types.ts`.
2. Adicionar a coluna às 4 tabelas de permissão no Supabase (migration SQL).
3. Atualizar a view `v_permissoes_efetivas` para incluir a nova coluna.
4. Atualizar o `getComputedPermissions()` no `server.ts` para incluir o fallback da nova chave.
5. Atualizar a `MatrizAcessosView.tsx` para renderizar o novo campo na matriz.

### Ao concluir qualquer implementação, correção ou release (Rotina Mandatória):
1. **Validação Obrigatória dos Testes (Gate de Qualidade)**:
   - Executar a checagem estática de tipos: `npx tsc --noEmit` (deve retornar 0 erros).
   - Executar a suíte completa de testes automatizados: `npm run test` (100% dos testes devem passar).
   - **REGRA ESTRITA**: Se houver qualquer falha ou erro, **NÃO** arquivar no `.history/`. Corrigir as falhas primeiro e re-executar os testes até obter aprovação total.
2. **Gerar Walkthrough de Entrega**:
   - Consolidar as alterações técnicas, arquivos modificados e os resultados dos testes executados.
3. **Arquivamento Condicional na pasta [`.history/`](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history)**:
   - Somente após os testes estarem 100% verdes, salvar o arquivo no formato: `.history/AAAA-MM-DD_nome_descritivo_da_tarefa.md`.
   - Atualizar a tabela de índice no [`.history/README.md`](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history/README.md) com data, link relativo, domínio e resumo.
4. **Registro de Release**:
   - Atualizar o arquivo [VERSION.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/VERSION.md) com as notas da release.

---

## 🚫 Anti-Padrões Proibidos

| Anti-Padrão | Por quê é Problema |
| :--- | :--- |
| Usar `multi_replace_file_content` em server.ts com 3+ blocos | Alta taxa de falha de correspondência em arquivo grande |
| Usar o cliente global `supabase` nas rotas (em vez de `getSupabaseClient(req)`) | Quebra o isolamento RLS por tenant |
| Calcular permissões no frontend sem consultar a API | Segurança client-side não é segurança real |
| Usar `rounded-xl` ou `rounded-2xl` em painéis | Quebra o design system corporativo |
| Criar usuário sem sedar `permissoes_usuario` | Usuário fica sem permissões até ser configurado manualmente |
| Usar `req.body.contrato_id` para filtrar dados | Zero Trust — apenas `req.decodedToken.contrato_id` é confiável |
| Arquivar no `.history/` antes da aprovação total dos testes | Poluição da memória histórica com código potencialmente quebrado |
| Concluir tarefas sem arquivar o walkthrough em `.history/` após os testes | Perda de rastreabilidade técnica e memória de engenharia |

---

## 📋 Checklist de Qualidade (Pré-Commit)

Antes de submeter qualquer mudança:
- [ ] O token está sendo buscado com fallback correto?
- [ ] As permissões são verificadas antes de operações de escrita?
- [ ] Novos usuários recebem seeding automático de `permissoes_tipo`?
- [ ] A UI usa o design system (rounded-md, shadow-2xs, paleta correta)?
- [ ] O isolamento por `contrato_id` foi respeitado em todas as queries?
- [ ] A view `v_permissoes_efetivas` está atualizada com novos campos?
- [ ] Todos os testes (`npm run test`) e checagem de tipos (`tsc`) passaram com 100% de sucesso?
- [ ] O walkthrough da entrega foi salvo na pasta [`.history/`](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history) e indexado no [`.history/README.md`](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history/README.md) SOMENTE após a aprovação dos testes?
- [ ] O arquivo [VERSION.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/VERSION.md) foi atualizado com a release?
