# Post-Mortem: Autenticação Mobile PWA, CORS e Proteção Vercel

## Contexto do Problema
Durante a homologação do acesso Mobile PWA para o aplicativo **RDO_WM**, múltiplos erros em cascata impediram o carregamento das Ordens de Serviço Ativas na tela inicial. O erro visível para o usuário final era um falso-positivo de "Acesso Negado: Seu e-mail não foi encontrado no cadastro", que disfarçava outros problemas de infraestrutura e rede.

## Causa Raiz e Desdobramentos

O problema foi uma combinação de **4 fatores isolados** na arquitetura de Nuvem (Vercel) e Segurança (Supabase/Firebase/PWA):

1. **Roteamento Interno no Vercel (RDO_WM):** 
   - O App React/Vite (PWA) estava no Vercel como um site estático, mas o código original usava caminhos relativos (ex: `/api/mobile/os/ativas`). Como não havia backend acoplado no `rdo-wm.vercel.app`, a requisição retornava HTTP 404. O interceptor do Axios tratava qualquer 404 como "Erro de Vínculo de Usuário" (`UserNotLinkedError`), disparando o logoff compulsório e a mensagem de Acesso Negado incorreta.

2. **Case-Sensitivity do E-mail (Supabase):**
   - O e-mail de login vindo do Firebase (`Sstulzer@gmail.com`) tinha variação de capitalização (maiúsculas) em relação ao cadastro no Supabase (`sstulzer@gmail.com`). A query original utilizava `.eq("email", emailFirebase)`, o que falhava silenciosamente por ser estritamente *case-sensitive* no PostgreSQL, validando de fato um "Acesso Negado" no middleware.

3. **Vercel Deployment Protection & CORS:**
   - Após corrigir a variável de ambiente `VITE_API_BASE_URL` no RDO_WM para apontar para a API real (`gestor-de-obras-nine.vercel.app`), descobriu-se que o backend estava bloqueado nativamente pelo *Vercel Authentication* (Deployment Protection), retornando HTTP 401 automático.
   - Mesmo após desabilitar a proteção da Vercel, o middleware Express retornou bloqueio de CORS porque o `rdo-wm-puce.vercel.app` não estava na *allowlist* da propriedade `origin` do `app.use(cors({ ... }))`.

4. **Zero Trust no PWA (Isolamento de Dispositivo):**
   - Após liberar o CORS, o acesso web via desktop funcionou, mas no PWA continuou em estado PENDENTE. O PWA de dispositivos móveis cria um sandbox que não compartilha o `localStorage` do navegador. Por isso, a API gerou um novo `device_id` (Zero Trust), que foi corretamente bloqueado pelo backend até a aprovação explícita no painel do administrador (UI de produção).

## Ações Corretivas e Resolução

1. **Correção de Middleware (`mobileAuth.middleware.ts`):** 
   Substituição do método de query do banco de `.eq()` para `.ilike()` na resolução de e-mails do Firebase, tornando a verificação tolerante à capitalização (*case-insensitive*).
2. **Setup do Vercel e Variáveis:** 
   Adição da variável de ambiente `VITE_API_BASE_URL` no Vercel vinculada ao projeto RDO_WM e deploy da versão estática. Desabilitação de "Vercel Authentication" no painel do backend do gestor.
3. **Ampliação do CORS e Firebase Domains:** 
   O novo domínio público da Vercel foi adicionado à lista de origens do backend e incluído nos *Authorized Domains* do Firebase Auth, permitindo a finalização do fluxo OAuth.

## Lições Aprendidas
- Sempre checar se a proteção padrão de deployments da Vercel está desativada em APIs (*Deployment Protection*), pois ela sobrepõe e encobre logs de aplicação.
- PWA instalados funcionam como um novo hardware para fins de Zero Trust (Carteiras de Dispositivos). Isso não é um bug, é a intenção de segurança da arquitetura operando perfeitamente.
- Ao parear Firebase Auth com Supabase, **nunca** buscar e-mails de maneira estrita sem normalizar minúsculas ou usar busca *case-insensitive* (`ilike`).
