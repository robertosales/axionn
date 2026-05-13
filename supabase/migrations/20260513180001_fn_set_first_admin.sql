-- ============================================
-- FUNÇÃO: set_first_admin
-- Promove um usuário a admin pelo e-mail
-- Proteção: só funciona se não existir nenhum admin cadastrado
-- Uso: SELECT set_first_admin('seu-email@dominio.com');
-- ============================================

CREATE OR REPLACE FUNCTION public.set_first_admin(_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _admin_count INT;
BEGIN
  -- Verifica se já existe algum admin cadastrado
  SELECT COUNT(*) INTO _admin_count
  FROM public.user_roles
  WHERE role = 'admin';

  IF _admin_count > 0 THEN
    RETURN 'ERRO: Já existe um admin cadastrado no sistema. Use o painel admin para promover novos admins.';
  END IF;

  -- Busca o user_id pelo e-mail
  SELECT id INTO _user_id
  FROM auth.users
  WHERE email = _email;

  IF _user_id IS NULL THEN
    RETURN 'ERRO: Usuário com e-mail ' || _email || ' não encontrado. Certifique-se de que ele já se cadastrou.';
  END IF;

  -- Atualiza a role de member para admin
  UPDATE public.user_roles
  SET role = 'admin'
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    -- Caso não tenha role ainda, insere diretamente
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin');
  END IF;

  RETURN 'Sucesso: ' || _email || ' agora é admin do sistema.';
END;
$$;
