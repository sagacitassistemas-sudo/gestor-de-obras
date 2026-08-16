# Walkthrough — Empresa Gestora, Reconhecimento de Acesso Master & Canal de Contingência (2026-08-16)

## 🎯 Objetivo
Estruturar o tipo de empresa **`GESTORA`** no cadastro de empresas, garantir privilégios máximos irrestritos e disponibilizar o envio de e-mail oficial com o **Certificado de Reconhecimento de Acesso Master**, canal de contingência e token assinado de redefinição de emergência (24h) para casos de perda de credenciais ou problemas no login.

---

## 🛠️ O que foi Implementado

### 1. Entidade Gestora do Sistema & Banco de Dados
- Atualizada restrição check no PostgreSQL para permitir `tipo = 'GESTORA'`.
- Cadastrada a empresa `GER-2026-SYS` ("Gestora do Sistema") no tenant `CTR-2026-SYS`.
- Habilitadas as 19 permissões na tabela `permissoes_empresa` para `GER-2026-SYS`.
- Vinculado o e-mail master `sagacitas.sistemas@gmail.com` como `ADMIN` associado à Gestora.

### 2. Backend & Rotas de Contingência ([server.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/server.ts))
- **`POST /api/gestora/send-confirmation`**:
  - Dispara e-mail com layout corporativo contendo os dados da empresa, declaração de 19 permissões ativas e botão seguro com token de contingência (`/?resetToken=...`).
  - Registra evento de auditoria `GESTORA_ACCESS_CONFIRMATION`.
- **`POST /api/auth/request-password-reset`**:
  - Solicitação de redefinição de senha conectada ao botão "Esqueceu a senha?" do login.
- **`POST /api/auth/reset-password-with-token`**:
  - Validação do token JWT e atualização segura da senha do usuário.
  - Implementado o helper de resiliência `getSafeAdminAuth()` em todo o backend para evitar erros `500 Internal Error` quando o Firebase Admin SDK opera em modo de desenvolvimento local ou fallback sem chave de serviço.
  - Sincronização e persistência de senhas na base do Supabase/banco local.

### 3. Frontend ([EmpresasView.tsx](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/src/components/EmpresasView.tsx) & [LoginScreen.tsx](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/src/components/LoginScreen.tsx))
- **Badge e Ações em `EmpresasView.tsx`**:
  - Destaque visual âmbar com ícone de escudo para a empresa Gestora.
  - Ação rápida na tabela (`mark_email_read`) e card completo no modal de detalhes com botão **"Enviar E-mail de Reconhecimento & Recuperação Master"**.
- **Assistente de Recuperação no Login (`LoginScreen.tsx`)**:
  - Leitura automática do token na URL e tela dedicada de redefinição com validação de senha.
  - **Gerador de Senha Automática (14 caracteres)**: Gera instantaneamente senha forte contendo letras maiúsculas, minúsculas, números e símbolos especiais, copiando automaticamente para a área de transferência com toast de confirmação.
  - **Visualização de Senha**: Botões de alternância de visibilidade (`visibility` / `visibility_off`) nos campos de nova senha e confirmação.
  - **Indicador de Força & Checklist de Critérios**: Barra dinâmica de força (Fraca / Média / Excelente) e grid de validação em tempo real de 6 critérios corporativos:
    - Mínimo de 10 caracteres
    - Letra maiúscula (A-Z)
    - Letra minúscula (a-z)
    - Número (0-9)
    - Símbolo especial (!@#$...)
    - Senhas coincidentes
  - Botão de envio desabilitado até que todos os critérios de segurança sejam rigorosamente satisfeitos.

---

## 🧪 Validação dos Testes
- **94 testes passando em 9 suítes** no Vitest com 100% de sucesso.
- Checagem estática TypeScript (`tsc --noEmit`) com 0 erros.
