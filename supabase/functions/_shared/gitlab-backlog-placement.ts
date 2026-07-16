interface WorkflowColumnRow {
  key: string;
  label: string | null;
}

export async function resolveGitlabBacklogPlacement(supabase: any, teamId: string) {
  const [sprintResult, workflowResult] = await Promise.all([
    supabase
      .from("sprints")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workflow_columns")
      .select("key, label")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true }),
  ]);

  const columns = (workflowResult.data ?? []) as WorkflowColumnRow[];
  const explicitBacklog = columns.find((column) =>
    column.key.toLowerCase() === "backlog" || column.label?.trim().toLowerCase() === "backlog"
  );

  return {
    sprintId: sprintResult.data?.id ?? null,
    backlogStatus: explicitBacklog?.key ?? columns[0]?.key ?? "aguardando_desenvolvimento",
    doneStatus: columns.at(-1)?.key ?? "concluido",
  };
}

