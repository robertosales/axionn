-- ============================================================
-- Security hardening migration
-- ============================================================

-- 1. activity_comments: enforce user_id = auth.uid() on insert
DROP POLICY IF EXISTS "Member insert own team comments" ON public.activity_comments;
CREATE POLICY "Member insert own team comments"
ON public.activity_comments FOR INSERT TO public
WITH CHECK (is_team_member(auth.uid(), team_id) AND user_id = auth.uid());

-- 2. demanda_hours: enforce user_id = auth.uid()
DROP POLICY IF EXISTS "Member insert demanda_hours" ON public.demanda_hours;
CREATE POLICY "Member insert demanda_hours"
ON public.demanda_hours FOR INSERT TO public
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    WHERE d.id = demanda_hours.demanda_id
      AND is_team_member(auth.uid(), d.team_id)
  )
);

-- 3. demanda_transitions
DROP POLICY IF EXISTS "Member insert demanda_transitions" ON public.demanda_transitions;
CREATE POLICY "Member insert demanda_transitions"
ON public.demanda_transitions FOR INSERT TO public
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    WHERE d.id = demanda_transitions.demanda_id
      AND is_team_member(auth.uid(), d.team_id)
  )
);

-- 4. demanda_eventos
DROP POLICY IF EXISTS "Member insert demanda_eventos" ON public.demanda_eventos;
CREATE POLICY "Member insert demanda_eventos"
ON public.demanda_eventos FOR INSERT TO public
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    WHERE d.id = demanda_eventos.demanda_id
      AND is_team_member(auth.uid(), d.team_id)
  )
);

-- 5. demanda_evidencias
DROP POLICY IF EXISTS "Member insert demanda_evidencias" ON public.demanda_evidencias;
CREATE POLICY "Member insert demanda_evidencias"
ON public.demanda_evidencias FOR INSERT TO public
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.demandas d
    WHERE d.id = demanda_evidencias.demanda_id
      AND is_team_member(auth.uid(), d.team_id)
  )
);

-- 6. planning_votes
DROP POLICY IF EXISTS "Member insert planning_votes" ON public.planning_votes;
CREATE POLICY "Member insert planning_votes"
ON public.planning_votes FOR INSERT TO public
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.planning_sessions ps
    WHERE ps.id = planning_votes.session_id
      AND is_team_member(auth.uid(), ps.team_id)
  )
);

-- 7. retro_votes
DROP POLICY IF EXISTS "Member insert retro_votes" ON public.retro_votes;
CREATE POLICY "Member insert retro_votes"
ON public.retro_votes FOR INSERT TO public
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.retro_sessions rs
    WHERE rs.id = retro_votes.session_id
      AND is_team_member(auth.uid(), rs.team_id)
  )
);

-- 8. retro_cards (author_id)
DROP POLICY IF EXISTS "Member insert retro_cards" ON public.retro_cards;
CREATE POLICY "Member insert retro_cards"
ON public.retro_cards FOR INSERT TO public
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.retro_sessions rs
    WHERE rs.id = retro_cards.session_id
      AND is_team_member(auth.uid(), rs.team_id)
  )
);

-- 9. rdm_gonogo: enforce profile_id belongs to auth user
DROP POLICY IF EXISTS "rdm_gonogo_insert" ON public.rdm_gonogo;
DROP POLICY IF EXISTS "rdm_gonogo_update" ON public.rdm_gonogo;
CREATE POLICY "rdm_gonogo_insert"
ON public.rdm_gonogo FOR INSERT TO public
WITH CHECK (
  (is_admin() OR fn_rdm_has_permission('rdm.approve'::text))
  AND profile_id IN (
    SELECT id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);
CREATE POLICY "rdm_gonogo_update"
ON public.rdm_gonogo FOR UPDATE TO public
USING (
  (is_admin() OR fn_rdm_has_permission('rdm.approve'::text))
  AND profile_id IN (
    SELECT id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

-- 10. demanda_responsaveis: drop permissive true policies
DROP POLICY IF EXISTS "Authenticated users can delete demanda_responsaveis" ON public.demanda_responsaveis;
DROP POLICY IF EXISTS "Authenticated users can insert demanda_responsaveis" ON public.demanda_responsaveis;
DROP POLICY IF EXISTS "Authenticated users can select demanda_responsaveis" ON public.demanda_responsaveis;

-- 11. team_modules may be introduced by a later migration in clean databases.
DO $$
BEGIN
  IF to_regclass('public.team_modules') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "team_modules: leitura autenticada" ON public.team_modules';
    EXECUTE 'DROP POLICY IF EXISTS "team_modules: leitura por membros" ON public.team_modules';
    EXECUTE $policy$
      CREATE POLICY "team_modules: leitura por membros"
      ON public.team_modules FOR SELECT TO authenticated
      USING (is_team_member(auth.uid(), team_id))
    $policy$;
  END IF;
END;
$$;

-- ============================================================
-- STORAGE: attachments bucket cleanup
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view own team files" ON storage.objects;

UPDATE storage.buckets SET public = false WHERE id = 'attachments';

CREATE POLICY "Team members can view team attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1
    FROM public.attachments a
    WHERE a.file_path = storage.objects.name
      AND is_team_member(auth.uid(), a.team_id)
  )
);

CREATE POLICY "Authenticated users can upload to own folder attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- STORAGE: apf-documents bucket - team scope
-- ============================================================
DROP POLICY IF EXISTS "apf-documents: authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "apf-documents: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "apf-documents: authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "apf-documents: team read" ON storage.objects;
DROP POLICY IF EXISTS "apf-documents: team upload" ON storage.objects;
DROP POLICY IF EXISTS "apf-documents: team delete" ON storage.objects;

UPDATE storage.buckets SET public = false WHERE id = 'apf-documents';

CREATE POLICY "apf-documents: team read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'apf-documents'
  AND EXISTS (
    SELECT 1
    FROM public.apf_generations g
    WHERE g.id::text = (storage.foldername(name))[1]
      AND is_team_member(auth.uid(), g.team_id)
  )
);

CREATE POLICY "apf-documents: team upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'apf-documents'
  AND EXISTS (
    SELECT 1
    FROM public.apf_generations g
    WHERE g.id::text = (storage.foldername(name))[1]
      AND is_team_member(auth.uid(), g.team_id)
  )
);

CREATE POLICY "apf-documents: team delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'apf-documents'
  AND EXISTS (
    SELECT 1
    FROM public.apf_generations g
    WHERE g.id::text = (storage.foldername(name))[1]
      AND is_team_member(auth.uid(), g.team_id)
  )
);
