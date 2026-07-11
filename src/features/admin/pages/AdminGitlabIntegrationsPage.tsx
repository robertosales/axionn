import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Loader2, Plus, Pencil, Trash2, GitBranch } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
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
  webhookUrl: string;
  webhookSecret: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: "",
  baseUrl: "https://gitlab.com",
  repositoryPath: "",
  repositoryName: "",
  apiUrl: "https://gitlab.com/api/v4",
  accessToken: "",
  webhookUrl: "",
  webhookSecret: "",
  isActive: true,
};

export function AdminGitlabIntegrationsPage() {
  const { currentOrganizationId } = useOrganization();
  const [items, setItems] = useState<GitlabIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GitlabIntegration | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

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
      webhookUrl: item.webhookUrl ?? "",
      webhookSecret: item.webhookSecret ?? "",
      isActive: item.isActive,
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
      webhookUrl: form.webhookUrl,
      webhookSecret: form.webhookSecret,
      isActive: form.isActive,
    });

    if (!validation.ok) {
      toast.error("Preencha pelo menos nome, URL base e caminho do repositório.");
      return;
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
        webhookUrl: form.webhookUrl,
        webhookSecret: form.webhookSecret,
        isActive: form.isActive,
      });

      if (form.id) {
        await updateGitlabIntegration(form.id, payload);
        toast.success("Integração GitLab atualizada");
      } else {
        await createGitlabIntegration(payload);
        toast.success("Integração GitLab criada");
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Integrações GitLab</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre e gerencie integrações GitLab vinculadas à organização ativa.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova integração
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          ["Total", kpis.total],
          ["Ativas", kpis.active],
          ["Inativas", kpis.inactive],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <GitBranch className="h-9 w-9 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Nenhuma integração GitLab cadastrada</p>
              <p className="text-sm text-muted-foreground">Crie a primeira integração dentro deste tenant.</p>
            </div>
            <Button variant="outline" onClick={openCreate}>Nova integração</Button>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.repositoryPath ?? "—"} · {item.baseUrl}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={item.isActive ? "secondary" : "outline"}>
                    {item.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${item.name}`}
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Tokens e segredos são armazenados de forma cifrada. Configure o webhook no GitLab apontando para a URL informada.
      </div>

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar integração GitLab" : "Nova integração GitLab"}</DialogTitle>
            <DialogDescription>
              Cadastre o repositório GitLab e os dados mínimos para o fluxo de sincronização.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="gl-name">Nome *</Label>
              <Input id="gl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="GitLab principal" />
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
              <Input id="gl-repo" value={form.repositoryName} onChange={(e) => setForm({ ...form, repositoryName: e.target.value })} placeholder="projeto" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="gl-token">Token de acesso</Label>
              <Input id="gl-token" type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="glpat-..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="gl-webhook">Webhook URL</Label>
              <Input id="gl-webhook" value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">
                Opcional. Configure no GitLab para enviar eventos ao Axionn.
              </p>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium">Ativa</p>
                <p className="text-xs text-muted-foreground">Habilita o fluxo de sincronização para esta integração.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(value) => setForm({ ...form, isActive: value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
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
