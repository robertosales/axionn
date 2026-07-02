-- Portable replacement for the original environment-specific backfill.

CREATE TABLE IF NOT EXISTS public.team_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  module text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, module)
);

CREATE INDEX IF NOT EXISTS idx_team_modules_team_id
  ON public.team_modules(team_id);

ALTER TABLE public.team_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_modules: leitura autenticada" ON public.team_modules;
DROP POLICY IF EXISTS "team_modules: leitura por membros" ON public.team_modules;
DROP POLICY IF EXISTS "team_modules: escrita admin" ON public.team_modules;

CREATE POLICY "team_modules: leitura por membros"
ON public.team_modules FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "team_modules: escrita admin"
ON public.team_modules FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
