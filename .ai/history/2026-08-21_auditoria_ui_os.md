# Auditoria de Custos e Pendências de UI na OS

**Data:** 2026-08-21
**Versão:** 1.4.4
**Contexto:**
O cliente pontuou repetidas vezes a necessidade de evidenciar os valores zerados ou escopos não informados (Mão de Obra, Materiais, Ferramentas e Equipamentos) no fechamento de uma OS. A falha na exibição proativa dessas ausências causava gargalos de análise, pois os usuários achavam que a OS estava pronta quando, na verdade, não havia composição de custo inserida.

**Implementação:**
Foi adicionado um mecanismo visual de auditoria contínua ("Pendência de validação") na visualização dos custos da Ordem de Serviço em `OSView.tsx`.
- Para **Mão de Obra**: as pendências agora acusam vermelhidão e mensagens específicas se faltar Equipe Executora ou Prazos da EAP (que quebram o cálculo de horas reais).
- Para **Materiais, Ferramentas e Equipamentos**: se os valores estiverem zerados ou nulos, os cards ganham bordas e fundos em tom avermelhado, e um alerta explícito surge caso a descrição do item também esteja ausente.

**Validação (Autonomia AI):**
- **Type Checking**: O build das tipagens em `OSView.tsx` foi ratificado por `tsc --noEmit` retornando 0 erros.
- Os testes de integração previamente estabelecidos continuam sadios e a renderização UI do React (Vite) não foi quebrada.
