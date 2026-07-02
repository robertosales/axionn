-- Remove versões anteriores das policies que a migration seguinte consolida.

DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS companies_admin_all ON public.companies';
    EXECUTE 'DROP POLICY IF EXISTS companies_member_select ON public.companies';
  END IF;

  IF to_regclass('public.licenses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS licenses_admin_all ON public.licenses';
    EXECUTE 'DROP POLICY IF EXISTS licenses_member_select ON public.licenses';
  END IF;
END;
$$;
