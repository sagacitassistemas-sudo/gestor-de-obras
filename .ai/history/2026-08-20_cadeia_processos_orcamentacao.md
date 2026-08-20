# Cadeia de Processos Works Manager: CUB ao Financeiro

**Data**: 2026-08-20
**Domínio**: `Orçamentação / Planejamento / Execução`

## Visão Geral da Cadeia

Este documento mapeia a cadeia de processo do sistema, garantindo que qualquer agente de IA compreenda o fluxo lógico desde a base de dados externa (CUB) até a execução e controle financeiro da obra, com os respectivos requisitos funcionais por etapa.

```mermaid
flowchart TD
    A["🏗️ BASE CUB\n(Referência externa — Sinduscon)"]
    B["📥 Importação CUB\n(importacao_cub tab)"]
    C["📐 Orçamento Base\n(orcamento_base tab)"]
    D["📊 Simulador de Obra\n(orcamentacao tab)"]
    E["🚀 Criar Projeto Real\n(CriarProjetoSimuladoModal)"]
    F["🌳 EAP — Projetos\n(projetos_eap tab)"]
    G["📅 Cronograma Executivo\n(cronograma_executivo tab)"]
    H["💰 Cronograma Físico-Financeiro\n(cronograma_financeiro tab)"]
    I["📋 Ordens de Serviço\n(ordens_servico tab)"]
    J["📝 RDO\n(rdo tab)"]
    K["📏 Medições\n(medicoes tab)"]
    L["💳 Financeiro e Custos/BDI\n(financeiro + custos_financeiro tabs)"]

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K --> L

    style A fill:#e0f2fe,stroke:#0284c7
    style B fill:#fef3c7,stroke:#d97706,stroke-dasharray: 5
    style C fill:#fef3c7,stroke:#d97706,stroke-dasharray: 5
    style D fill:#ede9fe,stroke:#7c3aed
    style E fill:#ede9fe,stroke:#7c3aed
    style F fill:#d1fae5,stroke:#059669
    style G fill:#d1fae5,stroke:#059669
    style H fill:#d1fae5,stroke:#059669
    style I fill:#fee2e2,stroke:#dc2626
    style J fill:#fee2e2,stroke:#dc2626
    style K fill:#fee2e2,stroke:#dc2626
    style L fill:#f0fdf4,stroke:#16a34a
```

> 🟡 Tracejado = Arquitetura aprovada a ser implementada
> 🟢/🔴 Cores Sólidas = Existente e operacional

## Regras de Handoff (Integração)

O ponto crítico de handoff arquitetural do sistema é a passagem de **D (Simulador)** para **E (Criar Projeto)**.
1. O Simulador reparte o `Valor Global` (advindo do Orçamento Base CUB) em **12 Macro-Etapas construtivas**.
2. Ao aprovar no simulador, o backend (`POST /api/projetos/from-simulacao`) **planta automaticamente o código raiz na EAP** do novo projeto.
3. Além da raiz, as 12 etapas são geradas como **nós analíticos** com os valores parciais do simulador já embutidos no campo `valor_total_contratado`.
4. Isso garante a espinha dorsal de planejamento, que será herdada no Cronograma, nas O.S. e Medições.

## Capacitação do Modelo de Testes

Os testes E2E e de integração devem validar as costuras deste processo:
- **Testes de Importação CUB**: Verificar formato de dados e UF corretos (Mocking da API Sinduscon).
- **Testes de Orçamento**: Afirmar a exatidão matemática: `Área * Valor do M2 CUB = Valor Global`.
- **Testes de Handoff**: `POST /api/projetos/from-simulacao` DEVE retornar código de projeto (`P-01-26`) e confirmar a inserção de 13 nós EAP (1 raiz + 12 analíticos) para garantir que a O.S. terá onde registrar serviços no Módulo de Execução.
