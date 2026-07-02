-- Garante a coluna usada pelas policies de responsabilidade da HU.

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS assignee_id uuid
    REFERENCES public.profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_stories_assignee_id
  ON public.user_stories(assignee_id)
  WHERE assignee_id IS NOT NULL;
