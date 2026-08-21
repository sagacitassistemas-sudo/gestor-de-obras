# Implementação de Auditoria de Variáveis Zeradas (Motor Dinâmico)

**Data:** 2026-08-20
**Feature:** Auditoria de Motor de Cálculos (Mão de Obra)
**Versão:** 1.4.5

## O Que Foi Feito?
O usuário relatou valores `R$ 0,00` persistindo no Dashboard de Custos e solicitou que o sistema não apenas calculasse, mas alertasse claramente (com compliance e rastreabilidade) sobre quais variáveis de cálculo estavam zeradas (gerando os zeros). 

**1. Ajustes no Motor Backend (`server.ts`)**
Adicionamos um rastreamento interno nas rotinas iterativas que calcula o custo homem/hora e o custo admissional/demissional no endpoint `/api/custos/simulacao-mao-obra`. Se uma destas variáveis críticas for nula ou zero, uma string é injetada no vetor de `pendencias`:
- Calendário Padrão Ausente (fallback 220h detectado).
- Ausência de Salário Base atrelado a um cargo específico.
- Ausência de Custo de Exames Admissionais (PCMSO) nas tabelas globais.
- Ausência de Custo Demissional (Rescisão) nas tabelas globais.
- Equipe sem membros designados na OS.

**2. Integração com a UI (`ComposicaoCustosMaoObraView.tsx`)**
A interface do modal de Simulação Dinâmica da OS foi instrumentada para verificar o vetor de `pendencias`. Caso contenha alertas, um box de *"Log de Auditoria: Pendências para Definir"* vermelho é renderizado, forçando o avaliador a corrigir os insumos bases do sistema antes de seguir.

**3. Testes Automatizados (`simulacaoMaoObra.routes.test.ts`)**
Adicionamos a suíte de testes `it('deve listar as variáveis faltantes (pendencias) na auditoria do motor')`, na qual injetamos mock de cargos sem salário e tabelas globais sem valor de exame PCMSO. Validamos rigorosamente se o array de resposta condiz com os erros detectados. Todos os testes passam nativamente no Vitest.

## Lições Aprendidas
- **Design de API:** Retornar metadados de diagnóstico de cálculo junto ao payload do cálculo aumenta drasticamente o *observability* (observabilidade) do sistema no Front-End sem obrigar os clientes a consumirem logs obscuros ou abrirem o console do navegador.
