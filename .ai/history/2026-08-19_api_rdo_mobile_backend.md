# API Backend para RDO Mobile: Estrutura e Idempotência

**Data:** 19/08/2026
**Autor:** Antigravity (Agente de Arquitetura e Engenharia de Software)

## Resumo das Atividades

### 1. Escopo Entregue
Implementada a base da **API de RDO Mobile** (`/api/rdo`) no sistema Gestor de Obras. Esta rota servirá como a via principal para recepção de apontamentos de campo offline/online enviadas pelo novo App Mobile.

### 2. Decisões Técnicas Aplicadas
- **Autenticação por Carteira de Dispositivos (Device Auth):** A API adota um bloqueio ativo (HTTP 403 Forbidden) para solicitações provenientes de apps em status de aprovação `PENDENTE` pela gestora da obra.
- **Protocolo de Idempotência (`protocolo_id`):** Mecanismo para prevenir e absorver repetições de requisições oriundas da instabilidade de redes 3G/4G/offline no campo. Chamadas duplicadas retornam sucesso (HTTP 200/202) protegendo o banco e preservando silenciosamente os dados sem falhar no Client Mobile.
- **Suporte a Datas Retroativas:** As regras de negócios foram moldadas para não engessarem a data de registro contanto que a OS referida estivesse ativa no escopo do projeto, respeitando o fluxo de apontamento defasado do campo.
- **Mapeamento Camel-to-Snake:** Transmutação imediata para padronização DB (`osId` → `os_id`), mantendo a compatibilidade estrita do modelo arquitetural do Postgres.
- **Fallback In-Memory:** Sistema provido de uma "bolsa" de memória transitória `Map()`. Retorna `{ synced: false }` no caso de queda do serviço do banco de dados/Supabase, preservando o trabalho dos encarregados via estado 202 (Accepted).

### 3. Status Final
O ciclo TDD (Fase RED $\rightarrow$ GREEN) foi 100% finalizado. A cobertura conta com **6 testes de integração validadores** aprovados na suíte `rdoApi.test.ts`. Ambiente estrutural ancorado.
