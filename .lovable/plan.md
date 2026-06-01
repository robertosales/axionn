## Problema

O endpoint `POST /rest/v1/rpc/get_demandas_with_responsaveis` está retornando **400 Bad Request** para todos os usuários ao carregar a lista de demandas de Sustentação.

Confirmado via logs Postgres (últimos minutos, dezenas de ocorrências):
```
ERROR 42803: column "d.updated_at" must appear in the GROUP BY clause
            or be used in an aggregate function
```

## Causa raiz

A função `public.get_demandas_with_responsaveis(p_team_id uuid)` faz:

```sql
SELECT jsonb_agg( jsonb_build_object(...) )
INTO v_result
FROM demandas d
WHERE d.team_id = p_team_id
ORDER BY d.updated_at DESC;   -- ← inválido
```

Como `jsonb_agg` é agregação sem `GROUP BY`, o resultado é uma única linha. O `ORDER BY d.updated_at` externo refere uma coluna não-agregada — proibido pelo Postgres.

Esta função foi introduzida na Onda 1 (consolidação de 2 roundtrips em 1 RPC) e quebrou o carregamento de demandas.

## Correção

Migração única que recria a função movendo o `ORDER BY` para **dentro** do `jsonb_agg(... ORDER BY d.updated_at DESC)`. É a forma idiomática de ordenar elementos dentro do array agregado.

Mantém:
- Assinatura `(p_team_id uuid)` → não exige mudança no cliente.
- `SECURITY DEFINER`, `STABLE`, `search_path = public`.
- Validação de membership em `team_members`.
- Mesmos campos e mesmo formato de retorno (`jsonb` array).
- GRANTs já existentes (`authenticated` tem EXECUTE; `anon` não — correto).

## Mudança técnica (uma migração)

```sql
CREATE OR REPLACE FUNCTION public.get_demandas_with_responsaveis(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao time %', p_team_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object( ... mesmos campos ... )
    ORDER BY d.updated_at DESC      -- ← ordenação agora DENTRO do agg
  )
  INTO v_result
  FROM demandas d
  WHERE d.team_id = p_team_id;       -- ← ORDER BY externo removido

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;
```

## Validação

1. Executar `SELECT public.get_demandas_with_responsaveis('<team_id>')` via `read_query` para confirmar retorno 200 e array ordenado por `updated_at desc`.
2. Recarregar `/sustentacao` na UI e checar que a listagem aparece sem 400 no Network.
3. Conferir nos logs Postgres que o erro `42803` parou de ocorrer.

## Fora de escopo

- Nenhuma alteração no frontend (assinatura/retorno preservados).
- Nenhuma mudança em `get_demandas_with_responsaveis_paged` (já está correta).
- Sem alterações em GRANTs, RLS ou outras funções.
