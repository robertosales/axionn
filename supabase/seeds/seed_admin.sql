-- ============================================
-- SEED: Definição do Admin Inicial
-- ============================================
-- INSTRUÇÕES:
--   1. Certifique-se de que o usuário já se cadastrou na aplicação
--   2. Substitua o e-mail abaixo pelo e-mail do admin desejado
--   3. Execute este script UMA ÚNICA VEZ no Supabase SQL Editor:
--      https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql
--   4. Guarde este arquivo em local seguro — não commite com e-mails reais
-- ============================================

SELECT public.set_first_admin('SEU_EMAIL_ADMIN@dominio.com');

-- Verificação: confirma que o admin foi criado corretamente
SELECT
  u.email,
  r.role,
  p.display_name
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id
JOIN public.profiles p ON p.user_id = u.id
WHERE r.role = 'admin';
