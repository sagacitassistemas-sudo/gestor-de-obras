# Walkthrough — Auditoria de Segurança, Hardening de RLS e Isolamento de Tenant (2026-08-16)

## 🎯 Objetivo
Auditar completamente a infraestrutura de Row-Level Security (RLS) no PostgreSQL, eliminar inconsistências e vulnerabilidades no isolamento por tenant, corrigir conflitos de políticas e garantir governança restritiva na matriz de permissões.

---

## 🛠️ Ações de Hardening Executadas

### 1. Migração de RLS para Padrão Unificado de Claims
- Identificadas políticas legadas nas tabelas `rdos`, `rdo_items`, `rdo_photos` e `ordens_servico` que dependiam de `app.current_tenant`.
- Migradas todas as políticas para o padrão corporativo de JWT:
  ```sql
  (tenant_id::text = (current_setting('request.jwt.claims', true)::json->>'contrato_id'))
  ```

### 2. Consolidação de Políticas em `empresas_fornecedores`
- Removidas 3 políticas redundantes e criadas:
  - `ef_tenant_select`: Leitura autorizada para usuários autenticados do tenant.
  - `ef_tenant_modify`: Escrita (`INSERT`, `UPDATE`, `DELETE`) restrita a perfis `ADMIN` e `GESTOR`.

### 3. Governança na Matriz de Permissões (`permissoes_usuario`)
- Criadas as políticas:
  - `pu_tenant_select`: Leitura no tenant.
  - `pu_admin_modify`: Modificação restrita a administradores (`ADMIN`), impedindo que operadores alterem seus próprios tetos de acesso via chamadas diretas ao cliente de banco.

### 4. Controle Temporal e Correção de Typo em `convites`
- Adicionada coluna `expires_at` com default de 7 dias.
- Corrigido typo `jwt.claim.sub` $\rightarrow$ `request.jwt.claims` na policy `tenant_admin_convites`.
- Criada policy `public_read_convite_by_token` para consulta pública segura.

### 5. Fallback Seguro *Deny-by-Default* no Backend
- Em [server.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/server.ts), a função `getComputedPermissions()` foi configurada para definir `medicoes_ler`, `financeiro_ler`, `relatorios_ler` e `usuarios_ler` como `false` por padrão.

---

## 🧪 Validação dos Testes
- Suíte `tests/integration/security.routes.test.ts` validando expiração de convites e bloqueio de acessos não autorizados.
