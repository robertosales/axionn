-- Normaliza o plano transitório usado pela migration legada.

UPDATE public.organizations
   SET plan = 'free'::public.org_plan
 WHERE plan::text = 'trial';

ALTER TABLE public.organizations
  ALTER COLUMN plan SET DEFAULT 'free'::public.org_plan;
