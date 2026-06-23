## Causa raiz

**1. Erro 400 ao editar contrato**
O hook legado `src/features/admin/hooks/useContracts.ts` (usado em `AdminContratosPage` → `ContractWizardDialog`) consulta:

```ts
contract_slas:contract_slas(sla_id)
```

A tabela `contract_slas` **não tem** mais a coluna `sla_id` — hoje ela guarda o próprio SLA inline (`priority`, `response_time_minutes`, `resolution_time_minutes`, `business_hours_only`, `sla_type`). Por isso o PostgREST devolve 400 ao abrir o modal de edição.

O `persistRelations` do mesmo hook também tenta `INSERT { contract_id, sla_id }` em `contract_slas`, o que quebraria ao salvar. O passo "SLAs" do wizard é apenas informativo ("Gerencie os SLAs diretamente na aba de SLAs após salvar o contrato") — ou seja, não precisa criar/atualizar SLAs ali.

**2. `permission denied for function set_ai_provider_key_v2`**
A função existe, mas o ACL atual só tem `postgres` e `service_role` — o `GRANT EXECUTE … TO authenticated` original foi removido em alguma migração posterior. Mesma situação para `set_ai_provider_key(text,text)`.

## Plano

### A. Corrigir edição de contrato (frontend, sem mudança de schema)
Arquivo: `src/features/admin/hooks/useContracts.ts`

1. Em `loadFormData`, trocar `contract_slas:contract_slas(sla_id)` por `contract_slas:contract_slas(id)` e popular `sla_ids: ((data as any).contract_slas || []).map(r => r.id)` (mantém o contador exibido no wizard sem quebrar).
2. Em `persistRelations`, remover o `delete` e o `insert` em `contract_slas` baseados em `sla_ids` (ficam só `contract_teams` e `projects`). A gestão real de SLAs continua acontecendo pelo fluxo novo (`ContractForm` + `useSaveContract` em `src/features/contracts`).

Isso restaura abrir e salvar contratos pelo painel admin sem mexer em banco.

### B. Restaurar permissão das funções de chave de IA
Migração SQL única reaplicando os GRANTs perdidos:

```sql
REVOKE ALL ON FUNCTION public.set_ai_provider_key_v2(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key_v2(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_ai_provider_key(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key(text, text) TO authenticated;
```

A própria função já valida internamente que o chamador é admin (definida com `SECURITY DEFINER`), então `authenticated` é o grant correto.

## Validação
- Abrir um contrato existente no painel admin → modal carrega sem 400.
- Salvar alterações → toast de sucesso, sem erro em `contract_slas`.
- Ir em Admin → IA → editar provider e salvar a chave → sem `permission denied`.
- SLAs continuam editáveis pelo fluxo de `ContractForm` (que usa `contract_slas(*)` corretamente).
