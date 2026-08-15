---
name: cronograma-engine
description: Regras fundamentais e documentação da API de uso do motor do cronograma (Gantt) do projeto Gestor de Obras. Leitura obrigatória antes de modificar lógicas de dependência, EAP, ou interações com SVAR Gantt.
---

# Motor do Cronograma (cronogramaEngine)

O projeto usa o **Single Source of Truth Pattern** para lidar com datas e dependências. Todo o cálculo matemático e hierárquico da EAP (Estrutura Analítica do Projeto) ocorre puramente no arquivo `src/utils/cronogramaEngine.ts`. 

> [!WARNING]  
> É estritamente proibido criar lógicas locais no React para recalcular rollups, somar/subtrair dias ou ajustar limites. A UI (como `CronogramaExecutivoView`) só deve mapear a saída deste motor.

## A Arquitetura do Pipeline

O motor funciona seguindo uma sequência estrita, encapsulada pela função `computeFullSchedule`:

1. **Parse Hierárquico:** Constrói as árvores de níveis com base em `eap_codigo` e `eap_pai_codigo`.
2. **Propagação Dominó (Auto-Scheduling):** Caminha por toda a rede de restrições (`calculatePredecessorRequiredStart`), empurrando tarefas para frente baseando-se nos 4 tipos de vínculos lógicos (FS, SS, FF, SF) e seus `Lags`. A herança é top-down (filhos herdam travas dos pais) num loop max 100 iterations.
3. **Rollup Botton-Up:** Tarefas Agrupadoras (Summary Tasks) varrem seus filhos recursivamente calculando `min(start)`, `max(end)` e média ponderada de progresso físico/financeiro.
4. **Adapter Exclusivo (SVAR Export):** O SVAR Gantt lê a Data Fim como *exclusiva*, mas nós a armazenamos como *inclusiva*. A função acopla artificialmente `+ 86400000ms` (+1 dia) no timestamp de saída para o renderizador sem afetar o dado original.

## Invariantes (Regras Invioláveis)

1. **Duração é DADO MESTRE:** A duração cadastrada manualmente de uma tarefa analítica é intocável. Somente a interação direta de arraste do lado direito (Resize Right) pela UI altera duração real.
2. **Nenhuma Seta ao Passado:** Nenhuma tarefa sucessora inicia antes da data limitrofe ditada por seus predecessores. Se o motor detectar violação, ele puxa a sucessora de volta.
3. **Agrupadores são Cegos:** O usuário NÃO edita datas ou progresso de tarefas agrupadoras/sumárias (pai). Elas são exclusividade reflexiva do rollup de seus descendentes. 
4. **Trust The Engine:** O banco de dados (trigger Postgres) é programado para respeitar os cálculos desse motor, poupando processamento de repetição. Sempre se certifique que a engine envie a tríade completa e matematicamente válida `(inicio, fim, duracao)`.

## API Principal

### `computeFullSchedule(items, projStart)`
A função principal e única a ser chamada na hora de exibir e recalcular toda a EAP após o carregamento ou para prever atualizações. 
- **Entrada:** `items: EapEngineItem[]` (direto do banco, ou após uma edição).
- **Saída:** `{ syncedItems, ganttTasks, ganttLinks, hasCorrections }`. 
  - `syncedItems`: Estado verdadeiro para ser mandado via API HTTP ao banco.
  - `ganttTasks, ganttLinks`: Formatados e prontos para injetar diretamente na biblioteca gráfica.

### `processUserInteraction(items, interactionPayload, projStart)`
Usado quando o usuário clica e arrasta no SVAR Gantt.
- **Entrada:** O estado atual, as alterações vindas do evento JS (`interactionType`: `body_move`, `resize_left`, `resize_right`), e data inicio do projeto.
- **Saída:** Os arrays com tarefas atualizadas para re-renderização, e `affectedItems` listando apenas as tarefas que sofreram impacto pelo efeito dominó (para salvar no banco).
