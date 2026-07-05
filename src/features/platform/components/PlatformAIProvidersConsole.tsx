import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  TestTube2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAIProvider,
  deleteAIProvider,
  listAIProviders,
  REQUEST_FORMAT_OPTIONS,
  setAIProviderKey,
  updateAIProvider,
  type AIProvider,
} from "@/features/admin/services/aiProviders.service";

type RequestFormat = "openai_compatible" | "gemini" | "anthropic";

interface ProviderForm {
  id?: string;
  name: string;
  providerType: string;
  model: string;
  apiBaseUrl: string;
  requestFormat: RequestFormat;
  recommended: boolean;
  active: boolean;
  secret: string;
}

const EMPTY_FORM: ProviderForm = {
  name: "",
  providerType: "",
  model: "",
  apiBaseUrl: "",
  requestFormat: "openai_compatible",
  recommended: false,
  active: true,
  secret: "",
};

interface ProviderTestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

function toForm(provider: AIProvider): ProviderForm {
  return {
    id: provider.id,
    name: provider.name,
    providerType: provider.provider_type,
    model: provider.model ?? "",
    apiBaseUrl: provider.api_base_url ?? "",
    requestFormat: provider.request_format ?? "openai_compatible",
    recommended: provider.is_recommended,
    active: provider.is_active,
    secret: "",
  };
}

