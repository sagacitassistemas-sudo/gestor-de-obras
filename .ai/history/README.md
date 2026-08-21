# 🧠 AI Ledger - Works Manager (Gestor de Obras)

Este documento serve como o **Livro de Registros (Ledger) da IA**. Ele contém o sumário cronológico contínuo de todas as funcionalidades, regras de negócios e integrações construídas.

**Obrigatório**: Todo agente de IA DEVE ler este arquivo ao iniciar uma nova sessão de codificação para entender o estado atual do sistema e evitar regressões.

---

## 📅 2026-08-17 - Módulo de Avaliação 360 e Matriz de Competências
- **Contexto**: O sistema agora gerencia a alocação de mão de obra de campo sob as normas do DER, exigindo validação de competências técnicas, soft skills e de SSMA (NRs).
- **O que foi construído**:
  - Tabela `competencias_catalogo`: Biblioteca global de competências dividida em 4 eixos (Técnicas, Cálculo, Comunicação e SSMA), amarrada à `especialidade_id`.
  - Tabelas `avaliacoes_desempenho` e `avaliacao_itens`: Para registros das notas dos funcionários por parte dos gestores.
  - RPC Database Function `check_funcionario_rdo_eligibility`: Trava de segurança no banco de dados. Verifica se a média de "Comunicação" do funcionário é >= 3 (ou = 5 para funções de chefia) para liberar sua assinatura nas frentes de serviço (RDO).
  - Tabela de ponte `rdo_frentes_servico`: Permite vincular as mãos de obra cadastradas diretamente às frentes de trabalho do RDO diário.
  - Endpoint `GET /api/funcionarios/:id/treinamentos-status`: Compara os treinamentos do colaborador com o `treinamento_obrigatorio` do catálogo de SSMA para alertar validade de NRs.
  - UIs: `PerfilCompetenciasView.tsx` (Avaliação 360 do funcionário com gráficos) e `GestaoCompetenciasModal.tsx` (Gerenciador do catálogo amarrado às especialidades).
- **Notas Técnicas**:
  - Tudo foi injetado mantendo a regra de restrição multi-tenant (RLS filtrando por `tenant_id = current_setting('app.current_contrato_id')`).

---

## 📅 2026-08-16 - Hardening de RLS e Segurança Governamental (v1.2.0)
- **Contexto**: Aumento do escrutínio da governança de dados. Foi implementado o isolamento definitivo do Supabase usando `request.jwt.claims->>'contrato_id'` no RLS.
- **O que foi construído**:
  - Migração `20260816091200_rls_hardening.sql`: Trancou RDOs e O.S. exclusivamente no escopo do contrato do JWT.
  - Empresa "Gestora do Sistema": `GER-2026-SYS` implementada via Seeds, permitindo que a Sagacitas atue como First Admin (com bypass de restrições globais).
  - Bloqueio Estrito no Banco: A policy `pu_admin_modify` impede usuários normais de inflarem suas próprias permissões (`v_permissoes_efetivas`).
  - Segurança de Acesso: Links temporários por e-mail, senha master de 14 caracteres com checklist corporativo.

---

## 📅 2026-08-01 a 2026-08-14 - Infraestrutura Base (v1.0.0 a v1.1.1)
- O projeto iniciou usando *Supabase* para DB (PostgreSQL) + RLS nativo, e *Firebase* para OAuth Frontend. O link entre eles ocorre via *JWT Handoff* (Firebase cria sessão, node emite JWT assinado com claims do contrato, frontend o injeta no `supabaseClient`).
- O sistema tem um modelo de permissão em **4 Níveis**: Tenant (Contrato) -> Tipo Empresa -> Empresa Específica -> Usuário Físico.
- Módulos existentes: DRE e Viabilidade, EAP Rodoviário, Cadastro Geral, Ordens de Serviço e Componentes UI em Tailwind.
# 📚 Catálogo Histórico de Walkthroughs — Works Manager (Gestor de Obras)

Este diretório armazena todos os registros históricos de implementação, correções arquiteturais, auditorias de segurança e novas funcionalidades concluídas na plataforma.

> [!IMPORTANT]
> **GATE DE QUALIDADE MANDATÓRIO**: O arquivamento de qualquer documento nesta pasta `.ai/history/` é **estritamente condicional** à execução e aprovação total de 100% da suíte de testes (`npm run test`) e da checagem estática de tipos (`npx tsc --noEmit` com 0 erros). Documentos de implementações com testes pendentes ou falhando **NUNCA** devem ser arquivados aqui.

---

