# Motor de Composição Dinâmico de Mão de Obra e Integração do Histograma

**Data:** 2026-08-20
**Status:** Concluído
**Módulo:** Módulo II (Valoração e Custos Financeiros)

## 📌 Contexto e Regras de Negócio

O sistema Gestor de Obras necessitava de um motor preciso para cálculo da Mão de Obra Direta (MOD). Anteriormente, utilizava-se valores manuais ou divisores de carga horária "chutados" (ex: 220h fixas). As novas regras exigem aderência extrema à realidade financeira da obra:

1. **Cálculo Baseado em Calendário:** A carga horária mensal passa a ser calculada dinamicamente lendo a configuração do projeto (`calendario_padrao` ou específico) e processando as horas de dias úteis da semana.
2. **Integração de Custos Absolutos pelo Histograma:** Rubricas como *Exames (PCMSO Admissional/Demissional)* e *Custos Rescisórios* não devem mais ser dissolvidos e rateados como "Custo por Hora", pois isso frauda o centro de custos da OS. Eles agora são somados como **custos absolutos (R$)** sempre que um colaborador entra ou sai da equipe de execução durante aquele período de tempo.
3. **Simulação *On-The-Fly* vs Snapshots:** Os cálculos ocorrem em tempo real durante o rascunho de orçamentos e Ordens de Serviço. Quando uma OS vira "Em Execução", as aprovações devem ter as rubricas salvas como "Snapshots" para efeito de *compliance* e auditoria.

## 🧮 Especificações Matemáticas (Specs)

A composição do custo unitário (Custo Horista Composto) e total segue rigorosamente o modelo itemizado:

1. **Cálculo da Carga Horária Mensal Base (CHM):**
   ```text
   CHM = (Horas Trabalhadas/Dia) × (Dias Úteis/Semana) × 4.33
   ```
   *A variável 4.33 representa a média de semanas em um mês comercial (52 semanas / 12 meses).*

2. **Custo Base Horista (CBH):**
   ```text
   CBH = Salário Mensal Base / CHM
   ```

3. **Leis Sociais Horista (LSH):**
   ```text
   LSH = CBH × (encargos_sociais_perc / 100)
   ```
   *Onde `encargos_sociais_perc` é flexível por cargo e contempla férias, 13º, INSS, FGTS, etc.*

4. **Encargos Complementares (EC) & EPIs/Ferramentas Horistas:**
   ```text
   EC = ∑ (Custos Horistas de Vale Transporte, Alimentação, Seguro de Vida, EPIs, etc.)
   ```
   *O PCMSO (Exames) não entra neste rateio.*

5. **Tarifa Hora Composta Global (THC):**
   ```text
   THC = CBH + LSH + EC
   ```

6. **Custos Absolutos (Histograma de Admissão/Demissão):**
   ```text
   Custo Admissional Total = (∑ Novos Colaboradores) × (Valor Fixo PCMSO Admissional + Integração)
   Custo Demissional Total = (∑ Colaboradores Desligados) × (Valor Fixo PCMSO Demissional + Custos Rescisórios)
   ```

7. **Custo Total de Mão de Obra na Ordem de Serviço (CTMO):**
   ```text
   CTMO = (THC × Horas Úteis do Cronograma EAP) + Custo Admissional Total
   ```

## 🛠 Arquitetura Implementada

### 1. Banco de Dados
- **`tenant_cargos_salarios`**: Recebeu a coluna `encargos_sociais_perc NUMERIC(6,4) DEFAULT 85.0000`, permitindo a definição granulada de "peso" das Leis Sociais sobre o salário base, caso a caso, ao invés de fixo para todas as categorias no SINAPI.

### 2. Backend API (`server.ts`)
- **Novo Endpoint:** `GET /api/custos/simulacao-mao-obra?projeto_id=X&os_id=Y`
- Lógica Central:
  - Recupera a quantidade de horas úteis mensais baseado em `# de dias úteis do calendário * horas_dia * 4.33 semanas`.
  - Processa o array de `equipe_membros` (O "Histograma").
  - Identifica e aplica o `custo_mensalista_ref` para a categoria **"Exames (PCMSO)"** *apenas* 1 vez (como admissão/demissão) na conta final.
  - Soma salário base / horas mês + % de encargos + demais itens horistas de EPIs, gerando a tarifa hora composta global.

### 3. Frontend & Interfaces
- **`ComposicaoCustosMaoObraView.tsx`**: Interface do tipo *Dashboard* anexada dentro da tela "Custos Financeiros / BDI". Apresenta de forma transparente e separada:
  1. Carga Mensal Ativa do calendário.
  2. Custo Admissional do Histograma.
  3. Custo Demissional do Histograma.
  4. Custo Horista Composto Final.
- **`OSView.tsx`**: O card "Mão de Obra" foi desacoplado da inserção manual, ganhando automação. Passou a consultar a simulação do servidor, exibindo o cálculo exato: `Tarifa Hora Composta` * `Esforço Útil Calculado (dias do cronograma EAP da OS)`.

## 🧪 Estratégia de Testes (Invariantes)
- Invariante: Custos de admissão jamais podem multiplicar pelas horas trabalhadas, sendo aplicados sempre como fator discreto na curva de "Entry" e "Exit" da equipe.
- Invariante: O componente visual deve travar o cálculo de Mão de Obra caso a OS não contenha uma Equipe alocada para referenciar os salários.

## 🚀 Próximos Passos
- Refatorar endpoints legados que realizavam contas locais de rateio antes desse novo motor.
- Implementar as triggers ou rotinas de `Snapshots` para quando o `status` da O.S for alterado para 'Em Andamento', salvando no JSON de O.S a estrutura calculada e bloqueando consultas à API que pudessem flutuar devido a negociações sindicais (Mudança de salários base) futuras.
