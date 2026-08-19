# Post-Mortem: Máscara de CNPJ, Firebase Admin Credentials e Hot-Reload (Vite vs Express)

## 1. Falha na Máscara de CNPJ/CPF
**Sintoma:** O campo de CNPJ renderizava na tabela sem formatação (ex: `21047056000171`), e ao tentar salvar o formulário de edição, ocorria erro (crash invisível ou formatação não aplicada).
**Causa:** A API (PostgreSQL/Supabase) retornava o campo `cnpj_cpf` tipado como `Number` (dependendo de como o driver do banco serializa ou como o JS interpreta), mas a função `formatCpfCnpj` em `documentUtils.ts` esperava estritamente uma `string`. O método `value.replace()` quebrava (`is not a function`) silenciosamente em certos contextos, impedindo a formatação.
**Solução:** Coerção explícita de tipo com `String(value).replace(/\D/g, '')` antes de qualquer manipulação de regex.

## 2. Erro de Credencial do Firebase Admin (ENOTFOUND metadata.google.internal)
**Sintoma:** Ao registrar um novo usuário ou chamar `/api/auth/sync-claims`, o servidor disparava `Credential implementation provided to initializeApp() via the "credential" property failed to fetch a valid Google OAuth2 access token`.
**Causa:** No ambiente local, quando a variável de ambiente `GOOGLE_APPLICATION_CREDENTIALS` não estava definida, o `firebase-admin` tentava usar o "Application Default Credentials" (ADC). O ADC, por padrão, tenta contatar o servidor de metadados do Google Cloud (GCP). Como estávamos rodando localmente, o DNS `metadata.google.internal` não existia, gerando o erro `ENOTFOUND`.
**Solução:** Alterado `server.ts` para verificar a existência física do arquivo `serviceAccountKey.json` e passá-lo explicitamente via `cert(serviceAccount)` na chamada do `initAdminApp()`, evitando o fallback para o servidor de metadados do GCP.

## 3. Armadilha do Hot-Reload (Vite vs Servidor Express Estático)
**Sintoma:** As alterações feitas no frontend (React) não refletiam no navegador do usuário mesmo após múltiplos "F5".
**Causa:** O ambiente de desenvolvimento estava rodando via `npm run dev:repair`, que na verdade executa o `server.ts` (backend Express). O Express estava servindo a pasta `/dist` (arquivos estáticos compilados antigos). Como o Vite (dev server com Hot Module Replacement) não estava ativo, nenhuma alteração nos arquivos `.tsx` ou `.ts` do frontend chegava ao navegador.
**Solução:** Intervenção manual obrigatória via `npm run build` para recompilar a pasta `/dist` antes de solicitar ao usuário que desse refresh (F5) na página, garantindo que o bundle do frontend injetado no Express fosse atualizado.

## 4. Crash de Imagem Quebrada (Avatar)
**Sintoma:** A foto do usuário no Header exibia o ícone clássico de "imagem quebrada" do navegador.
**Causa:** A refatoração do estado inicial de `App.tsx` alterou `avatarUrl` de `""` (string vazia) para `undefined`. O React renderizava `<img src={undefined}>`, resultando em um atributo `src` inválido no DOM.
**Solução:** Implementação de renderização condicional (`user.avatarUrl ? <img ... /> : <span>{inicial}</span>`), criando um fallback elegante com a inicial do usuário caso a imagem do Google Firebase Auth não exista.
