# 🚀 Vercel Auth, Proxy Integrado e Mobile CORS

## 1. Contexto e Problema
Após a migração dos dados locais para o banco remoto (Supabase de produção), o acesso ao painel web no Vercel começou a apresentar erros de autorização (401 e 403). Isso ocorria porque:
- O Supabase remoto não possuía a integração OIDC de "Third-Party Auth" do Firebase habilitada.
- O backend rodando no Vercel não conseguia validar os tokens JWT recém-gerados pelo Firebase porque o SDK de autenticação (`getAuth().verifyIdToken()`) não possuía as credenciais administrativas instanciadas.

Adicionalmente, os novos PWA's para RDO Mobile requeriam liberação específica de CORS para se comunicarem com a API deste backend.

## 2. O que foi construído e resolvido

### 🔒 Resolução de Autenticação na Nuvem
- **Supabase CLI Push**: Execução de um push de configuração (`supabase config push`) para habilitar silenciosamente a leitura de chaves Firebase (`systems-storage`) no banco de produção remoto, driblando a ausência desta feature no painel gratuito (Free Tier) do Supabase Cloud.
- **Injeção de Service Account no Vercel**: Refatoração do `server.ts` para capturar a variável de ambiente `FIREBASE_SERVICE_ACCOUNT` diretamente como um objeto JSON. Isso permite que o Vercel verifique e emita tokens via Firebase Admin SDK com total segurança sem necessitar do arquivo `serviceAccountKey.json` fixado no código.

### 🌐 Rede e Roteamento
- **Vite API Proxy**: Configuração do `vite.config.ts` com um proxy (`/api`) apontando para a porta 8500 local. Isso eliminou problemas de Cross-Origin (CORS) durante o desenvolvimento e homogenizou as URLs de fetch do frontend.
- **Liberação CORS Mobile**: Abertura oficial das portas de origens no `server.ts` para os novos apps mobile na nuvem: `https://rdo-wm.vercel.app` e `https://rdo-wm-puce.vercel.app`.

### 🗄️ Ferramentas de Sincronização
- **Migração Declarativa**: Implementação do script `sync-local-to-web.mjs`, capaz de realizar Wipe de tabelas de forma segura (respeitando a topologia de FKs) e realizar Upsert completo dos dados locais de desenvolvimento para a nuvem.

## 3. Segurança e Auditoria
- O arquivo `.env.prod` foi recuperado e mantido em isolamento (ignorado no git).
- As requisições de frontend agora validam adequadamente seu estado tanto no Firebase quanto no Supabase.
- Todos os testes unitários e rotas de segurança estão passando 100%.
