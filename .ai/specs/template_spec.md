# Especificação Técnica (Template)
**Data**: YYYY-MM-DD
**Módulo**: [Nome do Módulo / Feature]

## 🎯 1. Objetivo do Negócio
[Descreva o que o usuário quer resolver na vida real. Ex: "Precisamos integrar os medidores de topografia com o faturamento..."]

## 🏗️ 2. Modelagem do Banco de Dados
> [!IMPORTANT]
> Descreva todas as tabelas novas, modificações de esquema (migrations) e gatilhos (triggers).

- `nome_tabela`: 
  - `coluna_1` (Tipo): Propósito.
  - `tenant_id` (UUID): Mandatório para RLS de segurança.

## 🛡️ 3. Regras de Segurança (RLS e Permissões)
> [!WARNING]
> Toda nova tabela operacional DEVE ter políticas de `SELECT`, `INSERT`, `UPDATE` atreladas ao `current_setting('app.current_contrato_id')`.

Quais permissões da aba "Matriz de Acesso" controlam a leitura e escrita neste novo módulo? (Ex: `rdo_escrever`, `financeiro_ler`).

## 🔌 4. Rotas e APIs (Node.js)
Endpoints que devem ser expostos no arquivo `server.ts`. Devem sempre invocar o `verifyFirebaseJWT` e utilizar `getSupabaseClient(req)`.

- `GET /api/meu-modulo`: [Propósito]
- `POST /api/meu-modulo`: [Propósito]

## 🖥️ 5. Impacto no Frontend (React)
- Componentes Novos: [Lista de componentes que a IA precisará criar].
- Rotas / Tabs Alteradas: [Onde esse componente será plugado? Ex: "Adicionar uma nova aba em FuncionariosView.tsx"].

## 🧪 6. Plano de Testes
- Quais validações da suite `tests/integration/` (Vitest) devem ser geradas ou checadas para confirmar que o RLS e as regras funcionam?
