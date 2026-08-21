# Histórico de Versões

## [1.4.5] - 2026-08-20
- **Auditoria de Variáveis Zeradas (API & UI)**: Motor de cálculo da Simulação Dinâmica (`server.ts`) agora mapeia pendências de insumos bases (Salários ausentes, Exames não configurados) e devolve a lista para a UI exibir warnings de Compliance (`ComposicaoCustosMaoObraView.tsx`). Testes de Integração atualizados no Supabase Mock.

---

## Versão 1.4.4 (2026-08-21) - Auditoria de Composição de Custos na OS
### 🎨 1. Compliance e Validação
- **UI/UX**: Implementação de auditoria de pendências de composição de custo da OS (`OSView.tsx`). Destaque visual (vermelho) obrigando a validação de parâmetros de custos vazios em Mão de Obra, Materiais, Ferramentas e Equipamentos.

---

## Versão 1.4.3 (2026-08-20) - Motor Dinâmico de Mão de Obra e Integração do Histograma

### ⚙️ 1. Engenharia de Custos (Módulo II)
- **Cálculo Baseado em Calendário:** Substituição de horários fixos (165h/220h) por cálculo dinâmico baseado no calendário vigente do projeto.
- **Custos Absolutos (Admissional/Demissional):** Separação de rubricas pontuais como PCMSO (Exames) da tarifa horária. Agora são injetados de forma absoluta com base na curva do Histograma de Equipe (`equipe_membros`).
- **Simulação On-the-Fly:** Criação do endpoint `GET /api/custos/simulacao-mao-obra` e refatoração da UI (`OSView` e `ComposicaoCustosMaoObraView`) para consulta inteligente do custo das equipes designadas.

---

## Versão 1.4.2 (2026-08-20) - Mapeamento da Cadeia de Processos (CUB e Orçamentação)

### 🧠 1. Expansão da Base de Conhecimento e Agentes
- **Cadeia de Processos Orçamentários**: Mapeamento integral e persistente da arquitetura funcional, partindo da importação de índices **CUB (Sinduscon)**, passando pela estruturação do **Orçamento Base (Valor Global)** até o _handoff_ automatizado para a **EAP do Projeto**.
- **Capacitação do Modelo de Testes**: Definição de invariantes para testes E2E e de integração na esteira orçamentária, garantindo a validação de nós EAP e exatidão matemática dos custos de obra.

---

## Versão 1.4.1 (2026-08-20) - Preparação Módulo II: Valoração de Recursos na OS

### 💰 1. Estrutura Financeira (OS)
- **Campos de Valor nos Recursos**: Inclusão de `valor_materiais`, `valor_ferramentas` e `valor_equipamentos` na Ordem de Serviço, suportando a entrada manual no Módulo I.
- **Formatação de Moeda**: Valores exibidos nativamente em BRL (R$) na visualização do frontend, preparando a base de dados para totalização automática de tabelas filhas no futuro (Módulo II).

## Versão 1.4.0 (2026-08-20) - Estabilidade Cloud, API Proxy e RDO Mobile

### ☁️ 1. Governança e Autenticação na Nuvem (Vercel & Supabase)
- **Supabase Third-Party Auth Integrado**: Configuração nativa via CLI (`supabase config push`) para habilitar o Firebase Auth (`systems-storage`) no Supabase remoto contornando restrições visuais do plano Free, acabando com erros 403 Forbidden.
- **Validador Firebase Serverless**: Injeção da variável de ambiente `FIREBASE_SERVICE_ACCOUNT` no backend, capacitando o Vercel a autenticar as sessões do front-end sem depender de arquivos `.json` sensíveis hospedados.

### 🌐 2. Roteamento e Interoperabilidade
- **API Proxy Unificado**: Adição do proxy `/api` ao `vite.config.ts`, harmonizando o ambiente local com o ambiente de cloud (Vercel) e solucionando bloqueios CORS.
- **RDO Mobile PWA (CORS)**: Abertura das portas de origens no `server.ts` para acesso cross-domain das implantações dos aplicativos móveis PWA (`https://rdo-wm.vercel.app` e `https://rdo-wm-puce.vercel.app`).

### 🗄️ 3. Transição Segura de Dados (Dev -> Prod)
- **Script Autônomo de Migração (Wipe & Sync)**: Implementação do `sync-local-to-web.mjs`. Este pipeline esvazia as tabelas do banco remoto em ordem segura (preservando Foreign Keys) e as realimenta (Upsert) com os dados estruturais de desenvolvimento, garantindo paridade total entre instâncias.


## Versão 1.3.1 (2026-08-20) - Correções de PWA, CORS e Autenticação Zero Trust

### 📱 1. Homologação do RDO_WM como PWA e Ambientes de Produção
- **Configuração de Variáveis na Nuvem (Vercel):**
  - Integração do projeto Vercel (`rdo-wm`) via CLI para injeção nativa da variável `VITE_API_BASE_URL` no bundle de produção estático.
  - O aplicativo Front-End agora não mais executa chamadas em si mesmo (que causavam 404 e falsos logoffs), sendo totalmente acoplado à URL de produção do `gestor-de-obras`.

### 🛡️ 2. Segurança e Comunicação (CORS e Vercel Auth)
- **Deployment Protection da Vercel Desativado:** 
  - A API do `gestor-de-obras` estava bloqueada para chamadas externas devido à proteção nativa da Vercel (`vercel_auth_enabled: true`), retornando um status fixo `401 Unauthorized` por debaixo dos panos. Proteção removida para restaurar o comportamento esperado da API pública protegida por token.
