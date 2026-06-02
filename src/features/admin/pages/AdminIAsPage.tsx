/**
 * AdminIAsPage — Gestao de provedores de IA
 *
 * STYLE GUIDE (alinhado ao UserRolesManager):
 *   Sem Card wrapper — conteudo direto no main (px-4 md:px-6 py-6)
 *   Header: flex justify-between + titulo text-sm font-semibold + botao sm
 *   TableHeader: bg-muted/60 text-[10px] uppercase tracking-wider py-2
 *   Linhas: text-xs py-2 hover:bg-muted/30
 *   Badge ativo:   bg-emerald-100 text-emerald-700 border-emerald-200
 *   Badge inativo: bg-muted text-muted-foreground
 *   Acoes: DropdownMenu unico (substituiu 4 botoes soltos)
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Badge }  from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Loader2, Plus, KeyRound, Trash2, Edit3, Sparkles,
  CheckCircle2, XCircle, Zap, MoreHorizontal, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listAIProviders, createAIProvider, updateAIProvider,
  deleteAIProvider, setAIProviderKey,
  type AIProvider, type ProviderType, PROVIDER_TYPE_LABEL,
} from "../services/aiProviders.service";

const TYPE_OPTIONS: ProviderType[] = ["lovable", "openai", "gemini", "anthropic", "perplexity"];

interface FormState {
  id?:            string;
  name:           string;
  provider_type:  ProviderType;
  model:          string;
  is_recommended: boolean;
  is_active:      boolean;
  apiKey:         string;
}
const EMPTY: FormState = {
  name: "", provider_type: "openai", model: "",
  is_recommended: false, is_active: true, apiKey: "",
};

export function AdminIAsPage() {
  const [items,      setItems]      = useState<AIProvider[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editOpen,   setEditOpen]   = useState(false);
  const [keyOpen,    setKeyOpen]    = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIProvider | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY);
  const [keyTarget,  setKeyTarget]  = useState<AIProvider | null>(null);
  const [keyValue,   setKeyValue]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [testingId,  setTestingId]  = useState<string | null>(null);
  const [testResult, setTestResult] = useState<
    Record<string, { ok: boolean; latencyMs?: number; message: string }>
  >({});

  const load = async () => {
    setLoading(true);
    try   { setItems(await listAIProviders()); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao listar IAs"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // ── Criar / Editar ──
  const openCreate = () => { setForm(EMPTY); setEditOpen(true); };
  const openEdit   = (p: AIProvider) => {
    setForm({
      id: p.id, name: p.name, provider_type: p.provider_type,
      model: p.model ?? "", is_recommended: p.is_recommended,
      is_active: p.is_active, apiKey: "",
    });
    setEditOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      let id = form.id;
      if (id) {
        await updateAIProvider(id, {
          name: form.name.trim(), provider_type: form.provider_type,
          model: form.model.trim() || null,
          is_recommended: form.is_recommended, is_active: form.is_active,
        });
      } else {
        const created = await createAIProvider({
          name: form.name.trim(), provider_type: form.provider_type,
          model: form.model.trim() || null,
          is_recommended: form.is_recommended, is_active: form.is_active,
        });
        id = created.id;
      }
      if (form.apiKey.trim()) await setAIProviderKey(id!, form.apiKey.trim());
      toast.success("Provedor salvo");
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  // ── API Key ──
  const openKey = (p: AIProvider) => { setKeyTarget(p); setKeyValue(""); setKeyOpen(true); };
  const saveKey = async () => {
    if (!keyTarget) return;
    if (!keyValue.trim()) return toast.error("Informe a API key");
    setSaving(true);
    try {
      await setAIProviderKey(keyTarget.id, keyValue.trim());
      toast.success("API key atualizada");
      setKeyOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar key");
    } finally { setSaving(false); }
  };

  // ── Remover (com Dialog de confirmação) ──
  const askDelete = (p: AIProvider) => { setDeleteTarget(p); setDeleteOpen(true); };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteAIProvider(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" removido`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    } finally { setSaving(false); }
  };

  // ── Testar ──
  const testProvider = async (p: AIProvider) => {
    setTestingId(p.id);
    const t0 = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("apf-generate", {
        body: { testMode: true, providerId: p.id },
      });
      const elapsed = Date.now() - t0;
      if (error) {
        const msg = (error as any)?.context?.userMessage ?? error.message ?? "Falha ao testar";
        setTestResult(s => ({ ...s, [p.id]: { ok: false, latencyMs: elapsed, message: msg } }));
        toast.error(`${p.name}: ${msg}`, { duration: 7000 });
        return;
      }
      if (data?.success) {
        const latency = data.latencyMs ?? elapsed;
        setTestResult(s => ({ ...s, [p.id]: { ok: true, latencyMs: latency, message: `OK (${latency}ms)` } }));
        toast.success(`${p.name} respondeu em ${latency}ms`, {
          description: data.sample ? `Resposta: ${String(data.sample).slice(0, 80)}` : undefined,
        });
      } else {
        const msg = data?.userMessage ?? data?.rawError ?? "Falha desconhecida";
        setTestResult(s => ({ ...s, [p.id]: { ok: false, latencyMs: data?.latencyMs ?? elapsed, message: msg } }));
        toast.error(`${p.name}: ${msg}`, {
          description: data?.reason ? `Motivo: ${data.reason}` : undefined,
          duration: 8000,
        });
      }
    } catch (e: any) {
      const msg = e?.message ?? "Erro ao chamar provedor";
      setTestResult(s => ({ ...s, [p.id]: { ok: false, message: msg } }));
      toast.error(`${p.name}: ${msg}`);
    } finally { setTestingId(null); }
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Provedores de IA</h2>
          <span className="text-xs text-muted-foreground">
            ({items.length} provedor{items.length !== 1 ? "es" : ""})
          </span>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo provedor
        </Button>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum provedor cadastrado.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Clique em &ldquo;Novo provedor&rdquo; para adicionar.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Nome</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Tipo</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Modelo</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Status</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Key</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Teste</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">

                  {/* Nome */}
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{p.name}</span>
                      {p.is_recommended && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Recomendado</Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Tipo */}
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {PROVIDER_TYPE_LABEL[p.provider_type]}
                  </TableCell>

                  {/* Modelo */}
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {p.model ?? <span className="text-muted-foreground/50">—</span>}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-2 text-center">
                    {p.is_active ? (
                      <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0 dark:bg-emerald-900/30 dark:text-emerald-400">
                        ● Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                        ● Inativo
                      </Badge>
                    )}
                  </TableCell>

                  {/* Key */}
                  <TableCell className="py-2">
                    {p.has_key ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Configurada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5 shrink-0" /> Não configurada
                      </span>
                    )}
                  </TableCell>

                  {/* Resultado do teste */}
                  <TableCell className="py-2">
                    {testingId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : testResult[p.id] ? (
                      testResult[p.id].ok ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          {testResult[p.id].latencyMs}ms
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-destructive max-w-[160px] truncate"
                          title={testResult[p.id].message}
                        >
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{testResult[p.id].message}</span>
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Ações — DropdownMenu unico */}
                  <TableCell className="py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem
                          className="gap-2 text-xs"
                          onClick={() => testProvider(p)}
                          disabled={testingId === p.id}
                        >
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          Testar provedor
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-xs" onClick={() => openKey(p)}>
                          <KeyRound className="h-3.5 w-3.5" /> Definir API key
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-xs" onClick={() => openEdit(p)}>
                          <Edit3 className="h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-xs text-destructive focus:text-destructive"
                          onClick={() => askDelete(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog — Criar/Editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {form.id ? "Editar provedor" : "Novo provedor de IA"}
            </DialogTitle>
            <DialogDescription>
              A API key é armazenada criptografada e nunca é exposta ao frontend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome de exibição *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: OpenAI (GPT-4o)"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo *</Label>
              <Select
                value={form.provider_type}
                onValueChange={v => setForm({ ...form, provider_type: v as ProviderType })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{PROVIDER_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo padrão (opcional)</Label>
              <Input
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="Ex: gpt-4o-mini, gemini-1.5-flash"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                API Key {form.id ? "(deixe vazio para manter)" : "*"}
              </Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder={
                  form.provider_type === "lovable"
                    ? "Opcional p/ Lovable (usa key interna se vazio)"
                    : "sk-..."
                }
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={v => setForm({ ...form, is_active: v })}
                  className="scale-90"
                />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Switch
                  checked={form.is_recommended}
                  onCheckedChange={v => setForm({ ...form, is_recommended: v })}
                  className="scale-90"
                />
                Recomendado
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Apenas API key */}
      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              API Key — {keyTarget?.name}
            </DialogTitle>
            <DialogDescription>A chave é salva criptografada no cofre seguro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Nova API key</Label>
            <Input
              type="password"
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              placeholder="sk-..."
              className="h-8 text-xs"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setKeyOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveKey} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Salvar key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Confirmar remocao */}
      <Dialog
        open={deleteOpen}
        onOpenChange={v => { if (!v && !saving) { setDeleteOpen(false); setDeleteTarget(null); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Remover provedor
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o provedor{" "}
              <strong className="text-foreground">{deleteTarget?.name}</strong>?
              {" "}Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost" size="sm"
              onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={saving}>
              {saving
                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
