begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

select has_table('public', 'backlog_features', 'backlog feature table exists');
select has_column('public', 'user_stories', 'feature_id', 'stories expose feature_id');
select has_index('public', 'backlog_features', 'idx_backlog_features_team_id', 'team lookup is indexed');
select has_index('public', 'backlog_features', 'idx_backlog_features_epic_id', 'epic lookup is indexed');
select has_index('public', 'user_stories', 'idx_user_stories_feature_id', 'story feature lookup is indexed');

select has_trigger('public', 'backlog_features', 'validate_backlog_feature_hierarchy', 'feature hierarchy is validated');
select has_trigger('public', 'backlog_features', 'sync_backlog_feature_epic_to_stories', 'feature moves synchronize stories');
select has_trigger('public', 'backlog_features', 'prevent_linked_backlog_feature_delete', 'linked features cannot be deleted');
select has_trigger('public', 'user_stories', 'validate_user_story_feature_hierarchy', 'story hierarchy is validated');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.backlog_features'::regclass),
  'RLS is enabled on backlog_features'
);
select ok(not has_table_privilege('anon', 'public.backlog_features', 'select'), 'anon cannot read backlog features');
select ok(has_table_privilege('authenticated', 'public.backlog_features', 'select'), 'authenticated can read permitted backlog features');
select ok(not has_function_privilege('authenticated', 'public.validate_backlog_hierarchy()', 'execute'), 'validation trigger function is not directly executable');
select ok(not has_function_privilege('authenticated', 'public.prevent_linked_backlog_feature_delete()', 'execute'), 'delete guard is not directly executable');

select * from finish();
rollback;
