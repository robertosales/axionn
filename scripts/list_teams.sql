-- ============================================================
-- Lista todos os Times da organização.
-- Une DOIS caminhos de vínculo (pois times podem ligar à org
-- via contract_teams OU via project_teams -> projetos -> contracts):
--   caminho A: teams -> contract_teams -> contracts -> organizations
--   caminho B: teams -> project_teams -> projetos -> contracts -> organizations
-- Rode no Supabase Studio > SQL Editor.
-- ============================================================

SELECT
  o.id    AS organization_id,
  o.name  AS organization_name,
  c.id    AS contract_id,
  c.name  AS contract_name,
  t.id    AS team_id,
  t.name  AS team_name,
  'contract_teams' AS vinculo
FROM teams t
JOIN contract_teams ct ON ct.team_id = t.id
JOIN contracts      c  ON c.id = ct.contract_id
JOIN organizations o  ON o.id = c.org_id

UNION ALL

SELECT
  o.id    AS organization_id,
  o.name  AS organization_name,
  c.id    AS contract_id,
  c.name  AS contract_name,
  t.id    AS team_id,
  t.name  AS team_name,
  'project_teams' AS vinculo
FROM teams t
JOIN project_teams pt ON pt.team_id = t.id
JOIN projetos       p  ON p.id = pt.project_id
JOIN contracts      c  ON c.id = p.contract_id
JOIN organizations o  ON o.id = c.org_id

ORDER BY organization_name, contract_name, team_name;

-- Filtro por UMA organização (substitua <ORG_ID>):
/*
SELECT t.id AS team_id, t.name AS team_name, c.name AS contract_name, src.vinculo
FROM teams t
JOIN (
  SELECT ct.team_id, c.id AS contract_id, c.org_id, 'contract_teams' AS vinculo
  FROM contract_teams ct JOIN contracts c ON c.id = ct.contract_id
  UNION ALL
  SELECT pt.team_id, c.id, c.org_id, 'project_teams'
  FROM project_teams pt JOIN projetos p ON p.id = pt.project_id
  JOIN contracts c ON c.id = p.contract_id
) src ON src.team_id = t.id
JOIN contracts c ON c.id = src.contract_id
WHERE src.org_id = '<ORG_ID>'
ORDER BY t.name;
*/