- **Whitelist de CORS no Backend:**
  - O `server.ts` agora aceita explícitamente as novas origens de produção (`https://rdo-wm.vercel.app` e `https://rdo-wm-puce.vercel.app`), resolvendo bloqueios de _preflight_ do navegador.
- **Autorização OAuth do Firebase:**
  - Inserção do domínio produtivo no *Authorized Domains* do console Firebase, liberando popup de login (Google SSO) no domínio customizado.

### 🧠 3. Estabilidade de Middleware de Autenticação
- **Resolução Tolerante de E-mail (Case Insensitive):**
  - O arquivo `mobileAuth.middleware.ts` teve a query de resolução alterada para tolerar diferenças de caixa alta/baixa no retorno do Firebase versus Supabase (mudança de `.eq()` para `.ilike()`). Isso resolveu o problema que mostrava "Acesso Negado: Usuário Não Cadastrado" se houvesse qualquer letra maiúscula na conta Google do usuário.
- **Documentação de Isolamento PWA:**
  - Mapeado no _post-mortem_ interno (`.ai/errors`) a peculiaridade das instâncias PWA em dispositivos móveis que geram um LocalStorage próprio, disparando corretamente a validação _Zero Trust_ e criando status `PENDENTE` independentemente de já haver um navegador comum aprovado para o mesmo usuário.

---

## Versão 1.3.0 (2026-08-18) - Arquitetura, Segregação de Módulos e Gestão de Fornecedores

### 🏛️ 1. Mapeamento Arquitetural (Archify)
- **Diagramas Dinâmicos (`docs/gestor-de-obras-high-level.json`)**:
  - Geração de modelo High-Level focado nos fluxos de Runtime, Componentes Principais e Segurança.
  - Implementação de raias no fluxo do Workflow de Chamada de Ferramentas, evidenciando execução do agente, mitigação e persistência.

### 🧩 2. Segregação Estrutural de Módulos
- **Matriz de Acessos Dinâmica (`MatrizAcessosView.tsx`)**:
  - Reestruturação do componente separando as chaves de permissão em dois tiers: **Módulo I (Executivo/Campo)** e **Módulo II (Custos/Financeiro)**.
  - Troca da lógica visual de botões de ação isolados por uma UX baseada em `checkboxes` para as operações CRUD (Criar, Ler, Atualizar, Deletar), mantendo a integridade da hierarquia de Tenant e Tetos de permissão.

### 🚚 3. Módulo de Cadastro Completo de Fornecedores
- **Flexibilidade JSONB no PostgreSQL**:
  - Nova migração SQL `20260818000000_add_detalhes_empresas.sql` acoplando a coluna `detalhes JSONB` na tabela multitenant nativa `empresas_fornecedores`.
  - Permite evolução infinita do cadastro sem fragmentação de colunas legadas.
- **Formulário de Extensão Cadastral**:
  - Interface avançada subdividida em 4 eixos estruturais: Identificação (CNPJ, IE, IM), Endereço Nacional, Dados de Contato Direto e Dados Financeiros para pagamentos (Banco, Agência, PIX).
- **Workflow de Homologação (Approval Flow)**:
  - Novo status inserido para governança de procurement: `EM_ANALISE`.
  - Fornecedores cadastrados caem na esteira pendente; gestores autorizados validam o perfil trocando o status para `ATIVO` diretamente na grid principal.

---

## Versão 1.2.1 (2026-08-18) - Correções de UI, Data Dump e Estabilidade de Autenticação

### 🎨 1. Hotfixes Visuais e UX
- **Correção da Máscara de CNPJ/CPF (`documentUtils.ts`)**:
  - Implementada coerção rigorosa de string (`String(value)`) na função `formatCpfCnpj` para suportar entradas tipadas como numéricas (vindas de parses do banco), prevenindo o crash oculto e a ausência de formatação.
- **Fallback Inteligente de Avatar (`Header.tsx`)**:
  - Correção do crash visual em que usuários autenticados via E-mail/Senha ficavam com a tag `img` quebrada no navegador.
  - O sistema passa a validar explicitamente se o usuário possui `photoURL` no Firebase e renderiza a primeira letra de seu nome em um círculo colorido de fallback caso não haja.

### 🛡️ 2. Estabilização do Firebase Admin SDK Local
- **Injeção Explícita de Credenciais (`server.ts`)**:
  - Resolvido o erro crítico de sincronização de permissões (claims) `ENOTFOUND metadata.google.internal` ao criar usuários localmente. O backend foi configurado para injetar proativamente o `serviceAccountKey.json` via método `cert()` se a variável de ambiente ADC (`GOOGLE_APPLICATION_CREDENTIALS`) não estiver populada e o arquivo existir.

### 🗄️ 3. Ferramentas de Migração e Operação
- **Script Autônomo de Migração Local->Remoto**:
  - Implementação de um gerador `scripts/export-data-sql.mjs` que varre as tabelas de infraestrutura (`empresa_contratante`, `empresas_fornecedores`, `permissoes_usuario`) e compila statements `INSERT INTO ... ON CONFLICT DO NOTHING`, exportando o arquivo `migration_data.sql` para cópia massiva de dados sem comprometimento de segredos (PII Safe).

---

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
  - **Gerador de Senha Segura Automática**: Criação com 1 clique de senha de 14 caracteres com maiúsculas, minúsculas, números e símbolos, com cópia instantânea para a área de transferência.
  - **Visualização de Senha (`visibility` / `visibility_off`)**: Alternância de visibilidade nos campos de senha e confirmação com botão de cópia direta.
  - **Checklist de Critérios Corporativos & Medidor de Força**: Validação em tempo real de 6 critérios obrigatórios (Mínimo 10 caracteres, maiúsculas, minúsculas, números, símbolos e coincidência) e barra de progresso colorida.
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
