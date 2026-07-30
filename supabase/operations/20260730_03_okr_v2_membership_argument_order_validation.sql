-- OKR V2 - validacao somente leitura da ordem canonica de membership.
-- Executar depois de 20260730190000_okr_v2_membership_argument_order_fix.sql.

with function_contract as (
  select
    position(
      'is_organization_member(_org_id, _user_id)'
      in pg_get_functiondef(
        to_regprocedure('public.has_okr_permission_v2(uuid,text,uuid)')
      )
    ) > 0 as permission_guard_uses_org_then_user,
    position(
      'is_organization_member(p_org_id, auth.uid())'
      in pg_get_functiondef(
        to_regprocedure('public.list_okr_cycles_v1(uuid)')
      )
    ) > 0 as cycle_list_uses_org_then_user
),
policy_contract as (
  select
    count(*) filter (
      where tablename = 'okr_cycles'
        and policyname = 'okr_cycles_org_member_select'
        and position(
          'is_organization_member(organization_id, auth.uid())'
          in coalesce(qual, '')
        ) > 0
    ) = 1 as cycle_policy_uses_org_then_user,
    count(*) filter (
      where tablename = 'okr_objective_alignments'
        and policyname = 'okr_alignments_select'
        and position(
          'is_organization_member(organization_id, auth.uid())'
          in coalesce(qual, '')
        ) > 0
    ) = 1 as alignment_policy_uses_org_then_user
  from pg_policies
  where schemaname = 'public'
    and tablename in ('okr_cycles', 'okr_objective_alignments')
)
select
  fc.*,
  pc.*,
  (
    fc.permission_guard_uses_org_then_user
    and fc.cycle_list_uses_org_then_user
    and pc.cycle_policy_uses_org_then_user
    and pc.alignment_policy_uses_org_then_user
  ) as okr_v2_membership_argument_order_validation_ok
from function_contract fc
cross join policy_contract pc;
