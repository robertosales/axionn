-- Pega o id do time "[NEXO] - TIME A - B" (ou qualquer time que contenha NEXO + TIME A)
SELECT id, name, created_at
FROM teams
WHERE name ILIKE '%NEXO%TIME A%'
ORDER BY name;
