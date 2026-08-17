# Walkthrough — Implementação de TDD no Works Manager (2026-08-04)

## 🎯 Objetivo Concluído
Implementação de uma arquitetura robusta de **Test-Driven Development (TDD)** utilizando **Vitest** + **Supertest**, com **banco de dados 100% em memória** para validação rápida e determinística sem depender de instâncias externas do Supabase ou Firebase reais.

---

## 🛠️ Arquivos Criados e Modificados

### 1. Infraestrutura de Testes
- [vitest.config.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/vitest.config.ts) — Configuração do runner com ambiente Node e timeouts.
- [tests/setup.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/setup.ts) — Setup global com mocks de Vite, Firebase Admin SDK e Google GenAI.
- [tests/helpers/db.helpers.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/helpers/db.helpers.ts) — Banco de dados em memória mutável (`resetDb`, `getDb`, client mock do Supabase chainable e thenable).
- [tests/helpers/auth.helpers.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/helpers/auth.helpers.ts) — Gerador de JWTs de teste assinados por perfil (`adminToken`, `gestorToken`, `visitanteToken`, `financeiroToken`).

### 2. Suítes de Teste Iniciais
- [tests/unit/verifyFirebaseJWT.test.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/unit/verifyFirebaseJWT.test.ts) — Validação do middleware de autenticação (ausência de token, formato inválido, assinatura, extração de claims).
- [tests/unit/permissions.test.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/unit/permissions.test.ts) — Validação isolada da hierarquia de 4 níveis (`getComputedPermissions` e `checkPermission`).
- [tests/integration/auth.routes.test.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/integration/auth.routes.test.ts) — Auto-registro de Primeiro Admin, VISITANTE, bloqueio de usuários com status `BLOQUEADO` e MFA 2FA challenge.
- [tests/integration/empresas.routes.test.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/integration/empresas.routes.test.ts) — Guards 401/403/200 na listagem e cadastro de empresas.
- [tests/integration/usuarios.routes.test.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/integration/usuarios.routes.test.ts) — CRUD de usuários e seeding automático de `permissoes_usuario` a partir de templates de tipo.

### 3. Melhorias e Correções no Backend (`server.ts`)
Durante a fase **RED** do TDD, a suíte identificou a ausência de verificações de `checkPermission` em endpoints chave:
- **`GET /api/empresas`**: Adicionada checagem `checkPermission(req, "empresas_ler")` (retorna 403 para usuários sem acesso).
- **`POST /api/empresas`**: Adicionada checagem `checkPermission(req, "empresas_criar")` e tratamento de ID autogerado.
- **`GET /api/usuarios`**: Adicionada checagem `checkPermission(req, "usuarios_ler")`.
- **`POST /api/usuarios`**: Adicionada checagem `checkPermission(req, "usuarios_criar")`.

---

## 🚀 Como Executar
```bash
# Executar todos os testes uma vez
npm run test

# Modo TDD interativo (watch)
npm run test:watch
```