## 🗂️ Registro Cronológico de Walkthroughs

| Data | Arquivo | Domínio | Resumo |
|---|---|---|---|
| 2026-08-20 | [Auditoria de Variáveis Zeradas](2026-08-20_auditoria_variaveis_zeradas.md) | Backend/Testes | Identificação e interceptação de variáveis zeradas no cálculo do motor dinâmico com retorno da flag `pendencias` para a UI de Compliance. |
| 2026-08-21 | [Auditoria de UI na OS](2026-08-21_auditoria_ui_os.md) | UI/Validação | Inclusão de regras visuais p/ alertar ausência de custo e escopo na OS (Mão de Obra, Mat, Ferra, Equip). |
| 2026-08-20 | [Motor Dinâmico de Mão de Obra](2026-08-20_motor_dinamico_mao_obra.md) | Engenharia de Custo | Integração do custo horista EAP + Custos Absolutos (PCMSO). Mock supertest ajustado. |
| **2026-08-20** | [2026-08-20_cadeia_processos_orcamentacao.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/.ai/history/2026-08-20_cadeia_processos_orcamentacao.md) | `Orçamentação` | Mapeamento integral da cadeia CUB -> Orçamento Base -> EAP -> Financeiro, atualizando o modelo de agentes e testes E2E. |
| **2026-08-20** | [2026-08-20_vercel_auth_and_mobile_cors.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/.ai/history/2026-08-20_vercel_auth_and_mobile_cors.md) | `Cloud / Vercel / CORS` | Integração do Vercel com chave Firebase Admin SDK (env vars), liberação de CORS para apps mobile e deploy oculto de Firebase Auth via CLI no Supabase. |
| **2026-08-19** | [2026-08-19_api_rdo_mobile_backend.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/.ai/history/2026-08-19_api_rdo_mobile_backend.md) | `RDO Mobile / API` | Construção do backend para o RDO de campo (App Mobile), incluindo Mappers, Auth por Dispositivo e Idempotência de protocolos offline. |
| **2026-08-19** | [2026-08-19_automation_loop_and_invariants.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/.ai/history/2026-08-19_automation_loop_and_invariants.md) | `Automação / CI-CD` | Implementação de invariantes de negócio e automação do loop de desenvolvimento e testes. |
| **2026-08-18** | [2026-08-18_arquitetura_modulos_e_fornecedores.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Obras/Sistema/gestor-de-obras/.ai/history/2026-08-18_arquitetura_modulos_e_fornecedores.md) | `Arquitetura / Fornecedores` | Diagramas Archify, divisão do sistema em Módulos I e II na Matriz, e criação do Módulo de Fornecedores com JSONB. |
| **2026-08-16** | [2026-08-16_gestora_master_access_contingency_e_password_reset.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.ai/history/2026-08-16_gestora_master_access_contingency_e_password_reset.md) | `Segurança / Gestora / Auth` | Implementação do e-mail de reconhecimento de acesso master e contingência da Gestora com token de redefinição de emergência (24h) e assistente no login. |
| **2026-08-16** | [2026-08-16_security_audit_rls_hardening_e_tenant_isolation.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.ai/history/2026-08-16_security_audit_rls_hardening_e_tenant_isolation.md) | `Segurança / RLS / Postgres` | Auditoria completa de segurança, unificação de isolamento por tenant `(request.jwt.claims->>'contrato_id')`, expiração de convites, consolidação de policies e fallback *Deny-by-Default*. |
| **2026-08-16** | [2026-08-16_cadastramento_convites_validacao_usuarios.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.ai/history/2026-08-16_cadastramento_convites_validacao_usuarios.md) | `Usuários / Convites / E-mail` | Implementação do fluxo duplo de cadastro de usuários (admin direto com senha + convite por e-mail com token validado em modal público). |
| **2026-08-04** | [2026-08-04_tdd_architecture_and_test_suites.md](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/.ai/history/2026-08-04_tdd_architecture_and_test_suites.md) | `TDD / Vitest / Mock BD` | Estruturação da arquitetura TDD com Vitest, Supertest e banco de dados em memória para testes rápidos e determinísticos. |

---

## 📌 Diretrizes de Manutenção da Pasta `.history`
1. Sempre que uma nova funcionalidade, refatoração estrutural ou correção crítica for concluída, registre o walkthrough correspondente nesta pasta.
2. Utilize o formato de nomenclatura: `AAAA-MM-DD_nome_descritivo_do_walkthrough.md`.
3. Mantenha os links atualizados no presente catálogo `README.md`.
