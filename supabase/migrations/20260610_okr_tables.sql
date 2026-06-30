-- OKR Module: schema idempotente para replay integral das migrations.

CREATE TABLE IF NOT EXISTS public.okr_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  cycle text NOT NULL,
  status text NOT NULL DEFAULT 'on_track'
    CHECK (status IN ('on_track', 'at_risk', 'off_track', 'completed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.okr_key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  title text NOT NULL,
  unit text NOT NULL DEFAULT '%'
    CHECK (unit IN ('%', 'number', 'bool', 'bugs')),
  target numeric NOT NULL DEFAULT 100,
  current numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.okr_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id uuid NOT NULL REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  note text,
  author_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_objectives_team_cycle
  ON public.okr_objectives(team_id, cycle);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_objective
  ON public.okr_key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_kr
  ON public.okr_check_ins(key_result_id);

ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS okr_objectives_team_select ON public.okr_objectives;
DROP POLICY IF EXISTS okr_objectives_team_insert ON public.okr_objectives;
DROP POLICY IF EXISTS okr_objectives_team_update ON public.okr_objectives;
DROP POLICY IF EXISTS okr_objectives_team_delete ON public.okr_objectives;

CREATE POLICY okr_objectives_team_select
ON public.okr_objectives FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY okr_objectives_team_insert
ON public.okr_objectives FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY okr_objectives_team_update
ON public.okr_objectives FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
)
WITH CHECK (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY okr_objectives_team_delete
ON public.okr_objectives FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

DROP POLICY IF EXISTS okr_key_results_select ON public.okr_key_results;
DROP POLICY IF EXISTS okr_key_results_insert ON public.okr_key_results;
DROP POLICY IF EXISTS okr_key_results_update ON public.okr_key_results;
DROP POLICY IF EXISTS okr_key_results_delete ON public.okr_key_results;

CREATE POLICY okr_key_results_select
ON public.okr_key_results FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.okr_objectives objective
    WHERE objective.id = objective_id
      AND public.is_team_member(auth.uid(), objective.team_id)
  )
);

CREATE POLICY okr_key_results_insert
ON public.okr_key_results FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.okr_objectives objective
    WHERE objective.id = objective_id
      AND public.is_team_member(auth.uid(), objective.team_id)
  )
);

CREATE POLICY okr_key_results_update
ON public.okr_key_results FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.okr_objectives objective
    WHERE objective.id = objective_id
      AND public.is_team_member(auth.uid(), objective.team_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.okr_objectives objective
    WHERE objective.id = objective_id
      AND public.is_team_member(auth.uid(), objective.team_id)
  )
);

CREATE POLICY okr_key_results_delete
ON public.okr_key_results FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.okr_objectives objective
    WHERE objective.id = objective_id
      AND public.is_team_member(auth.uid(), objective.team_id)
  )
);

DROP POLICY IF EXISTS okr_check_ins_select ON public.okr_check_ins;
DROP POLICY IF EXISTS okr_check_ins_insert ON public.okr_check_ins;

CREATE POLICY okr_check_ins_select
ON public.okr_check_ins FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.okr_key_results key_result
    JOIN public.okr_objectives objective
      ON objective.id = key_result.objective_id
    WHERE key_result.id = key_result_id
      AND public.is_team_member(auth.uid(), objective.team_id)
  )
);

CREATE POLICY okr_check_ins_insert
ON public.okr_check_ins FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.okr_key_results key_result
      JOIN public.okr_objectives objective
        ON objective.id = key_result.objective_id
      WHERE key_result.id = key_result_id
        AND public.is_team_member(auth.uid(), objective.team_id)
    )
  )
);

CREATE OR REPLACE FUNCTION public.fn_okr_recalc_objective_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_objective_id uuid;
  v_progress integer;
  v_status text;
BEGIN
  SELECT objective_id
    INTO v_objective_id
    FROM public.okr_key_results
   WHERE id = NEW.key_result_id;

  UPDATE public.okr_key_results
     SET current = NEW.value,
         updated_at = now()
   WHERE id = NEW.key_result_id;

  SELECT round(avg(
    CASE
      WHEN unit = 'bugs' THEN greatest(0, 100 - current * 20)
      WHEN unit = 'bool' THEN CASE WHEN current >= target THEN 100 ELSE 0 END
      WHEN target = 0 THEN 100
      ELSE least(100, round((current / target) * 100))
    END
  ))::integer
    INTO v_progress
    FROM public.okr_key_results
   WHERE objective_id = v_objective_id;

  v_status := CASE
    WHEN v_progress >= 100 THEN 'completed'
    WHEN v_progress >= 70 THEN 'on_track'
    WHEN v_progress >= 40 THEN 'at_risk'
    ELSE 'off_track'
  END;

  UPDATE public.okr_objectives
     SET progress = coalesce(v_progress, 0),
         status = v_status,
         updated_at = now()
   WHERE id = v_objective_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_okr_checkin_recalc ON public.okr_check_ins;
CREATE TRIGGER trg_okr_checkin_recalc
AFTER INSERT ON public.okr_check_ins
FOR EACH ROW EXECUTE FUNCTION public.fn_okr_recalc_objective_progress();
