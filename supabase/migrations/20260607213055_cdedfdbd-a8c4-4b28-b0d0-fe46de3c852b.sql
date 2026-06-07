CREATE UNIQUE INDEX IF NOT EXISTS demandas_no_duplicates_idx
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