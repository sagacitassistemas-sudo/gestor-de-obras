# Post-Mortem: Drift Arquitetural do Motor do Cronograma vs UI e DB

**Data:** 14/08/2026
**Domínio:** Engine de Cronogramas, Gantt, Single Source of Truth, Postgres Triggers

---

## 📌 O PROBLEMA DE DRIFT (DESVIO ARQUITETURAL)

O sistema de cálculo do Gantt apresentava inconsistências massivas (diferenças entre o que a tela mostrava e o que o banco salvava). A causa raiz foi a proliferação de lógicas de agendamento: tínhamos 3 "cérebros" independentes tentando calcular datas, com regras ligeiramente divergentes.

1. **O Motor Oficial:** `cronogramaEngine.ts`
2. **As Funções Duplicadas na UI:** `CronogramaExecutivoView.tsx`
3. **O Banco de Dados:** `calc_datas_eap_trigger` no PostgreSQL

## 🚨 ERROS IDENTIFICADOS & CAUSAS RAIZ

### 1. Conflito UI vs Banco (Trigger Sobrescrevia a Engine)
- **Erro:** O cliente rodava a Engine, validava a precedência e a cascata (ex: enviando Data Início = 20), mas ao salvar, o Trigger do banco ignorava o input e tentava deduzir sua própria data, baseando-se no estado antigo de tarefas que não haviam atualizado ainda.
- **Consequência:** A tela redesenhava corretamente, mas o "salvar" destruía a edição, resultando em sobressaltos e corrupção das ligações.

### 2. Funções Duplicadas (`rollupSummaries` vs `executeSummaryRollup`)
- **Erro:** O componente React tinha ~150 linhas recriando funções matemáticas (diffDays, addDays, rollupSummaries) ao invés de usar a Engine pura. O rollup local possuía um bug que excluía as próprias tarefas sumárias intermediárias ao validar o limite de tempo dos filhos.
- **Consequência:** Estruturas com 3 ou mais níveis hierárquicos ficavam com as datas sumárias estagnadas ou com larguras erradas, porque as pastas do nível do meio eram cegas no cálculo.

### 3. Falsa Herança de Predecessoras em `propagateDeps` local
- **Erro:** Se uma macroetapa inteira dependesse do fim da escavação, a Engine corretamente dizia que todos os filhos dessa macroetapa herdavam esse limite temporal. A função duplicada no React não herdava nada.
- **Consequência:** Filhos de pastas conectadas iniciavam visualmente no passado.

### 4. Recálculo Inútil no SVG/SVAR
- **Erro:** A função `buildGanttData` pegava os dados *já perfeitamente calculados pelo motor*, descartava o `data_fim` que custou milissegundos para gerar, e tentava calcular um novo `data_fim` com funções React locais.

---

## 🛠️ SOLUÇÕES IMPLEMENTADAS

1. **Trust The Engine (Trigger Migration):** O trigger do PostgreSQL foi modificado (migration `20260814100000`). Agora, se os 3 pilares (`data_inicio`, `data_fim`, `duracao_dias`) chegam pelo Payload de forma matematicamente idêntica ($Fim = Inicio + Duracao - 1$), o Banco "confia" na UI e pula a repetição de lógica.
2. **Single Source of Truth na UI:** A função mestra `computeFullSchedule` foi criada. Ela lê as tarefas, calcula dominó, calcula rollup, embute +1 dia pro SVAR e cospe os arrays 100% prontos. O `CronogramaExecutivoView.tsx` perdeu 150 linhas de duplicação lógica.
3. **Invariante Consertada:** Remoção da condicional estrita `c.e_analitico` durante a verificação de Rollup. Agora os pais avaliam todos os descendentes (folhas e pastas) para definir sua largura.

---

## 🎯 REGRAS INVIOLÁVEIS DO CRONOGRAMA

1. **PROIBIDO DUPLICAR ENGINE:** Nenhum componente React, Vue ou CLI deve recalcular dias (`diffDays`, `addDays`) manualmente se lidar com Cronograma. Sempre utilize o `cronogramaEngine.ts`.
2. **TRUST, BUT VERIFY NO BANCO:** Os Triggers servem como rede de proteção, mas não como inimigos do frontend. O Trigger só recalcula se chegar um pedido de edição que não mandou datas matemáticas válidas.
3. **NENHUM RE-CÁLCULO NA EXIBIÇÃO:** A camada de visualização (buildGanttData) é burra. Ela só recebe os dados, acopla a diferença inclusiva/exclusiva de ponteiro (ex: +1 dia no `end`), mapeia cores e renderiza. Zero lógica dominó ali.
