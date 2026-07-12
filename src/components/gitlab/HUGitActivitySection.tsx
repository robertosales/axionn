import { useState } from "react";
import { useHUGitActivity } from "@/hooks/useHUGitActivity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitMerge, GitCommit, Rocket, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

interface Props {
  huId: string;
  organizationId: string;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (24 * 3600e3));
  if (days >= 1) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const hours = Math.floor(diff / 3600e3);
  if (hours >= 1) return `há ${hours}h`;
  const mins = Math.floor(diff / 60000);
  return mins <= 1 ? "agora" : `há ${mins}min`;
}

const MR_STATE_COLOR: Record<string, string> = {
  opened: "bg-blue-100 text-blue-700",
  merged: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-700",
  locked: "bg-amber-100 text-amber-700",
};

const ENV_COLOR: Record<string, string> = {
  production: "bg-rose-100 text-rose-700",
  staging: "bg-orange-100 text-orange-700",
  homolog: "bg-amber-100 text-amber-700",
};

function truncate(s: string | null | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function HUGitActivitySection({ huId, organizationId }: Props) {
  const [open, setOpen] = useState(true);
  const { hasIntegration, isLoadingIntegration, mergeRequests, commits, gitSummary, isLoading } =
    useHUGitActivity(huId, organizationId);

  if (isLoadingIntegration || !hasIntegration) return null;

  const latestDeploy = gitSummary?.latest_production_deployment as
    | { environment?: string; status?: string; deployed_at?: string; commit_sha?: string }
    | null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <GitMerge className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">🔀 Atividade Git</h3>
            <p className="text-xs text-slate-500">
              MRs, commits e deploys vinculados a esta HU
            </p>
          </div>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {gitSummary && (
            <div className="flex flex-wrap gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span><strong className="text-slate-900">{gitSummary.mr_count ?? 0}</strong> MRs</span>
              <span><strong className="text-slate-900">{gitSummary.commit_count ?? 0}</strong> Commits</span>
              <span><strong className="text-slate-900">{gitSummary.deployment_count ?? 0}</strong> Deploys</span>
              <span>Última atividade: <strong className="text-slate-900">{relativeTime(gitSummary.last_git_activity_at)}</strong></span>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GitMerge className="h-4 w-4" /> Merge Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <p className="text-xs text-slate-400">Carregando…</p>
                ) : mergeRequests.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum MR vinculado a esta HU</p>
                ) : (
                  mergeRequests.map((mr) => (
                    <div key={mr.id} className="rounded-xl border border-slate-100 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={`${MR_STATE_COLOR[mr.state] ?? "bg-slate-100 text-slate-700"} border-0`}>
                          {mr.state}
                        </Badge>
                        {mr.web_url && (
                          <a href={mr.web_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-700">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="mt-2 font-medium text-slate-900" title={mr.title}>
                        !{mr.mr_iid} {truncate(mr.title, 60)}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">
                        {mr.source_branch} → {mr.target_branch}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {mr.author_username ?? "—"} • {relativeTime(mr.merged_at ?? mr.closed_at ?? mr.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GitCommit className="h-4 w-4" /> Commits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <p className="text-xs text-slate-400">Carregando…</p>
                ) : commits.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum commit vinculado</p>
                ) : (
                  commits.map((c) => (
                    <div key={c.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
                          {c.short_sha ?? c.commit_sha.slice(0, 8)}
                        </span>
                        {c.web_url && (
                          <a href={c.web_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-700">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <p className="mt-1 text-slate-900" title={c.message}>{truncate(c.message.split("\n")[0], 60)}</p>
                      <p className="text-[10px] text-slate-500">
                        {c.author_name ?? c.author_email ?? "—"} • {relativeTime(c.committed_at)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Rocket className="h-4 w-4" /> Deploy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!latestDeploy ? (
                  <p className="text-xs text-slate-500">Sem deploys registrados</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    <Badge
                      className={`${
                        ENV_COLOR[latestDeploy.environment ?? ""] ?? "bg-blue-100 text-blue-700"
                      } border-0`}
                    >
                      {latestDeploy.environment ?? "—"}
                    </Badge>
                    <p className="text-slate-900">
                      Status: <strong>{latestDeploy.status ?? "—"}</strong>
                    </p>
                    <p className="text-slate-500">{relativeTime(latestDeploy.deployed_at)}</p>
                    {latestDeploy.commit_sha && (
                      <p className="font-mono text-[10px] text-slate-500">
                        {latestDeploy.commit_sha.slice(0, 8)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}