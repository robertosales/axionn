import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Pencil, RefreshCw, Trash2, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitlabEventsPanel } from "@/components/gitlab/GitlabEventsPanel";
import {
  listGitlabIntegrations,
  createGitlabIntegration,
  updateGitlabIntegration,
  deleteGitlabIntegration,
  buildGitlabIntegrationPayload,
  validateGitlabIntegrationPayload,
  type GitlabIntegration,
} from "../services/gitlabIntegrations.service";

interface FormState {
  id?: string;
  name: string;
  baseUrl: string;
  repositoryPath: string;
  repositoryName: string;
  apiUrl: string;
  accessToken: string;
  webhookSecret: string;
  isActive: boolean;
  teamId: string;
  syncIssuesAsBacklog: boolean;
  issueLabelsJson: string;
}

const EMPTY: FormState = {
  name: "",
  baseUrl: "https://gitlab.com",
  repositoryPath: "",
  repositoryName: "",
  apiUrl: "https://gitlab.com/api/v4",
  accessToken: "",
  webhookSecret: "",
  isActive: true,
  teamId: "",
  syncIssuesAsBacklog: true,
  issueLabelsJson: "",
};

export function AdminGitlabIntegrationsPage() {
  const { currentOrganizationId } = useOrganization();
  const [items, setItems] = useState<GitlabIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GitlabIntegration | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [tab, setTab] = useState<"config" | "events">("config");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!currentOrganizationId) {
      setTeams([]);
      return;
    }
    (async () => {
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id")
        .eq("org_id", currentOrganizationId);
      const ids = (contracts ?? []).map((c: { id: string }) => c.id);
      if (!ids.length) {
        setTeams([]);
        return;
      }
      const { data } = await supabase
        .from("contract_teams")
        .select("teams ( id, name )")
        .in("contract_id", ids);
      const seen = new Set<string>();
      const out: { id: string; name: string }[] = [];
      for (const row of (data ?? []) as unknown as Array<{ teams?: { id: string; name: string } | null }>) {
        const t = row.teams;
        if (t?.id && !seen.has(t.id)) {
          seen.add(t.id);
          out.push({ id: t.id, name: t.name });
        }
      }
      setTeams(out);
    })();
  }, [currentOrganizationId]);

  const load = async () => {
    if (!currentOrganizationId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listGitlabIntegrations(currentOrganizationId);
      setItems(data);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao carregar integrações GitLab");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentOrganizationId]);

  useEffect(() => {
    if (items.length && !selectedIntegrationId) {
      setSelectedIntegrationId(items[0].id);
    } else if (selectedIntegrationId && !items.find((i) => i.id === selectedIntegrationId)) {
      setSelectedIntegrationId(items[0]?.id ?? null);
    }
  }, [items, selectedIntegrationId]);

  const openCreate = () => {
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (item: GitlabIntegration) => {
    setForm({
      id: item.id,
      name: item.name,
      baseUrl: item.baseUrl,
      repositoryPath: item.repositoryPath ?? "",
      repositoryName: item.repositoryName ?? "",
      apiUrl: item.apiUrl ?? "",
      accessToken: item.accessToken ?? "",
      webhookSecret: item.webhookSecret ?? "",
      isActive: item.isActive,
      teamId: item.teamId ?? "",
      syncIssuesAsBacklog: item.syncIssuesAsBacklog,
      issueLabelsJson: item.issueLabelsTeamMap && Object.keys(item.issueLabelsTeamMap).length
        ? JSON.stringify(item.issueLabelsTeamMap)
        : "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!currentOrganizationId) {
      toast.error("Selecione uma organização primeiro.");
      return;
    }

    const validation = validateGitlabIntegrationPayload({
      name: form.name,
      baseUrl: form.baseUrl,
      repositoryPath: form.repositoryPath,
      repositoryName: form.repositoryName,
      apiUrl: form.apiUrl,
      accessToken: form.accessToken,
      webhookSecret: form.webhookSecret,
      isActive: form.isActive,
    });

    if (!validation.ok) {
      toast.error("Preencha pelo menos nome, URL base e caminho do repositório.");
      return;
    }

    if (form.syncIssuesAsBacklog && !form.teamId) {
      toast.error("Selecione o Time de destino para importar issues como backlog.");
      return;
    }

    let issueLabelsTeamMap: Record<string, string> = {};
    if (form.issueLabelsJson.trim()) {
      try {
        issueLabelsTeamMap = JSON.parse(form.issueLabelsJson);
      } catch {
        toast.error("Mapa de labels inválido (deve ser um JSON válido).");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = buildGitlabIntegrationPayload({
        organizationId: currentOrganizationId,
        name: form.name,
        baseUrl: form.baseUrl,
        repositoryPath: form.repositoryPath,
        repositoryName: form.repositoryName,
        apiUrl: form.apiUrl,
        accessToken: form.accessToken,
        webhookSecret: form.webhookSecret,
        isActive: form.isActive,
        teamId: form.teamId || null,
        syncIssuesAsBacklog: form.syncIssuesAsBacklog,
        issueLabelsTeamMap,
      });

      const saved = form.id
        ? await updateGitlabIntegration(form.id, payload)
        : await createGitlabIntegration(payload);

      if (form.id) {
        toast.success("Integração GitLab atualizada");
      } else {
        toast.success("Integração GitLab criada");
      }

      if (form.accessToken) {
        const { error } = await supabase.functions.invoke("gitlab-webhook-register", {
          body: { integrationId: saved.id },
        });
        if (error) {
          toast.error(
            `Integração salva, mas o auto-registro do webhook falhou: ${error.message ?? "erro desconhecido"}. Use "Re-registrar webhook" após revisar o token.`,
          );
        } else {
          toast.success("Webhook registrado automaticamente no GitLab ✓");
        }
      }

      setOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar integração GitLab");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGitlabIntegration(deleteTarget.id);
      toast.success("Integração removida");
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao remover integração");
    }
  };

  const kpis = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-card px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 text-foreground">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Integrações GitLab</h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Gerencie integrações GitLab atreladas à sua organização e configure webhooks para sincronização.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={openCreate} className="gap-2" size="lg">
              <Plus className="h-4 w-4" /> Nova integração
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "config" | "events")}>
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="events" disabled={items.length === 0}>Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Total", value: kpis.total, tone: "slate" },
          { label: "Ativas", value: kpis.active, tone: "emerald" },
          { label: "Inativas", value: kpis.inactive, tone: "rose" },
        ].map(({ label, value, tone }) => (
          <Card key={label} className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-semibold text-${tone}-600`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <GitBranch className="h-12 w-12 text-slate-400" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Nenhuma integração GitLab cadastrada</h2>
              <p className="mt-2 text-sm text-muted-foreground">Cadastre uma integração para começar a receber eventos do GitLab no Axionn.</p>
            </div>
            <Button variant="secondary" onClick={openCreate}>Adicionar integração</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-muted/30 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.repositoryPath ?? "—"} • {item.baseUrl}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Badge variant={item.isActive ? "secondary" : "outline"}>
                      {item.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                    {item.syncStatus === "completed" && item.webhookId ? (
                      <Badge className="h-6 gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                        Webhook ativo
                      </Badge>
                    ) : item.syncStatus === "error" ? (
                      <Badge
                        className="h-6 gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 text-[11px] font-semibold text-rose-700"
                        title={item.syncError ?? "Erro no registro do webhook"}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
                        Webhook com erro
                      </Badge>
                    ) : (
                      <Badge className="h-6 gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                        Webhook pendente
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2 text-slate-600" onClick={() => setDeleteTarget(item)}>
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Nota</p>
        <p className="mt-1">
          Tokens e segredos são armazenados de forma cifrada. O webhook é registrado automaticamente no GitLab ao salvar a integração.
        </p>
      </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          {items.length > 1 && (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4">
              <span className="text-sm font-medium text-slate-700">Integração:</span>
              <Select
                value={selectedIntegrationId ?? ""}
                onValueChange={(v) => setSelectedIntegrationId(v)}
              >
                <SelectTrigger className="w-[320px]">
                  <SelectValue placeholder="Selecione uma integração" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <GitlabEventsPanel integrationId={selectedIntegrationId} />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar integração GitLab" : "Nova integração GitLab"}</DialogTitle>
            <DialogDescription>
              Cadastre o repositório GitLab e os dados mínimos para o fluxo de sincronização.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h3 className="text-sm font-semibold text-slate-900">Identificação</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Dados usados para localizar e reconhecer o repositório.</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="gl-name">Nome da integração *</Label>
                <Input id="gl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: GitLab principal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gl-base">URL base *</Label>
                <Input id="gl-base" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://gitlab.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gl-api">API URL</Label>
                <Input id="gl-api" value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} placeholder="https://gitlab.com/api/v4" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gl-path">Repositório (caminho) *</Label>
                <Input id="gl-path" value={form.repositoryPath} onChange={(e) => setForm({ ...form, repositoryPath: e.target.value })} placeholder="grupo/projeto" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gl-repo">Nome do repositório</Label>
                <Input id="gl-repo" value={form.repositoryName} onChange={(e) => setForm({ ...form, repositoryName: e.target.value })} placeholder="nome-do-repositorio" />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Acesso</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Credencial usada para conectar o Axionn ao GitLab.</p>
              </div>
              <div className="space-y-2">
              <Label htmlFor="gl-token">Token de acesso</Label>
              <Input id="gl-token" type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="glpat-..." />
              <p className="text-xs leading-relaxed text-slate-600">
                Use um PAT do GitLab com escopo de API. Ele autentica apenas as chamadas à API; o secret do webhook é separado.
              </p>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Backlog (issues do GitLab)</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Issues criadas no GitLab viram Histórias de Usuário no backlog do time selecionado.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gl-team">Time de destino</Label>
                <Select value={form.teamId} onValueChange={(v) => setForm({ ...form, teamId: v })}>
                  <SelectTrigger id="gl-team">
                    <SelectValue placeholder="Selecione o time que recebe o backlog" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Importar issues como backlog</p>
                    <p className="text-xs text-slate-500">Cria/atualiza HU a partir das issues do projeto.</p>
                  </div>
                  <Switch
                    checked={form.syncIssuesAsBacklog}
                    onCheckedChange={(value) => setForm({ ...form, syncIssuesAsBacklog: value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gl-labels">Mapa de labels → time (JSON, opcional)</Label>
                <Input
                  id="gl-labels"
                  value={form.issueLabelsJson}
                  onChange={(e) => setForm({ ...form, issueLabelsJson: e.target.value })}
                  placeholder='{"time::A":"<team_id>","time::B":"<team_id>"}'
                />
                <p className="text-xs leading-relaxed text-slate-600">
                  Roteia a issue para um time diferente conforme o rótulo. Sem isso, usa o time de destino acima.
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Automação</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">O webhook é configurado automaticamente ao salvar a integração.</p>
              </div>
              <div className="space-y-2">
              <Label>Webhook URL (gerado automaticamente)</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  aria-readonly
                  tabIndex={-1}
                  value="https://rgikyyazotqapaxijwui.supabase.co/functions/v1/git-webhook-handler"
                  className="cursor-default bg-slate-50 font-mono text-xs text-slate-700"
                />
                <Button type="button" variant="outline" size="icon" aria-label="Copiar URL do webhook" onClick={async () => {
                  await navigator.clipboard.writeText("https://rgikyyazotqapaxijwui.supabase.co/functions/v1/git-webhook-handler");
                  toast.success("URL copiada");
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                URL fixa do Axionn. Ao salvar com um token de acesso válido, o webhook é registrado
                automaticamente no GitLab — não é necessário configurar nada manualmente. Se o auto-registro
                falhar, a integração ainda será salva e o botão "Re-registrar webhook" poderá ser usado como fallback.
              </p>
              </div>
            </section>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ativa</p>
                  <p className="text-xs text-slate-500">Habilita o fluxo de sincronização para esta integração.</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(value) => setForm({ ...form, isActive: value })} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {form.id && form.accessToken && (
              <Button type="button" variant="outline" className="gap-2 mr-auto" disabled={saving || registering} onClick={async () => {
                setRegistering(true);
                try {
                  const { error } = await supabase.functions.invoke("gitlab-webhook-register", { body: { integrationId: form.id } });
                  if (error) throw error;
                  toast.success("Webhook re-registrado no GitLab com sucesso ✓");
                  await load();
                } catch {
                  toast.error("Falha ao re-registrar webhook. Verifique o token de acesso.");
                } finally {
                  setRegistering(false);
                }
              }}>
                {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Re-registrar webhook
              </Button>
            )}
            {form.id && form.accessToken && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={saving || syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const { error } = await supabase.functions.invoke("gitlab-issues-sync", {
                      body: { integrationId: form.id },
                    });
                    if (error) throw error;
                    toast.success("Issues existentes sincronizadas para o backlog ✓");
                  } catch {
                    toast.error("Falha ao sincronizar issues. Verifique o token de acesso.");
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizar issues
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar integração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover integração?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} será removida do cadastro da organização ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
