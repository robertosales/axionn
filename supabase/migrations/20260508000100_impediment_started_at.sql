-- Adiciona coluna started_at na tabela impediments.
-- Permite registrar a data em que o impedimento efetivamente começou
-- (diferente de created_at que é o momento do registro).

ALTER TABLE public.impediments
  ADD COLUMN IF NOT EXISTS started_at date NULL;

COMMENT ON COLUMN public.impediments.started_at IS
  'Data em que o impedimento começou (informada pelo usuário). Pode ser anterior à data de registro.';
