## Objetivo
Impedir a criação de demandas duplicadas no módulo Sustentação. Duas demandas são consideradas duplicadas quando, dentro do **mesmo time**, possuem:
- mesmo **Título** (`titulo`)
- mesmo **Projeto** (`projeto`)
- mesmo **Tipo** (`tipo`)
- mesmo **Regime/SLA** (`sla`)

Demandas com situação `cancelada` ou `ag_aceite_final` são ignoradas (podem ser recriadas).

## 1. Validação no banco (camada de garantia)

Criar **índice único parcial** em `public.demandas` com normalização (case-insensitive, trim):

```sql
CREATE UNIQUE INDEX demandas_no_duplicates_idx
ON public.demandas (
  team_id,
  lower(btrim(projeto)),
  lower(btrim(titulo)),
  tipo,
  sla
)
WHERE situacao NOT IN ('cancelada', 'ag_aceite_final')
  AND titulo IS NOT NULL
  AND btrim(titulo) <> '';
```

- Índice parcial: não bloqueia recriação após cancelar/encerrar.
- `lower(btrim(...))`: trata "Plano de Teste" = "plano de teste" = " Plano de Teste ".
- Demandas legadas sem `titulo` ficam fora do índice (não quebra dados existentes).

**Pré-checagem:** rodar uma query antes da migration para detectar duplicatas pré-existentes que impediriam a criação do índice; se houver, alertar o usuário com a lista antes de aplicar.

## 2. Validação no frontend (UX imediata)

### 2a. Service helper
Em `src/features/sustentacao/services/demandas.service.ts`, adicionar:

```ts
export async function checkDemandaDuplicada(
  teamId: string,
  titulo: string,
  projeto: string,
  tipo: string,
  sla: string,
  excludeId?: string,
): Promise<boolean>
```

Faz `SELECT id` em `demandas` filtrando por `team_id`, `lower(trim(titulo))`, `lower(trim(projeto))`, `tipo`, `sla`, excluindo situações terminais e (em edição) o próprio id.

### 2b. DemandaForm
Em `src/features/sustentacao/components/DemandaForm.tsx`:
- No submit (antes do `create`), chamar `checkDemandaDuplicada`. Se retornar `true`, exibir `toast.error("Já existe uma demanda ativa com mesmo título, projeto, tipo e regime neste time")` e abortar.
- Capturar erro `23505` (unique violation) do Postgres no catch do `useDemandaMutations.create` e converter em mensagem amigável (caso uma race condition escape do check).

### 2c. useDemandaMutations
Em `src/features/sustentacao/hooks/useDemandaMutations.ts` → `create`: tratar erro Postgres `23505` (`unique_violation`) com toast específico de duplicidade em vez do genérico "Erro ao criar demanda".

## 3. Validação na importação em massa

Em `upsertDemandas` (RPC `upsert_demandas_batch`): como já é upsert por `rhm`, não há mudança imediata. O índice único permanece ativo — se uma linha importada gerar duplicidade pelos 4 campos, o erro será reportado em `erros`.

## Validação esperada
- Criar "Plano de Teste / [SUST] GESP PGDPF / Atividade Interna Sustentação / Padrão" → OK.
- Tentar criar idêntica no mesmo time → toast bloqueia, nada salvo.
- Variar caixa/espaços ("plano de teste ") → bloqueia.
- Cancelar a original e recriar → permitido.
- Outro time criando título igual → permitido (escopo por `team_id`).

## Arquivos alterados
- nova migration SQL (índice único parcial)
- `src/features/sustentacao/services/demandas.service.ts` (novo helper)
- `src/features/sustentacao/components/DemandaForm.tsx` (pré-check no submit)
- `src/features/sustentacao/hooks/useDemandaMutations.ts` (tratamento erro 23505)
