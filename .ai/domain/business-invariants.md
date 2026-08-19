# 🏰 Invariantes de Negócio - Gestor de Obras

Este documento dita as Regras Fundamentais e Inegociáveis (Business Invariants) da arquitetura de domínio do sistema Gestor de Obras. 

Nenhum código, automação ou agente deve sobrepor, afrouxar ou contornar as proteções aqui documentadas.

---

## 1. Isolamento Multitenant (Zero Trust)
- **Obrigatório:** Todos os registros operacionais (`empresas`, `rdos`, `contratos_obra`, `medicoes`, `usuarios`) são estritamente condicionados a um `contrato_id` (Tenant).
- **Invariante:** Nenhuma operação de Leitura, Inserção, Atualização ou Deleção pode ser executada no banco de dados (Supabase PostgreSQL) se a policy RLS (Row Level Security) falhar em validar a claim `request.jwt.claims->>'contrato_id'`.
- **Prevenção de Vazamento:** Usuários de um contrato jamais terão visibilidade, seja pela interface ou via bypass de API, de artefatos de outro `contrato_id`. A exceção única é o Master Tenant `GER-2026-SYS` ("Gestora do Sistema") quando operando no painel Master.

## 2. Invariantes de EAP (Estrutura Analítica do Projeto) e Planejamento
- A hierarquia e peso da EAP são matematicamente absolutos:
  - O somatório do peso dos níveis filhos (`sub_itens`) **deve obrigatoriamente ser 100%** do nível pai (ou igualar ao financeiro absoluto).
  - Uma EAP que entra na fase de `EXECUÇÃO` sofre travamento estrito. A topologia base de itens que já possuem histórico financeiro/orçamentário não pode ser deletada para não corromper medições retroativas.

## 3. Gestão de Contratos e Medições
- **Invariante de Estouro:** Uma Medição Acumulada **nunca** pode ultrapassar o saldo físico/financeiro homologado no Contrato vigente (ou seja, `Medição Atual + Medições Anteriores <= Valor Global do Contrato`).
  - Aditivos podem aumentar o teto, mas o motor de validação deverá rejeitar saídas que causem saldo devedor negativo na rubrica principal.
- **Auditoria Rígida:** Medições só alteram seu status para `APROVADO` / `PAGO` se todas as esferas hierárquicas da Matriz de Permissões aprovarem (ex: Medições geradas por fornecedores nascem em `EM_ANALISE` e exigem o `pode_aprovar_medicao` ativado por um Gestor/Admin da Contratante).

## 4. Apropriação de Custos e RDO (Diário de Obras)
- A mão de obra de campo só pode registrar apropriações vinculadas a Obras Ativas e dentro da data calendário local (não é permitido apropriar custos em "datas futuras").
- Funcionários exigem compliance em NRs (Normas Regulamentadoras). A injeção nas Frentes de Serviço do RDO depende do status `VIGENTE` em seu portfólio de treinamentos.

## 5. Hierarquia e Controle de Tetos (Permissões)
- **Teto Imutável:** Um perfil `ADMIN` não pode atribuir a um `GESTOR` uma permissão que ele próprio não possui na Matriz Geral da Empresa. O cálculo `getComputedPermissions()` valida interseção bit a bit (Teto do Tenant -> Teto da Empresa -> Perfil do Usuário).
