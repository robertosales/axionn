-- Consolidar perfis duplicados @globalweb mantendo o mais antigo (canônico)
-- e remapeando todas as referências do duplicado para o canônico.
--
-- A coluna developers.user_id foi introduzida depois em alguns ambientes.
-- O bloco correspondente é condicional para manter o replay integral das
-- migrations em bancos limpos sem alterar o saneamento dos demais recursos.

DO $$
DECLARE
  pares CONSTANT jsonb := '[
    {"dup":"81a2c33d-1a1e-41f6-a18c-77049b43f7b6","canon":"00f4c2c9-8747-48e2-874a-965f085eb655"},
    {"dup":"9085ae38-0f51-455a-8857-66920de004e1","canon":"2619b3ad-5d10-4a8f-ba1d-c37247456e93"},
    {"dup":"df16812e-01d0-460e-abb1-fc3461e14cb8","canon":"385ae43d-2d4a-4fb8-9532-62cc634c6285"},
    {"dup":"ade8945c-0a0a-4312-9713-11b9169ec2d6","canon":"385ae43d-2d4a-4fb8-9532-62cc634c6285"},
    {"dup":"1a6d839c-83b4-4a53-a128-162b1daeb02b","canon":"a1cfab14-a874-4d34-85c2-418980627ebc"},
    {"dup":"e496aa51-ff59-4cbf-a2fb-9fd0821324ae","canon":"aa5c2be2-8747-4f02-a283-c7bfb61d7f66"}
  ]'::jsonb;
  par jsonb;
  dup_id uuid;
  canon_id uuid;
  developers_has_user_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'developers'
      AND column_name = 'user_id'
  )
  INTO developers_has_user_id;

  FOR par IN SELECT * FROM jsonb_array_elements(pares) LOOP
    dup_id := (par->>'dup')::uuid;
    canon_id := (par->>'canon')::uuid;

    -- demandas (responsáveis + demandante + aceite)
    UPDATE demandas SET responsavel_dev = canon_id WHERE responsavel_dev = dup_id;
    UPDATE demandas SET responsavel_requisitos = canon_id WHERE responsavel_requisitos = dup_id;
    UPDATE demandas SET responsavel_teste = canon_id WHERE responsavel_teste = dup_id;
    UPDATE demandas SET responsavel_arquiteto = canon_id WHERE responsavel_arquiteto = dup_id;
    UPDATE demandas SET demandante = canon_id WHERE demandante = dup_id;
    UPDATE demandas SET aceite_responsavel = canon_id WHERE aceite_responsavel = dup_id;

    -- demanda_responsaveis: evitar violar UNIQUE(demanda_id,user_id,papel) se existir
    DELETE FROM demanda_responsaveis dr1
      WHERE dr1.user_id = dup_id
        AND EXISTS (SELECT 1 FROM demanda_responsaveis dr2
                     WHERE dr2.demanda_id = dr1.demanda_id
                       AND dr2.papel = dr1.papel
                       AND dr2.user_id = canon_id);
    UPDATE demanda_responsaveis SET user_id = canon_id WHERE user_id = dup_id;

    -- demanda_hours / evidencias / eventos / transitions
    UPDATE demanda_hours SET user_id = canon_id WHERE user_id = dup_id;
    UPDATE demanda_evidencias SET user_id = canon_id WHERE user_id = dup_id;
    UPDATE demanda_eventos SET user_id = canon_id WHERE user_id = dup_id;
    UPDATE demanda_transitions SET user_id = canon_id WHERE user_id = dup_id;

    -- ágil
    UPDATE activities SET assignee_id = canon_id WHERE assignee_id = dup_id;
    UPDATE activity_comments SET user_id = canon_id WHERE user_id = dup_id;
    UPDATE attachments SET uploaded_by = canon_id WHERE uploaded_by = dup_id;
    UPDATE notifications SET user_id = canon_id WHERE user_id = dup_id;
    UPDATE calendar_events SET user_id = canon_id WHERE user_id = dup_id;

    -- planning poker
    DELETE FROM planning_participants pp1
      WHERE pp1.user_id = dup_id
        AND EXISTS (SELECT 1 FROM planning_participants pp2
                     WHERE pp2.session_id = pp1.session_id AND pp2.user_id = canon_id);
    UPDATE planning_participants SET user_id = canon_id WHERE user_id = dup_id;
    DELETE FROM planning_votes pv1
      WHERE pv1.user_id = dup_id
        AND EXISTS (SELECT 1 FROM planning_votes pv2
                     WHERE pv2.session_id = pv1.session_id AND pv2.hu_id = pv1.hu_id AND pv2.user_id = canon_id);
    UPDATE planning_votes SET user_id = canon_id WHERE user_id = dup_id;
    UPDATE planning_rounds SET facilitator_id = canon_id WHERE facilitator_id = dup_id;
    UPDATE planning_sessions SET created_by = canon_id WHERE created_by = dup_id;

    -- retro
    UPDATE retro_cards SET author_id = canon_id WHERE author_id = dup_id;
    UPDATE retro_cards SET action_owner_id = canon_id WHERE action_owner_id = dup_id;
    UPDATE retro_actions SET owner_id = canon_id WHERE owner_id = dup_id;
    DELETE FROM retro_participants rp1
      WHERE rp1.user_id = dup_id
        AND EXISTS (SELECT 1 FROM retro_participants rp2
                     WHERE rp2.session_id = rp1.session_id AND rp2.user_id = canon_id);
    UPDATE retro_participants SET user_id = canon_id WHERE user_id = dup_id;

    -- developers: coluna ausente no schema inicial de alguns ambientes.
    IF developers_has_user_id THEN
      DELETE FROM developers d1
        WHERE d1.user_id = dup_id
          AND EXISTS (SELECT 1 FROM developers d2
                       WHERE d2.team_id = d1.team_id AND d2.user_id = canon_id);
      UPDATE developers SET user_id = canon_id WHERE user_id = dup_id;
    END IF;

    DELETE FROM team_members tm1
      WHERE tm1.user_id = dup_id
        AND EXISTS (SELECT 1 FROM team_members tm2
                     WHERE tm2.team_id = tm1.team_id AND tm2.user_id = canon_id);
    UPDATE team_members SET user_id = canon_id WHERE user_id = dup_id;

    DELETE FROM user_roles ur1
      WHERE ur1.user_id = dup_id
        AND EXISTS (SELECT 1 FROM user_roles ur2
                     WHERE ur2.user_id = canon_id AND ur2.role = ur1.role);
    UPDATE user_roles SET user_id = canon_id WHERE user_id = dup_id;

    -- por fim, remove o perfil duplicado
    DELETE FROM profiles WHERE user_id = dup_id;
  END LOOP;
END $$;
