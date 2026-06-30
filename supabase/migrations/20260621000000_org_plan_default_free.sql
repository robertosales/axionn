-- Normaliza o plano transitório usado pela migration legada 20260620_001.

UPDATE public.organizations
   SET plan = 'free'::public.org_plan
 WHERE plan::text = 'trial';

ALTER TABLE public.organizations
  ALTER COLUMN plan SET DEFAULT 'free'::public.org_plan;
