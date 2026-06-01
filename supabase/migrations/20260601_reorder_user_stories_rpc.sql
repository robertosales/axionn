-- Migration: RPC batch reorder_user_stories
-- Substitui N updates individuais (drag-and-drop) por 1 roundtrip ao banco.
--
-- Chamada no frontend:
--   supabase.rpc('reorder_user_stories', { p_updates: [{ id: '...', position: 0 }, ...] })
--
-- p_updates: jsonb array de objetos { id uuid, position int }

create or replace function reorder_user_stories(p_updates jsonb)
returns void
language plpgsql
security definer
as $$
declare
  v_item jsonb;
begin
  -- Itera o array recebido e atualiza posição de cada HU em 1 única transação
  for v_item in select * from jsonb_array_elements(p_updates)
  loop
    update user_stories
    set    position = (v_item->>'position')::int
    where  id       = (v_item->>'id')::uuid;
  end loop;
end;
$$;

-- Garante que apenas usuários autenticados podem chamar a função
revoke all on function reorder_user_stories(jsonb) from public;
grant execute on function reorder_user_stories(jsonb) to authenticated;

comment on function reorder_user_stories(jsonb) is
  'Atualiza posições de múltiplas user_stories em batch (1 roundtrip). '
  'Substitui N updates individuais gerados pelo drag-and-drop do Kanban.';
