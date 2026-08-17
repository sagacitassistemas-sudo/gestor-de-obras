# Especificação do Modelo Padronizado de Autenticação Dual (Firebase + Supabase) & Protocolo Tenant

## 1. Visão Geral da Arquitetura Dual IdP + Cerne

O sistema utiliza um modelo híbrido de autenticação e autorização dual:

```
[Cliente Web / Mobile] 
       │
       ├─► (1. Autentica) ──► [Firebase Auth (IdP)] ──► Emite JWT (IdToken + Custom Claims)
       │
       └─► (2. Consome API com Bearer JWT)
               │
               ▼
       [Backend Node.js / Express (server.ts)]
               │
               ├─► [middleware verifyFirebaseJWT]
               │      ├─ Valida IdToken via Firebase Admin SDK (ou JWT Secret)
               │      └─ Extrai contexto tenant (contrato_id, empresa_id, perfil, uid)
               │
               └─► [Supabase Client (PostgreSQL / Cerne)]
                      ├─ Aplica filtro explícito por contrato_id / tenant_id
                      └─ Executa queries com Service Role / RLS com isolamento Zero-Trust
```

---

## 2. Contrato do Payload de Autenticação (Custom Claims)

Todo token JWT autenticado deve possuir as seguintes propriedades padronizadas no payload:

| Propriedade | Tipo | Descrição | Exemplo |
|-------------|------|-----------|---------|
| `uid` / `sub` | `string` | Identificador único do usuário no Firebase Auth | `"testadminuid"` |
| `email` | `string` | E-mail corporativo autenticado | `"admin@empresa.com"` |
| `contrato_id` | `string` | Identificador do Tenant (Empresa Contratante) | `"CTR-2026-SYS"` |
| `empresa_id` | `string \| null` | Identificador da Empresa Fornecedora vinculada | `"FORN-001"` |
| `perfil` | `string` | Papel hierárquico (`ADMIN`, `GESTOR`, `FINANCEIRO`, `FORNECEDOR`, `VISITANTE`) | `"ADMIN"` |
| `mfa_verified` | `boolean` | Indicador de verificação de segundo fator de autenticação | `true` |

---

## 3. Diretrizes de RLS (Row Level Security) e Protocolo Tenant

1. **Campos do Tenant:**
   - Tabelas corporativas/administrativas (`usuarios`, `empresas_fornecedores`, `empresa_contratante`, `permissoes_usuario`): utilizam a coluna `contrato_id`.
   - Tabelas operacionais de canteiro (`projetos`, `ordens_servico`, `rdos`, `especialidades`, `funcionarios`, `equipes`): utilizam a coluna `tenant_id`.

2. **Regra de Ouro RLS:**
   Todas as políticas RLS nas tabelas PostgreSQL devem obrigatoriamente seguir a estrutura padronizada:
   ```sql
   CREATE POLICY tenant_isolation_policy ON <tabela> FOR ALL
   USING (
       -- Bypass confiável para operações backend com Service Role
       current_setting('role', true) = 'service_role' OR auth.role() = 'service_role'
       OR
       -- Isolamento por tenant em consultas diretas com JWT do cliente
       <coluna_tenant> = COALESCE(
           NULLIF(current_setting('request.jwt.claims', true)::json->>'contrato_id', ''),
           NULLIF(current_setting('request.jwt.claim.contrato_id', true), ''),
           'CTR-2026-SYS'
       )
   );
   ```

3. **Garantia de Não-Ocultamento de Dados:**
   - O backend (`server.ts`) deve sempre instanciar o cliente Supabase utilizando a chave `SUPABASE_SERVICE_ROLE_KEY` válida.
   - Toda consulta no backend deve obrigatoriamente incluir a cláusula `.eq("contrato_id", tenantId)` ou `.eq("tenant_id", tenantId)`.

---

## 4. Rota Padronizada de Checagem de Acesso (`GET /api/auth/tenant-check`)

O sistema disponibiliza a rota padronizada `GET /api/auth/tenant-check` (e seu alias `GET /api/auth/check-access`) para verificação contínua da saúde do isolamento de dados por tenant:

### Exemplo de Resposta JSON:
```json
{
  "success": true,
  "tenant_id": "CTR-2026-SYS",
  "user": {
    "uid": "testadminuid",
    "email": "admin@empresa.com",
    "perfil": "ADMIN"
  },
  "diagnostics": {
    "empresa_contratante": { "count": 1, "status": "OK" },
    "empresas_fornecedores": { "count": 4, "status": "OK" },
    "usuarios": { "count": 7, "status": "OK" },
    "projetos": { "count": 2, "status": "OK" },
    "ordens_servico": { "count": 5, "status": "OK" },
    "especialidades": { "count": 11, "status": "OK" },
    "funcionarios": { "count": 8, "status": "OK" },
    "equipes": { "count": 3, "status": "OK" }
  },
  "timestamp": "2026-08-16T21:55:00.000Z"
}
```

---

## 5. Integração com as Rotinas de Testes e Prevenção de Regressões

1. **Teste de Integração de Autenticação & Tenant Check ([tests/integration/auth.routes.test.ts](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/tests/integration/auth.routes.test.ts)):**
   - Valida a emissão e decodificação do JWT dual.
   - Executa a chamada `GET /api/auth/tenant-check` e garante retorno `200 OK` com `success: true` e diagnóstico zerado de erros RLS.

2. **Script de Verificação de Integridade ([scripts/check-integrity.mjs](file:///mnt/46F84CA3F84C935B/Atividades_2026/Natan/Sistema/gestor-de-obras/scripts/check-integrity.mjs)):**
   - Inclui passo automatizado de validação de paridade de RLS e checagem de rota de tenant.
