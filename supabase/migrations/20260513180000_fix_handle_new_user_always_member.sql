-- ============================================
-- FIX SEGURANÇA: Remove lógica de primeiro admin automático
-- Todos os novos usuários recebem role 'member' por padrão
-- O admin inicial deve ser definido manualmente via seed_admin.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Cria perfil automaticamente
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  -- SEGURANÇA: Todos os usuários recebem 'member' por padrão.
  -- O admin inicial deve ser definido manualmente executando:
  -- supabase/seeds/seed_admin.sql
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
