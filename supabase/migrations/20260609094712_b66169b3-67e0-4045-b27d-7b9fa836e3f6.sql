
-- Fix 1: Remove overly permissive policies on contract_slas
DROP POLICY IF EXISTS "slas_all" ON public.contract_slas;
DROP POLICY IF EXISTS "slas_select" ON public.contract_slas;

-- Fix 2: Remove privilege escalation vector from is_admin().
-- Admin status must only be determined by user_roles, never by self-editable profile fields.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$function$;

-- Defense in depth: trigger preventing non-admins from changing their own module_access
CREATE OR REPLACE FUNCTION public.prevent_self_module_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.module_access IS DISTINCT FROM OLD.module_access
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change module_access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_module_access_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_module_access_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_module_access_change();
