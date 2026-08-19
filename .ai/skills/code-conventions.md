# 🏗️ Convenções de Código e Mapeamento de Arquitetura (Code Conventions)

Este documento foi compilado de forma autônoma pela Auditoria de Engenharia Reversa para consolidar o Perfil Técnico do projeto `gestor-de-obras`. Ele serve como norteador absoluto para a escrita de novos códigos, garantindo consistência e impedindo o inchaço de dependências.

---

### 1. Stack Tecnológico & Dependências Principais
- **Linguagem e Runtime:** TypeScript (v5.8.x) rodando em ambiente Node.js (v22.x). O backend Express é "esbuildado" com a flag `--platform=node`.
- **Framework Frontend:** React 19 (`^19.0.1`) empacotado por Vite (`^6.2.3`).
- **Estilização UI:** TailwindCSS v4.
- **Backend / Persistência / Auth:** Express Server híbrido, Firebase Auth + Firebase Admin (Gerenciamento de Identidade OAuth), conectado a um Banco de Dados PostgreSQL (Supabase / @supabase/supabase-js).
- **Suíte de Testes:** Vitest para TDD/integração + Supertest para testes de rotas da API HTTP.

> [!WARNING] 
> **RESTRIÇÃO DE BIBLIOTECAS (NÃO ADICIONAR):**
> - **Http Client:** Não instale Axios (o projeto usa a Fetch API nativa globalmente).
> - **Validação de Schema:** Não instale Zod, Yup ou Joi. A validação é explícita via condicionais ou regex diretas.
> - **Gerenciadores de Estado:** Não adicione Redux, MobX, Zustand ou Recoil (Apenas React puro e context são utilizados).
> - **Manipulação de Datas:** Não adicione Moment.js ou date-fns. As operações utilizam a API estrita `Date()` (`toISOString()`).

### 2. Dicionário de Tipagem e Convenções de Variáveis
- **Arquivos de Tipagem:** Os tipos são sempre isolados na pasta `src/types/` e devem conter o sufixo `.types.ts` (ex: `cerne.types.ts`).
- **Nomenclatura de Interfaces:** PascalCase **limpo**. Não se utiliza o prefixo `I` nem o sufixo `Type` (Ex: `PermissoesUsuario` em vez de `IPermissoesUsuario` ou `CerneEmpresa` em vez de `EmpresaType`).
- **Nomenclatura de Propriedades (Interfaces vs Banco de Dados):**
  - O banco PostgreSQL utiliza estritamente o formato `snake_case` (ex: `contrato_id`, `cnpj_cpf`, `total_faturado`).
  - As interfaces TypeScript podem mesclar as abordagens: campos de negócio que vêm direto do Supabase são comumente tipados em `snake_case`, mas campos de interação de UI utilizam `camelCase`. Existe um mapper explícito no `server.ts` traduzindo a ida e a volta (`row.total_faturado -> item.totalFaturado`).
- **Valores Financeiros e Quantitativos:** Valores monetários são tipados e manipulados explicitamente como o primitivo `number` (ex: `totalFaturado: number`). No trânsito entre JS e PostgreSQL (`NUMERIC`), realiza-se o casting via `Number()`.
- **Identificadores (IDs):** IDs de registros são textuais, semânticos e gerados programaticamente utilizando um prefixo do negócio (ex: `EMP-...` para empresas, `CTR-...` para contratos), além de UUIDs nativos do Postgres. A chave de isolamento *Zero Trust* de banco é `contrato_id`.

### 3. Padrão de Manipulação de Estado e Mutabilidade
- **Paradigma Front-End:** Funções React puras (Functional Components) e hooks nativos (`useState`, `useEffect`). O estado de listas de objetos (`empresas`, `funcionarios`) é gerenciado no topo (`App.tsx`) e injetado via prop drill nas views, que cuidam de criar as fatias imutáveis durante as deleções ou atualizações (`setEmpresas(empresas.map(e => e.id === mod.id ? mod : e))`).
- **Validação de Domínio:** A validação e a higienização de inputs ocorrem primeiro no Frontend (sanitizadores `.replace(/[<>]/g, '')`) para evitar XSS, antes da injeção do Fetch.
- **Resiliência e Fallback:** O Backend de roteamento Express (`server.ts`) adota forte manipulação de erros (blocos Try/Catch estruturados com logs via `console.error`). Ele conta com fallback em mapas na memória local (ex: `inMemoryEmpresas.set()`) no caso de o Supabase retornar falha ou tempo de inatividade. O `HTTP Status Code` padronizado define erros sintáticos (400), bloqueios de acesso (401, 403) ou crashe de API (500).

### 4. Inventário de Utilitários Reutilizáveis (Utils/Helpers)
As lógicas comuns estão isoladas em `/src/utils/`. Não recrie funções que operam estes fluxos:
- **`src/utils/documentUtils.ts`**: Ferramentas de validação criptográfica (Módulo 11) e formatação de Documentos Nacionais.
  - Formatação: `formatCpfCnpj()`, `formatCPF()`, `formatCNPJ()`
  - Validação Booleana: `isValidCpfCnpj()`, `isValidCPF()`, `isValidCNPJ()`
- **`src/utils/cronogramaEngine.ts`**: Complexo motor de cálculos de folga, dependências, datas de início e fim e renderização para gráficos Gantt e fluxo financeiro das Obras (EAP).
- **`src/utils/msProjectXmlParser.ts`**: Ferramenta de desestruturação XML e conversão da topologia do *Microsoft Project* (`.xml`) para o banco do Gestor de Obras.
- **`src/utils/cronogramaExport.ts`**: Wrapper que orquestra e formata a exportação de tabelas de Gantt para planilhas limpas do Excel usando o plugin `exceljs`.
- **`src/utils/mailer.ts`**: Configuração central do transportador SMTP via `nodemailer` com injeção segura de contas de ambiente.
