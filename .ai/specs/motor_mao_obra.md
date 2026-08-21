# Motor Dinâmico de Mão de Obra (Módulo II)

## 1. Visão Geral
Este componente é responsável pela valoração inteligente da Mão de Obra Direta (MOD) nas Ordens de Serviço e Simulações de Projetos. Ele substitui a entrada manual ou estática de divisores de horas e custos diluídos, adotando um cálculo baseado em calendário real e eventos absolutos de contratação (histograma).

## 2. Invariantes de Negócio
- **INV-MOD-01:** O divisor de carga horária (CHM) deve derivar sempre da matriz de dias úteis e horas do `calendario_padrao` ou do calendário específico atrelado ao projeto, nunca chumbado no código.
- **INV-MOD-02:** Rubricas de caráter Admissional ou Demissional (Ex. Exames PCMSO, Integração, Rescisão) não podem ser rateadas no custo por hora. Elas devem ser somadas como valor absoluto mediante a existência do funcionário na equipe alocada na OS.
- **INV-MOD-03:** A base percentual das Leis Sociais (`encargos_sociais_perc`) deve ser recuperada de `tenant_cargos_salarios` (default 85%) e aplicada exclusivamente sobre o Custo Base Horista, não incidindo sobre EPIs e Ferramentas.

## 3. Especificações Matemáticas (Fórmulas)

1. **Cálculo da Carga Horária Mensal Base (CHM):**
   `CHM = (Horas Trabalhadas/Dia) × (Dias Úteis/Semana) × 4.33`

2. **Custo Base Horista (CBH):**
   `CBH = Salário Mensal Base / CHM`

3. **Leis Sociais Horista (LSH):**
   `LSH = CBH × (encargos_sociais_perc / 100)`

4. **Encargos Complementares (EC) & EPIs/Ferramentas Horistas:**
   `EC = ∑ (Custos Horistas de Transporte, Alimentação, EPIs, etc.)`
   *(PCMSO é excluído desta somatória horista).*

5. **Tarifa Hora Composta Global (THC):**
   `THC = CBH + LSH + EC`

6. **Custo Absoluto do Histograma:**
   `Custo Admissional Total = (∑ Funcionários) × (Valor Fixo PCMSO Admissional)`

7. **Custo Total de Mão de Obra na Ordem de Serviço (CTMO):**
   `CTMO = (THC × Horas Úteis do Cronograma EAP) + Custo Admissional Total`

## 4. Endpoints Mapeados
- `GET /api/custos/simulacao-mao-obra?projeto_id=UUID&os_id=UUID`: Executa a matemática em tempo real com base na equipe atual e tabelas de referência. Retorna `{ horas_mes_adotadas, total_admission_costs, total_dismissal_costs, total_hourly_rate }`.

## 5. UI Components Relacionados
- `ComposicaoCustosMaoObraView.tsx` (Dashboard Analítico)
- `OSView.tsx` (Card "Mão de Obra" e cálculo em tempo real de execução)
