# 📚 Catálogo Histórico de Walkthroughs — Works Manager (Gestor de Obras)

Este diretório armazena todos os registros históricos de implementação, correções arquiteturais, auditorias de segurança e novas funcionalidades concluídas na plataforma.

> [!IMPORTANT]
> **GATE DE QUALIDADE MANDATÓRIO**: O arquivamento de qualquer documento nesta pasta `.history/` é **estritamente condicional** à execução e aprovação total de 100% da suíte de testes (`npm run test`) e da checagem estática de tipos (`npx tsc --noEmit` com 0 erros). Documentos de implementações com testes pendentes ou falhando **NUNCA** devem ser arquivados aqui.

---

## 🗂️ Registro Cronológico de Walkthroughs

| Data | Arquivo | Domínio | Resumo |
|---|---|---|---|
| **2026-08-16** | [2026-08-16_gestora_master_access_contingency_e_password_reset.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history/2026-08-16_gestora_master_access_contingency_e_password_reset.md) | `Segurança / Gestora / Auth` | Implementação do e-mail de reconhecimento de acesso master e contingência da Gestora com token de redefinição de emergência (24h) e assistente no login. |
| **2026-08-16** | [2026-08-16_security_audit_rls_hardening_e_tenant_isolation.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history/2026-08-16_security_audit_rls_hardening_e_tenant_isolation.md) | `Segurança / RLS / Postgres` | Auditoria completa de segurança, unificação de isolamento por tenant `(request.jwt.claims->>'contrato_id')`, expiração de convites, consolidação de policies e fallback *Deny-by-Default*. |
| **2026-08-16** | [2026-08-16_cadastramento_convites_validacao_usuarios.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history/2026-08-16_cadastramento_convites_validacao_usuarios.md) | `Usuários / Convites / E-mail` | Implementação do fluxo duplo de cadastro de usuários (admin direto com senha + convite por e-mail com token validado em modal público). |
| **2026-08-04** | [2026-08-04_tdd_architecture_and_test_suites.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.history/2026-08-04_tdd_architecture_and_test_suites.md) | `TDD / Vitest / Mock BD` | Estruturação da arquitetura TDD com Vitest, Supertest e banco de dados em memória para testes rápidos e determinísticos. |

---

## 📌 Diretrizes de Manutenção da Pasta `.history`
1. Sempre que uma nova funcionalidade, refatoração estrutural ou correção crítica for concluída, registre o walkthrough correspondente nesta pasta.
2. Utilize o formato de nomenclatura: `AAAA-MM-DD_nome_descritivo_do_walkthrough.md`.
3. Mantenha os links atualizados no presente catálogo `README.md`.
