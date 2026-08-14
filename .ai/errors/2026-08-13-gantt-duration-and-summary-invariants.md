# Post-Mortem & Registro de Aprendizado: Motor do Cronograma

**Data:** 13/08/2026  
**Domínio:** Engine de Cronogramas, Gantt, EAP/WBS e Auto-Scheduling  

---

## 📌 ERROS IDENTIFICADOS & CAUSAS RAIZ

### 1. Incompreensão da Soberania do Dado Lançado (`duracao_dias`)
- **Falha de Conceito:** Tratar a duração de tarefas analíticas como um valor dinâmico recalculável a partir do intervalo visual.
- **Causa Raiz:** O dado `duracao_dias` digitado/cadastrado no projeto pelo usuário é o **DADO MESTRE SOBERANO**. Ele nunca deve ser alterado por deduções do motor. A data de fim no gráfico é estritamente derivada de $\text{Fim} = \text{Início} + \text{Duração Lançada} - 1$.

### 2. Invalidação de Vínculos por Ignorar Ancestrais Sintéticos
- **Falha de Conceito:** Uma tarefa folha iniciar antes do término de uma predecessora conectada a um agrupador pai, gerando setas invertidas no gráfico.
- **Causa Raiz:** O motor verificava apenas a propriedade `predecessores` local da tarefa. Ao ter um vínculo aplicado na etapa pai (ex: grupo `2` dependendo da etapa `1`), a subetapa `2.1.1` não herdava a restrição e iniciava no dia do projeto.
- **Solução Implementada:** `calculatePredecessorRequiredStart` agora percorre toda a árvore EAP e absorve todas as restrições de predecessoras dos ancestrais pai.

### 3. Falha de Persistência por Falso Positivo no SDK Cliente
- **Falha de Conceito:** O sistema informava que as alterações foram salvas, mas ao recarregar a tela as durações e posições voltavam ao estado original.
- **Causa Raiz:** O SDK cliente Supabase não lançava exceção em falhas de gravação via RLS, retornando um objeto `{ error }`. O código não verificava esse retorno, exibia alerta de sucesso e chamava `fetchEapItems()`, sobrescrevendo o estado com os dados antigos do banco.
- **Solução Implementada:** Gravação 100% via API backend autenticada `/api/itens-eap` com envio do JWT token e validação estrita de resposta HTTP 200 OK.

---

## 🎯 REGRAS INVIOLÁVEIS PARA FUTURAS ALTERAÇÕES NO CRONOGRAMA

1. **Duração é Dado Mestre:** A duração lançada no projeto (`duracao_dias`) é imutável para tarefas analíticas folha.
2. **Nenhuma Seta para o Passado:** Nenhuma tarefa sucessora pode ser posicionada antes do término exigido por suas predecessoras (locais ou herdadas).
3. **Tarefas Sumário 100% Derivadas:** Agrupadores não aceitam edições diretas e são calculados estritamente por $\min(\text{filhas.inicio})$ e $\max(\text{filhas.fim})$.
4. **Verificação Estrita de Gravacão:** Nenhuma atualização deve ser considerada salva sem confirmação positiva do servidor HTTP API.
