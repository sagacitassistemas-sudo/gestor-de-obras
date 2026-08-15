# Post-Mortem: Dissonância de UX e Fronteiras Inclusivas/Exclusivas no Gantt
Data: 2026-08-14

## O Problema
O usuário relatou repetidamente que as durações das tarefas no gráfico de Gantt "estavam longe de serem as corretas" e que a interface "ignorava a duração definida no projeto", mesmo eu tendo implementado o motor de cálculo em `cronogramaEngine.ts` com rigor matemático.

A análise profunda revelou **dois erros críticos distintos** que se somaram para causar a falha sistêmica, ambos ligados à fronteira entre a lógica de domínio e a camada de UI/Visualização:

1. **UX Dissonante (Silenciamento de Input do Usuário):** 
   - A UI permitia que o usuário digitasse a "Duração" para Tarefas Agrupadoras (Summary Tasks).
   - O motor (corretamente) sobrescrevia a duração de tarefas agrupadoras com base na soma da duração de seus filhos.
   - Como a tarefa recém-criada não tinha filhos, o motor forçava a duração para `1 dia`.
   - **O Erro da IA:** Focar cegamente na lógica matemática do backend sem auditar a usabilidade. O usuário se sentiu enganado pela UI (digitou 10, o sistema salvou 10 no DB, mas o gráfico processou 1 em silêncio).

2. **Divergência de Inclusividade de Datas (Off-by-One Visual):**
   - Nosso motor de cálculo usa datas **inclusivas** (ex: Tarefa começa dia 03, dura 5 dias, termina dia 07).
   - O componente visual (SVAR Gantt) utiliza datas **exclusivas** internamente para calcular o tamanho da barra (ex: Start 03, End 07 = 4 dias).
   - **O Erro da IA:** Assumir que injetar o `end_date` bruto da nossa engine no SVAR seria desenhado de forma 1:1. Isso causava o encolhimento de TODAS as tarefas em exatamente 1 dia visualmente.

## O Que Eu Aprendi (Diretrizes para o Futuro)

1. **"O silenciamento do input é um pecado capital de UX":**
   - Se uma regra de domínio (Engine/Backend) vai sobrescrever ou calcular automaticamente um valor (ex: duração de agrupador, datas de rollup), o respectivo campo no formulário **NUNCA PODE ESTAR HABILITADO**. Ele deve ser visualmente bloqueado (`disabled`) e, preferencialmente, sinalizado (ex: "Automático").
   - NUNCA permita que o usuário digite um dado que será descartado pelo motor.

2. **Padronização Sensata de Contexto (Defaults Inteligentes):**
   - Estruturas de dados hierárquicas (WBS/EAP) têm expectativas de comportamento. Se o nível 1 e 2 são agrupadores, o nível 3 quase sempre será executável (folha).
   - O default da interface não pode ser preguiçoso. A inferência do tipo da tarefa deve antecipar o nível hierárquico em que ela está sendo criada, reduzindo a carga cognitiva e prevenindo erros na origem.

3. **Validação de Fronteiras de Tempo (Inclusive vs Exclusive):**
   - Toda vez que dados de datas forem enviados de um motor de regras para uma biblioteca visual (Gantt, Calendário, Timeline), eu **devo questionar explicitamente** se a biblioteca interpreta o fim do intervalo como Inclusivo ou Exclusivo.
   - Falhas de "1 dia a menos/a mais" quase nunca são erros no banco de dados, e quase sempre são conflitos de fronteira inclusiva/exclusiva.

## Correção Implementada
- **[UX]**: Desabilitei a edição de `duracaoDias` no modal caso a flag `e_analitico` seja false.
- **[Default]**: Filhos criados sob pais de nível 2+ agora recebem `e_analitico = true` por padrão.
- **[Visual]**: Foi adicionado `+ 86400000ms` (+1 dia) no mapeamento de saída para o SVAR Gantt (`buildGanttData`) e `- 86400000ms` (-1 dia) no evento de recepção (`handleTaskUpdate`), isolando a exclusividade dentro da bolha da biblioteca visual e preservando a integridade inclusiva no banco.
