# Walkthrough — Cadastramento Direto, Convites e Validação de Usuários por E-mail (2026-08-16)

## 🎯 Objetivo
Implementar e validar os dois procedimentos de inserção de usuários no sistema:
1. **Procedimento 1 (Direto pelo Administrador):** Cadastro realizado na interface administrativa com definição direta de usuário, dados cadastrais e senha.
2. **Procedimento 2 (Via Convite / Invite com Token):** Envio de convite por e-mail com token criptográfico seguro, contendo link de acesso a uma interface pública (em modal no login) que valida o token, recebe os dados e a senha escolhida pelo convidado e envia e-mail de confirmação.

---

## 🛠️ O que foi Implementado

### 1. Backend & Infraestrutura de E-mail ([server.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/server.ts) & [mailer.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/src/utils/mailer.ts))
- **Módulo `mailer.ts`**:
  - Suporte completo a transporte SMTP real (configurável via `.env`) com fallback automático para **Ethereal Email** em desenvolvimento.
- **`POST /api/convites`**:
  - Cria registro na tabela `convites` com UUID randômico, `expires_at` configurado para 7 dias, status `PENDENTE`, vínculo com tenant e perfil atribuído.
  - Dispara e-mail formatado em HTML com botão e link direto: `${origin}/?inviteToken=${token}`.
- **`GET /api/convites/:token`**:
  - Endpoint público para validação do token, verificação de expiração temporal e retorno dos dados para o formulário de onboarding.
- **`POST /api/convites/accept`**:
  - Cria conta de usuário no Firebase Auth e na tabela `usuarios` do Supabase.
  - Aplica seeding automático de permissões a partir do template do perfil (`permissoes_tipo`).
  - Atualiza o status do convite para `USADO`.
  - Dispara e-mail de boas-vindas e confirmação de cadastro concluído para o usuário.
- **`POST /api/usuarios`**:
  - Cadastro direto de usuário por administradores com suporte a senha inicial (`password` / `senha`).

### 2. Interface do Usuário ([UsuariosView.tsx](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/src/components/UsuariosView.tsx) & [LoginScreen.tsx](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/src/components/LoginScreen.tsx))
- **Modal de Gestão de Usuários (`UsuariosView.tsx`)**:
  - Seletor de modo de inserção: **"Cadastrar Diretamente com Senha"** vs. **"Enviar Convite por E-mail"**.
  - Aba de monitoramento de convites com status (`PENDENTE`, `USADO`, `EXPIRADO`), data de envio e botão de reenvio.
- **Modal Público de Aceite de Convite (`LoginScreen.tsx`)**:
  - Captura automática do parâmetro `inviteToken` na URL.
  - Exibição de modal com dados pré-preenchidos (e-mail, perfil, empresa) e campos para nome e criação de senha.

---

## 🧪 Validação dos Testes
- Testes de integração em `tests/integration/usuarios.routes.test.ts` e `tests/integration/security.routes.test.ts`.