export function PlatformAIProvidersConsole() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ProviderTestResult>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [secretTarget, setSecretTarget] = useState<AIProvider | null>(null);
  const [secretValue, setSecretValue] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<AIProvider | null>(null);

  const activeCount = useMemo(
    () => providers.filter((provider) => provider.is_active).length,
    [providers],
  );

  const load = async () => {
    setLoading(true);
    try {
      setProviders(await listAIProviders());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao listar provedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (provider: AIProvider) => {
    setForm(toForm(provider));
    setFormOpen(true);
  };

  const saveProvider = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    if (!form.providerType.trim()) return toast.error("Identificador é obrigatório");
    if (!form.apiBaseUrl.trim()) return toast.error("URL da API é obrigatória");
    if (!/^https:\/\//i.test(form.apiBaseUrl.trim())) {
      return toast.error("A URL da API deve usar HTTPS");
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        provider_type: form.providerType.trim().toLowerCase(),
        model: form.model.trim() || null,
        api_base_url: form.apiBaseUrl.trim(),
        request_format: form.requestFormat,
        is_recommended: form.recommended,
        is_active: form.active,
      };

      const provider = form.id
        ? (await updateAIProvider(form.id, payload), { id: form.id })
        : await createAIProvider(payload);

      if (form.secret.trim()) {
        await setAIProviderKey(provider.id, form.secret.trim());
      }

      toast.success(form.id ? "Provedor atualizado" : "Provedor criado");
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar provedor");
    } finally {
      setSaving(false);
    }
  };

  const saveSecret = async () => {
    if (!secretTarget || !secretValue.trim()) return;
    setSaving(true);
    try {
      await setAIProviderKey(secretTarget.id, secretValue.trim());
      toast.success("Credencial atualizada");
      setSecretTarget(null);
      setSecretValue("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar credencial");
    } finally {
      setSaving(false);
    }
  };

  const archiveProvider = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await deleteAIProvider(archiveTarget.id);
      toast.success("Provedor arquivado");
      setArchiveTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao arquivar provedor");
    } finally {
      setSaving(false);
    }
  };

  const testProvider = async (provider: AIProvider) => {
    setTestingId(provider.id);
    const startedAt = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke(
        "platform-ai-provider-test",
        { body: { providerId: provider.id } },
      );
      const elapsed = Date.now() - startedAt;

      if (error) {
        const message = error.message || "Falha ao testar o provedor";
        setResults((current) => ({
          ...current,
          [provider.id]: { ok: false, message, latencyMs: elapsed },
        }));
        toast.error(`${provider.name}: ${message}`);
        return;
      }

      if (data?.success) {
        const latencyMs = Number(data.latencyMs ?? elapsed);
        setResults((current) => ({
          ...current,
          [provider.id]: { ok: true, message: "Operacional", latencyMs },
        }));
        toast.success(`${provider.name} respondeu em ${latencyMs} ms`);
        return;
      }

      const message = String(data?.userMessage ?? "Falha ao testar o provedor");
      setResults((current) => ({
        ...current,
        [provider.id]: {
          ok: false,
          message,
          latencyMs: Number(data?.latencyMs ?? elapsed),
        },
      }));
      toast.error(`${provider.name}: ${message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao testar o provedor";
      setResults((current) => ({
        ...current,
        [provider.id]: { ok: false, message },
      }));
      toast.error(`${provider.name}: ${message}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Catálogo global de IA</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {providers.length} cadastrado(s), {activeCount} ativo(s). Credenciais nunca são retornadas ao navegador.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo provedor
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : providers.length === 0 ? (
          <div className="py-16 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Nenhum provedor cadastrado</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Cadastrar primeiro provedor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provedor</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credencial</TableHead>
                <TableHead>Teste</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => {
                const result = results[provider.id];
                return (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-xs text-muted-foreground">{provider.provider_type}</div>
                    </TableCell>
                    <TableCell className="text-sm">{provider.request_format ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm">{provider.model ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Badge variant={provider.is_active ? "secondary" : "outline"}>
                          {provider.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        {provider.is_recommended && <Badge>Recomendado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {provider.has_key ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> Configurada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <XCircle className="h-4 w-4" /> Ausente
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {testingId === provider.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : result ? (
                        <span
                          className={result.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}
                          title={result.message}
                        >
                          {result.ok ? `${result.latencyMs} ms` : result.message}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Não testado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void testProvider(provider)}>
                            <TestTube2 className="mr-2 h-4 w-4" /> Testar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(provider)}>
                            <Edit3 className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSecretTarget(provider);
                              setSecretValue("");
                            }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" /> Atualizar credencial
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setArchiveTarget(provider)}
                          >
                            <AlertTriangle className="mr-2 h-4 w-4" /> Arquivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar provedor" : "Novo provedor"}</DialogTitle>
            <DialogDescription>
              Metadados globais. A credencial é enviada somente ao backend seguro.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Identificador *</Label>
              <Input value={form.providerType} disabled={Boolean(form.id)} onChange={(event) => setForm((current) => ({ ...current, providerType: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Formato *</Label>
              <Select value={form.requestFormat} onValueChange={(value) => setForm((current) => ({ ...current, requestFormat: value as RequestFormat }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>URL HTTPS *</Label>
              <Input value={form.apiBaseUrl} onChange={(event) => setForm((current) => ({ ...current, apiBaseUrl: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Modelo</Label>
              <Input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Nova credencial {form.id ? "(opcional)" : ""}</Label>
              <Input type="password" value={form.secret} autoComplete="new-password" onChange={(event) => setForm((current) => ({ ...current, secret: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(active) => setForm((current) => ({ ...current, active }))} /> Ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.recommended} onCheckedChange={(recommended) => setForm((current) => ({ ...current, recommended }))} /> Recomendado
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveProvider()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(secretTarget)} onOpenChange={(open) => !open && setSecretTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar credencial</DialogTitle>
            <DialogDescription>
              O valor será enviado ao backend e não poderá ser consultado depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nova credencial para {secretTarget?.name}</Label>
            <Input type="password" autoComplete="new-password" value={secretValue} onChange={(event) => setSecretValue(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSecretTarget(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveSecret()} disabled={saving || !secretValue.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar provedor?</DialogTitle>
            <DialogDescription>
              {archiveTarget?.name} ficará inativo e não será usado em novas solicitações.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={saving}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void archiveProvider()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Arquivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
