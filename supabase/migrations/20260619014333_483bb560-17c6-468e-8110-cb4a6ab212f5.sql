
-- FASE 1+2+3: Reconciliação Contrato↔Time↔Projeto↔Demanda

-- 1. Backfill contract_room_teams a partir de teams.contract_id
INSERT INTO public.contract_room_teams (contract_id, team_id, room_type, is_active)
SELECT
  t.contract_id, t.id,
  CASE
    WHEN t.module IN ('agil','sala_agil')        THEN 'agil'
    WHEN t.module IN ('sustentacao','sala_sust') THEN 'sustentacao'
    ELSE 'sustentacao'
  END,
  true
FROM public.teams t
WHERE t.contract_id IS NOT NULL
ON CONFLICT (contract_id, team_id, project_id, room_type) DO NOTHING;

-- 1b. Contratos híbridos: garantir ambas as salas
INSERT INTO public.contract_room_teams (contract_id, team_id, room_type, is_active)
SELECT DISTINCT c.id, t.id, rt.room_type, true
FROM public.contracts c
JOIN public.teams t ON t.contract_id = c.id
CROSS JOIN (VALUES ('agil'), ('sustentacao')) AS rt(room_type)
WHERE c.room_mode = 'hibrido'
ON CONFLICT (contract_id, team_id, project_id, room_type) DO NOTHING;

-- 2. Backfill projects.contract_id
UPDATE public.projects p
SET    contract_id = t.contract_id
FROM   public.teams t
WHERE  p.contract_id IS NULL
  AND  t.id = (SELECT team_id FROM public.project_teams pt WHERE pt.project_id = p.id LIMIT 1)
  AND  t.contract_id IS NOT NULL;

-- 3. Backfill demandas.contract_id (defesa)
UPDATE public.demandas d
SET    contract_id = COALESCE(
         (SELECT p.contract_id FROM public.projects p WHERE p.id = d.project_id),
         (SELECT t.contract_id FROM public.teams t    WHERE t.id = d.team_id),
         (SELECT crt.contract_id FROM public.contract_room_teams crt
           WHERE crt.team_id = d.team_id AND crt.is_active = true LIMIT 1)
       )
WHERE d.contract_id IS NULL;

-- 4. View demandas órfãs
CREATE OR REPLACE VIEW public.v_sustentacao_orfas
WITH (security_invoker = on) AS
SELECT d.id, d.rhm, d.titulo, d.situacao, d.team_id, d.project_id,
       d.created_at, t.name AS team_name
FROM public.demandas d
LEFT JOIN public.teams t ON t.id = d.team_id
WHERE d.contract_id IS NULL AND d.situacao <> 'cancelada';

GRANT SELECT ON public.v_sustentacao_orfas TO authenticated;

-- 5. Trigger crt → teams.contract_id
CREATE OR REPLACE FUNCTION public.fn_sync_team_contract_from_crt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.teams t SET contract_id = (
      SELECT crt.contract_id FROM public.contract_room_teams crt
      WHERE crt.team_id = OLD.team_id AND crt.is_active = true
      ORDER BY crt.created_at DESC LIMIT 1
    ) WHERE t.id = OLD.team_id;
    RETURN OLD;
  ELSE
    IF NEW.is_active THEN
      UPDATE public.teams t SET contract_id = NEW.contract_id WHERE t.id = NEW.team_id;
    END IF;
    RETURN NEW;
  END IF;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_team_contract_from_crt ON public.contract_room_teams;
CREATE TRIGGER trg_sync_team_contract_from_crt
AFTER INSERT OR UPDATE OR DELETE ON public.contract_room_teams
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_team_contract_from_crt();

-- 6. Trigger demandas: herdar contract_id
CREATE OR REPLACE FUNCTION public.fn_demanda_inherit_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contract_id IS NULL THEN
    NEW.contract_id := COALESCE(
      (SELECT p.contract_id FROM public.projects p WHERE p.id = NEW.project_id),
      (SELECT t.contract_id FROM public.teams t    WHERE t.id = NEW.team_id),
      (SELECT crt.contract_id FROM public.contract_room_teams crt
        WHERE crt.team_id = NEW.team_id AND crt.is_active = true LIMIT 1)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_demanda_inherit_contract ON public.demandas;
CREATE TRIGGER trg_demanda_inherit_contract
BEFORE INSERT OR UPDATE OF project_id, team_id ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.fn_demanda_inherit_contract();

-- 7. Trigger projects: herdar contract_id
CREATE OR REPLACE FUNCTION public.fn_project_inherit_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid;
BEGIN
  IF NEW.contract_id IS NULL THEN
    SELECT team_id INTO v_team_id FROM public.project_teams WHERE project_id = NEW.id LIMIT 1;
    IF v_team_id IS NOT NULL THEN
      NEW.contract_id := (SELECT t.contract_id FROM public.teams t WHERE t.id = v_team_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_project_inherit_contract ON public.projects;
CREATE TRIGGER trg_project_inherit_contract
BEFORE INSERT OR UPDATE OF contract_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.fn_project_inherit_contract();

-- 8. fn_get_team_contract com fallback p/ teams.contract_id
CREATE OR REPLACE FUNCTION public.fn_get_team_contract(p_team_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'contract_id', c.id, 'contract_name', c.name, 'contract_status', c.status,
    'room_type', crt.room_type,
    'slas', (SELECT jsonb_agg(to_jsonb(s)) FROM public.contract_slas s WHERE s.contract_id = c.id)
  ) INTO v_result
  FROM public.contract_room_teams crt
  JOIN public.contracts c ON c.id = crt.contract_id
  WHERE crt.team_id = p_team_id AND crt.room_type = 'sustentacao' AND crt.is_active = true
  LIMIT 1;

  IF v_result IS NULL THEN
    SELECT jsonb_build_object(
      'contract_id', c.id, 'contract_name', c.name, 'contract_status', c.status,
      'room_type', crt.room_type,
      'slas', (SELECT jsonb_agg(to_jsonb(s)) FROM public.contract_slas s WHERE s.contract_id = c.id)
    ) INTO v_result
    FROM public.contract_room_teams crt
    JOIN public.contracts c ON c.id = crt.contract_id
    WHERE crt.team_id = p_team_id AND crt.is_active = true LIMIT 1;
  END IF;

  IF v_result IS NULL THEN
    SELECT jsonb_build_object(
      'contract_id', c.id, 'contract_name', c.name, 'contract_status', c.status,
      'room_type', t.module,
      'slas', (SELECT jsonb_agg(to_jsonb(s)) FROM public.contract_slas s WHERE s.contract_id = c.id)
    ) INTO v_result
    FROM public.teams t JOIN public.contracts c ON c.id = t.contract_id
    WHERE t.id = p_team_id LIMIT 1;
  END IF;

  RETURN COALESCE(v_result, jsonb_build_object('status', 'no_contract_linked'));
END; $$;
