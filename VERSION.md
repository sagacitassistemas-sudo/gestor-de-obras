# Histórico de Versões e Releases - Works Manager (Gestor de Obras)

## Versão 1.2.0 (2026-08-16) - Auditoria de Segurança, Hardening de RLS e Governança de Acesso

### 🛡️ 1. Hardening e Unificação do Row-Level Security (RLS)
- **Isolamento de Tenant Padronizado**:
  - Migradas todas as tabelas operacionais (`rdos`, `rdo_items`, `rdo_photos`, `ordens_servico`) para o padrão JWT `(request.jwt.claims->>'contrato_id')`, eliminando a dependência legada de `app.current_tenant`.
- **Governança Estrita em `empresas_fornecedores`**:
  - Removidas 3 policies conflitantes e estabelecidas `ef_tenant_select` (leitura para usuários do mesmo tenant) e `ef_tenant_modify` (escrita restrita exclusivamente a `ADMIN` e `GESTOR`).
- **Proteção da Matriz de Usuários em `permissoes_usuario`**:
  - Implementada a policy `pu_admin_modify` que impede via banco que usuários comuns alterem seus próprios tetos de acesso.

### ⏱️ 2. Ciclo de Vida e Expiração de Convites
- **Validade Temporal de 7 Dias**:
  - Adicionada a coluna `expires_at` na tabela `convites`.
  - Os endpoints `GET /api/convites/:token` e `POST /api/convites/accept` barram convites expirados, marcando o status para `EXPIRADO`.
- **Correção de Typo na Policy**:
  - Corrigido `jwt.claim.sub` para `request.jwt.claims` na policy `tenant_admin_convites`.

### 🏢 3. Empresa Gestora do Sistema, Reconhecimento de Acesso & Contingência Master
- **Tipo de Empresa `GESTORA`**:
  - Cadastrada a empresa `GER-2026-SYS` ("Gestora do Sistema") com permissões máximas irrestritas (19 permissões habilitadas em `permissoes_empresa`).
  - Mapeamento automático de `sagacitas.sistemas@gmail.com` como `ADMIN` vinculado à Gestora.
- **E-mail de Reconhecimento & Recuperação Master (`/api/gestora/send-confirmation`)**:
  - Disparo de certificado oficial com identificação da empresa, contrato, nível de permissão (19 permissões ativas) e canal de contingência.
  - Inclusão de link seguro com token de redefinição de senha e validação de login master (`/?resetToken=...`).
- **Assistente de Redefinição de Senha no Login (`LoginScreen.tsx`)**:
  - Reconhecimento automático do token de recuperação via URL e interface integrada para redefinição de credenciais de emergência.
  - Conexão do fluxo "Esqueceu a senha?" com disparo de e-mail real via `/api/auth/request-password-reset`.
- **Fallback *Deny-by-Default***:
  - O cálculo de permissões em `getComputedPermissions()` adota bloqueio por padrão (`false`) para módulos sensíveis (`financeiro_ler`, `usuarios_ler`, `medicoes_ler`, `relatorios_ler`).

### 🧪 4. Suíte de Testes de Segurança
- Criada e expandida a suíte de testes de integração (`tests/integration/security.routes.test.ts`), totalizando 9 suítes e 94 testes passando com 100% de sucesso.

---

## Versão 1.1.1 (2026-08-07) - Travas de Integridade & Mecanismo Antirregressão

### 🛡️ 1. Pipeline de Verificação Automática de Integridade (`scripts/check-integrity.mjs`)
- **Paridade entre Frontend e Backend**:
  - Varredura estática de todas as chamadas `fetch('/api/...')` em componentes React (`src/components/`) para garantir que 100% das rotas possuam handlers correspondentes registrados em `server.ts`.
- **Prevenção de Polling / Erros COOP no Supabase Client**:
  - Enforce de `persistSession: false` e `autoRefreshToken: false` em `src/lib/supabaseClient.ts` para evitar conflito com Firebase Auth e erros de `Cross-Origin-Opener-Policy`.
- **Validação Estrita de Props e Tipos React**:
  - Integração do `tsc --noEmit` na pipeline para impedir incompatibilidade de props entre `App.tsx` e subcomponentes (`EmpresasView`, `MatrizAcessosView`, etc.).
