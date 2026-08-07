import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FolderTree, LockKeyhole, Plus, Search, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { QualityPageSkeleton } from "../components/QualityPageSkeleton";
import { useTestCases } from "../hooks/useTestCases";
import { useQualityPermissions } from "../hooks/useQualityPermissions";
import { qualityLabel, qualityStatusTone } from "../utils/qualityLabels";

type SuiteRow = { id: string; name: string; description: string | null; parent_suite_id: string | null; sort_order: number };
type SuiteItem = { id: string; suite_id: string; test_case_id: string; sort_order: number };

export default function TestSuitesPage() {
  const { currentOrganizationId } = useOrganization();
  const { can } = useQualityPermissions();
  const client = useQueryClient();
  const cases = useTestCases(currentOrganizationId, "");
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("root");
  const [caseId, setCaseId] = useState("");

  const suites = useQuery({
    queryKey: ["quality", currentOrganizationId, "suites"],
    enabled: Boolean(currentOrganizationId) && QUALITY_MANAGEMENT_ENABLED,
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_test_suites").select("id,name,description,parent_suite_id,sort_order").eq("organization_id", currentOrganizationId!).order("sort_order");
      if (error) throw error;
      return (data ?? []) as SuiteRow[];
    },
  });
  const items = useQuery({
    queryKey: ["quality", currentOrganizationId, "suite-items"],
    enabled: Boolean(currentOrganizationId) && QUALITY_MANAGEMENT_ENABLED,
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_test_suite_items").select("id,suite_id,test_case_id,sort_order").eq("organization_id", currentOrganizationId!).order("sort_order");
      if (error) throw error;
      return (data ?? []) as SuiteItem[];
    },
  });
  const refresh = async () => Promise.all([
    client.invalidateQueries({ queryKey: ["quality", currentOrganizationId, "suites"] }),
    client.invalidateQueries({ queryKey: ["quality", currentOrganizationId, "suite-items"] }),
    client.invalidateQueries({ queryKey: ["quality", currentOrganizationId, "overview"] }),
  ]);
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_quality_test_suite_v1", { p_org_id: currentOrganizationId!, p_name: name.trim(), p_description: description.trim() || null, p_parent_suite_id: parentId === "root" ? null : parentId });
      if (error) throw error;
      return String(data);
    },
    onSuccess: async id => { await refresh(); setSelectedId(id); setCreateOpen(false); setName(""); setDescription(""); setParentId("root"); toast.success("Suíte criada e protegida contra edição e exclusão."); },
  });
  const addItem = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("add_quality_test_suite_item_v1", { p_org_id: currentOrganizationId!, p_suite_id: selectedId!, p_case_id: caseId }); if (error) throw error; },
    onSuccess: async () => { await refresh(); setCaseId(""); toast.success("Caso adicionado à suíte."); },
  });
  const removeItem = useMutation({
    mutationFn: async (targetCaseId: string) => { const { error } = await supabase.rpc("remove_quality_test_suite_item_v1", { p_org_id: currentOrganizationId!, p_suite_id: selectedId!, p_case_id: targetCaseId }); if (error) throw error; },
    onSuccess: async () => { await refresh(); toast.success("Caso retirado da suíte; o caso original foi preservado."); },
  });

  const filteredSuites = useMemo(() => (suites.data ?? []).filter(suite => suite.name.toLowerCase().includes(search.toLowerCase())), [search, suites.data]);
  const selected = suites.data?.find(suite => suite.id === selectedId) ?? filteredSuites[0];
  const selectedItems = (items.data ?? []).filter(item => item.suite_id === selected?.id);
  const selectedCases = selectedItems.map(item => ({ item, testCase: cases.data?.find(testCase => testCase.id === item.test_case_id) }));
  const availableCases = (cases.data ?? []).filter(testCase => !selectedItems.some(item => item.test_case_id === testCase.id));
  const childCount = (id: string) => suites.data?.filter(suite => suite.parent_suite_id === id).length ?? 0;
  const depth = (suite: SuiteRow) => suite.parent_suite_id ? 1 : 0;

  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  if (!currentOrganizationId) return <div className="p-8 text-center text-muted-foreground">Selecione uma organização.</div>;

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 pb-8 pt-5 md:px-8 md:pt-6">
      <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between"><div><p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><FolderTree className="h-4 w-4" />Organização imutável</p><h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">Suítes de teste</h1><p className="mt-1 text-sm text-muted-foreground">Agrupe casos por fluxo ou objetivo sem alterar a identidade da suíte.</p></div>{can.manageTestSuites && <Button className="min-h-11" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova suíte</Button>}</header>

      {suites.isLoading || items.isLoading || cases.isLoading ? <QualityPageSkeleton rows={5} /> : suites.isError || items.isError || cases.isError ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive">Não foi possível carregar a estrutura de suítes.</div> : suites.data?.length ? (
        <div className="grid min-h-[560px] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-2xl border bg-card p-3 shadow-sm"><div className="relative mb-3"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="min-h-11 pl-9" aria-label="Buscar suítes" placeholder="Buscar suíte…" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="space-y-1" role="list">{filteredSuites.map(suite => { const count = items.data?.filter(item => item.suite_id === suite.id).length ?? 0; const active = selected?.id === suite.id; return <button type="button" role="listitem" key={suite.id} onClick={() => setSelectedId(suite.id)} className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} style={{ paddingLeft: `${12 + depth(suite) * 18}px` }}><ChevronRight className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate font-medium">{suite.name}</span><span className={active ? "text-primary-foreground/75" : "text-muted-foreground"}>{count}</span></button>; })}</div></aside>

          {selected && <Card className="overflow-hidden"><CardHeader className="border-b bg-muted/20"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><CardTitle>{selected.name}</CardTitle><Badge variant="outline"><LockKeyhole className="mr-1 h-3 w-3" />Imutável</Badge></div><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{selected.description || "Sem descrição informada."}</p></div><div className="flex gap-2"><Badge variant="secondary">{selectedItems.length} caso(s)</Badge>{childCount(selected.id) > 0 && <Badge variant="outline">{childCount(selected.id)} subsuíte(s)</Badge>}</div></div></CardHeader><CardContent className="space-y-5 p-5">
            {can.manageTestSuites && <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row"><Select value={caseId} onValueChange={setCaseId}><SelectTrigger className="min-h-11 flex-1"><SelectValue placeholder="Selecione um caso para adicionar" /></SelectTrigger><SelectContent>{availableCases.map(testCase => <SelectItem key={testCase.id} value={testCase.id}>{testCase.code} — {testCase.title}</SelectItem>)}</SelectContent></Select><Button className="min-h-11" disabled={!caseId || addItem.isPending} onClick={() => addItem.mutate()}><Plus className="mr-2 h-4 w-4" />Adicionar caso</Button></div>}
            {selectedCases.length ? <div className="space-y-2">{selectedCases.map(({ item, testCase }, index) => <div key={item.id} className="flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium"><span className="mr-2 font-mono text-xs text-primary">{testCase?.code ?? "Caso"}</span>{testCase?.title ?? item.test_case_id}</p><div className="mt-1 flex gap-2">{testCase && <><Badge variant={qualityStatusTone(testCase.status)}>{qualityLabel(testCase.status)}</Badge><span className="text-xs text-muted-foreground">v{testCase.current_version}</span></>}</div></div>{can.manageTestSuites && <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Retirar ${testCase?.code ?? "caso"} da suíte`} disabled={removeItem.isPending} onClick={() => removeItem.mutate(item.test_case_id)}><Trash2 className="h-4 w-4" /></Button>}</div>)}</div> : <div className="rounded-xl border border-dashed p-10 text-center"><FolderTree className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-medium">Suíte vazia</p><p className="mt-1 text-sm text-muted-foreground">Adicione casos existentes sem duplicá-los.</p></div>}
          </CardContent></Card>}
        </div>
      ) : <div className="rounded-xl border border-dashed p-12 text-center"><FolderTree className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-medium">Nenhuma suíte criada</p><p className="mt-1 text-sm text-muted-foreground">Crie uma estrutura estável para organizar a biblioteca.</p></div>}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Nova suíte imutável</DialogTitle><DialogDescription>Após a criação, nome, descrição e hierarquia não poderão ser editados ou excluídos. Apenas a composição de casos poderá mudar.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="suite-name">Nome *</Label><Input id="suite-name" maxLength={200} value={name} onChange={event => setName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="suite-description">Descrição</Label><Textarea id="suite-description" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} /></div><div className="space-y-2"><Label>Suíte superior</Label><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">Raiz da biblioteca</SelectItem>{suites.data?.map(suite => <SelectItem key={suite.id} value={suite.id}>{suite.name}</SelectItem>)}</SelectContent></Select></div><div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><span>Esta política protege referências históricas e evita que planos percam seu contexto organizacional.</span></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Criando…" : "Criar suíte"}</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}
