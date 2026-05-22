import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, KeyRound, Trash2, Edit3, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import {
  listAIProviders, createAIProvider, updateAIProvider, deleteAIProvider, setAIProviderKey,
  type AIProvider, type ProviderType, PROVIDER_TYPE_LABEL,
} from "../services/aiProviders.service";

const TYPE_OPTIONS: ProviderType[] = ["lovable", "openai", "gemini", "anthropic", "perplexity"];

interface FormState {
  id?: string;
  name: string;
  provider_type: ProviderType;
  model: string;
  is_recommended: boolean;
  is_active: boolean;
  apiKey: string;
}
const EMPTY: FormState = {
  name: "", provider_type: "openai", model: "", is_recommended: false, is_active: true, apiKey: "",
};

export function AdminIAsPage() {
  const [items, setItems] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [keyTarget, setKeyTarget] = useState<AIProvider | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await listAIProviders()); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao listar IAs"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditOpen(true); };
  const openEdit = (p: AIProvider) => {
    setForm({
      id: p.id, name: p.name, provider_type: p.provider_type,
      model: p.model ?? "", is_recommended: p.is_recommended, is_active: p.is_active, apiKey: "",
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
          model: form.model.trim() || null, is_recommended: form.is_recommended, is_active: form.is_active,
        });
      } else {
        const created = await createAIProvider({
          name: form.name.trim(), provider_type: form.provider_type,
          model: form.model.trim() || null, is_recommended: form.is_recommended, is_active: form.is_active,
        });
        id = created.id;
      }
      if (form.apiKey.trim()) {
        await setAIProviderKey(id!, form.apiKey.trim());
      }
      toast.success("Provedor salvo");
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

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

  const remove = async (p: AIProvider) => {
    if (!confirm(`Remover o provedor "${p.name}"?`)) return;
    try { await deleteAIProvider(p.id); toast.success("Removido"); await load(); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao remover"); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Provedores de IA
        </CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1" /> Novo provedor</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Nenhum provedor cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Modelo</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Key</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.is_recommended && <Badge variant="secondary" className="text-[10px]">Recomendado</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{PROVIDER_TYPE_LABEL[p.provider_type]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.model ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {p.is_active
                      ? <Badge className="bg-green-600/20 text-green-600 border-green-600/30 text-[10px]">Ativo</Badge>
                      : <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.has_key
                      ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Configurada</span>
                      : <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="h-3.5 w-3.5" /> Não configurada</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openKey(p)} title="Definir API key">
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Editar">
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p)} title="Remover">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Dialog criar/editar */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar provedor" : "Novo provedor de IA"}</DialogTitle>
              <DialogDescription>
                A API key é armazenada criptografada e nunca é exposta ao frontend.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome de exibição *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: OpenAI (GPT-4o)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select value={form.provider_type} onValueChange={(v) => setForm({ ...form, provider_type: v as ProviderType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{PROVIDER_TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo padrão (opcional)</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Ex: gpt-4o-mini, gemini-1.5-flash" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> API Key {form.id ? "(deixe vazio para manter)" : "*"}
                </Label>
                <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder={form.provider_type === "lovable" ? "Opcional p/ Lovable (usa key interna se vazio)" : "sk-..."} />
              </div>
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Ativo
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Switch checked={form.is_recommended} onCheckedChange={(v) => setForm({ ...form, is_recommended: v })} /> Recomendado
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog apenas key */}
        <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir API key — {keyTarget?.name}</DialogTitle>
              <DialogDescription>A chave é salva criptografada no cofre seguro.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs">Nova API key</Label>
              <Input type="password" value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="sk-..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setKeyOpen(false)}>Cancelar</Button>
              <Button onClick={saveKey} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Salvar key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