- **Integração no NPM**:
  - Comando `npm run check:integrity` adicionado ao `package.json` e configurado no `npm run lint`.

### 🗄️ 2. Diagnóstico Dinâmico de Persistência em Produção
- Endpoint `/api/diagnostic/persistence` e botão interativo no painel **Compliance & Auditoria** (`AuditLogView.tsx`) para execução de testes end-to-end de INSERT, SELECT, RLS e DELETE em tempo real.

---

## Versão 1.1.0 (2026-08-04) - Release de Estabilidade de UI, Permissões e Produção

### 🖥️ 1. Interface de Usuário & UX (Menu Retrátil)
- **Sidebar Collapsible (Menu Lateral Retrátil)**:
  - Implementado estado `isSidebarCollapsed` controlado em `App.tsx` e propagado para `Sidebar.tsx`.
  - Alternância dinâmica entre largura total (`w-64` / `256px`) e modo colapsado por ícones (`w-20` / `80px`).
  - Adicionado botão flutuante de alternância (`chevron_left` / `chevron_right`) posicionado no cabeçalho da barra lateral para Desktop.
  - Ocultamento dinâmico de rótulos de texto (`font-label-bold`), mantendo suporte a `title` (tooltip) para acessibilidade.
  - Ajuste no container principal de rotas (`App.tsx`) com transição responsiva de margem externa (`md:ml-64` vs `md:ml-20`).
- **Correção de Layout e Sobreposição**:
  - Resolvida sobreposição visual da barra azul global de navegação de demonstração com a barra lateral fixa.

### 🛡️ 2. Matriz de Permissões (Delegação Hierárquica)
- **Resolução de Loading Infinito na Filtragem por Tipo**:
  - Corrigido travamento visual ("Carregando...") ao alternar entre as abas da Matriz de Permissões (`MatrizAcessosView.tsx`).
  - Introduzidos 4 estados explícitos de controle de carregamento: `loadingTipo`, `loadingEmpresa`, `loadingUsuario` e `loadingContratante`.
  - Implementado componente `LoadingSpinner` com animação suave em substituição a textos estáticos.
  - Adicionado tratamento de falha HTTP/API com fallback para permissões padrão seguras em caso de erro de rede ou resposta nula.

### ☁️ 3. Infraestrutura de Produção e Sincronização (Vercel & Supabase)
- **Correção da Autenticação de Produção (Erro 500 / JWT Mismatch)**:
  - Identificada e corrigida divergência no segredo de assinatura do JWT (`SUPABASE_JWT_SECRET`) que causava rejeição no auto-registro de usuários (`ensureUserExists`) no Vercel.
  - Injetadas variáveis de ambiente diretamente na produção do Vercel via Vercel CLI (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`).
  - Realizado novo deploy de produção compilado com o prefixo `VITE_` exigido pelo bundler Vite para injeção client-side.

### 🗄️ 4. Migração e Integridade de Banco de Dados
- **Pipeline de Dump de Dados Idempotente**:
  - Criado script de exportação limpa de dados (`scratch/local_data_dump_clean.sql`) utilizando `INSERT INTO ... ON CONFLICT DO NOTHING`.
  - Removidos comandos meta do `psql` (`\restrict` / `\unrestrict`) incompatíveis com o SQL Editor web do Supabase Cloud.
  - Reparada a integridade referencial de chave estrangeira (FK) entre as tabelas `itens_eap` e `projetos` (inclusão do projeto pai `0245894a-e335-4847-bfe2-55ea47439837`).

### 🔒 5. Segurança do Repositório
- Inclusão do diretório `docs/` no `.gitignore` para prevenir versionamento acidental de chaves e notas de configuração sensíveis.

---

## Versão 1.0.0 (2026-08-01) - Release Inicial
- Arquitetura Dual IdP (Firebase Auth) + Cerne (Supabase PostgreSQL RLS).
- Delegação Hierárquica de Permissões em 4 Níveis (Tenant > Tipo > Empresa > Usuário).
- Módulos DRE com Gemini AI, EAP Viária e Cadastro de Empresas.
