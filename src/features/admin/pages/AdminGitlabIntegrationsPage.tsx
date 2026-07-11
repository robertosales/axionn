import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Edit3, Trash2, GitBranch } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { PageHeader } from "../components/PageHeader";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  const askDelete = (item: GitlabIntegration) => {
    setDeleteTarget(item);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGitlabIntegration(deleteTarget.id);
      toast.success("Integração removida");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao remover integração");
    }
  };

  const emptyState = useMemo(() => items.length === 0, [items.length]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={GitBranch}
        iconColor="text-sky-400"
        description="Cadastre e gerencie integrações GitLab por organização"
        actions={[{ label: "Nova integração", icon: Plus, onClick: openCreate }]}
      />

      {loading ? (
        <Card className="rounded-xl p-10">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : emptyState ? (
        <Card className="rounded-xl border-dashed border-2 border-muted-foreground/20 p-12 text-center">
          <GitBranch className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Nenhuma integração GitLab cadastrada.</p>
        </Card>
      ) : (
        <Card className="rounded-xl border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Repositório</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.baseUrl}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.repositoryPath ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{item.repositoryName ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Ativa</Badge>
                      ) : (
                        <Badge variant="outline">Inativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        <Edit3 className="mr-1 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => askDelete(item)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar integração GitLab" : "Nova integração GitLab"}</DialogTitle>
            <DialogDescription>Cadastre o repositório GitLab e os dados mínimos para o fluxo de sincronização.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="GitLab principal" />
            </div>
            <div className="grid gap-2">
              <Label>URL base</Label>
              <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://gitlab.com" />
            </div>
            <div className="grid gap-2">
              <Label>Repositório (caminho)</Label>
              <Input value={form.repositoryPath} onChange={(e) => setForm({ ...form, repositoryPath: e.target.value })} placeholder="grupo/projeto" />
            </div>
            <div className="grid gap-2">
              <Label>Nome do repositório</Label>
              <Input value={form.repositoryName} onChange={(e) => setForm({ ...form, repositoryName: e.target.value })} placeholder="projeto" />
            </div>
            <div className="grid gap-2">
              <Label>API URL</Label>
              <Input value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} placeholder="https://gitlab.com/api/v4" />
            </div>
            <div className="grid gap-2">
              <Label>Token de acesso</Label>
              <Input value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="token" type="password" />
            </div>
            <div className="grid gap-2">
              <Label>Webhook URL</Label>
              <Input value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">Opcional agora. Use quando estiver configurando o webhook no GitLab para enviar eventos ao Axionn.</p>
            </div>
            <div className="rounded-xl border border-muted-foreground/10 bg-muted/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Ativa</div>
                  <p className="text-xs text-muted-foreground">Habilita o fluxo de sincronização para esta integração.</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(value) => setForm({ ...form, isActive: value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover integração?</DialogTitle>
            <DialogDescription>Esta ação remove a integração GitLab do cadastro atual.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
