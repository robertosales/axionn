import { useMemo, useState } from "react";
import { Archive, ClipboardCheck, FilterX, Plus, Search, ShieldAlert } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { TestCaseFormDialog } from "../components/TestCaseFormDialog";
import { QualityPageSkeleton } from "../components/QualityPageSkeleton";
import { QualitySectionHeader } from "../components/QualitySectionHeader";
import { useArchiveTestCase, useTestCases } from "../hooks/useTestCases";
import { useQualityPermissions } from "../hooks/useQualityPermissions";
import { qualityLabel, qualityStatusTone } from "../utils/qualityLabels";

const ALL = "all";

export default function TestCasesPage() {
  const { currentOrganizationId } = useOrganization();
  const { can } = useQualityPermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [severity, setSeverity] = useState(ALL);
  const [testType, setTestType] = useState(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; code: string; title: string }>();
  const query = useTestCases(currentOrganizationId, search);
  const archive = useArchiveTestCase(currentOrganizationId ?? "");
  const canManage = can.manageTestCases;

  const filtered = useMemo(() => (query.data ?? []).filter(item =>
    (status === ALL || item.status === status) &&
    (severity === ALL || item.severity === severity) &&
    (testType === ALL || item.test_type === testType),
  ), [query.data, severity, status, testType]);
  const filtersActive = status !== ALL || severity !== ALL || testType !== ALL;

  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  if (!currentOrganizationId) return <div className="p-8 text-center text-muted-foreground">Selecione uma organização.</div>;

  const resetFilters = () => { setStatus(ALL); setSeverity(ALL); setTestType(ALL); };
  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archive.mutateAsync(archiveTarget.id);
      toast.success(`${archiveTarget.code} foi arquivado.`);
      setArchiveTarget(undefined);
    } catch {
      toast.error("Não foi possível arquivar o caso.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 pb-8 pt-5 md:px-8 md:pt-6">
      <QualitySectionHeader icon={ClipboardCheck} title="Casos de Teste" count={query.data?.length ?? 0} action={canManage ? <Button size="sm" className="gap-1.5" onClick={() => { setEditing(undefined); setOpen(true); }}><Plus className="h-4 w-4" />Novo caso</Button> : undefined} />

      <section className="rounded-2xl border bg-card p-4 shadow-sm" aria-label="Filtros da biblioteca">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="min-h-11 pl-9" aria-label="Buscar casos" placeholder="Buscar por código ou título…" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="min-h-11" aria-label="Filtrar por status"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos os status</SelectItem>{["draft", "ready", "approved", "deprecated"].map(value => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select>
          <Select value={severity} onValueChange={setSeverity}><SelectTrigger className="min-h-11" aria-label="Filtrar por severidade"><SelectValue placeholder="Severidade" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todas as severidades</SelectItem>{["low", "medium", "high", "critical"].map(value => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select>
          <Select value={testType} onValueChange={setTestType}><SelectTrigger className="min-h-11" aria-label="Filtrar por tipo"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos os tipos</SelectItem>{["functional", "regression", "integration", "api", "security", "accessibility", "uat", "other"].map(value => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select>
          <Button variant="ghost" className="min-h-11" disabled={!filtersActive} onClick={resetFilters}><FilterX className="mr-2 h-4 w-4" />Limpar</Button>
        </div>
        {!query.isLoading && <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">{filtered.length} de {query.data?.length ?? 0} caso(s) exibido(s)</p>}
      </section>

      {query.isLoading ? <QualityPageSkeleton rows={6} /> : query.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-destructive" /><p className="mt-3 font-medium">Não foi possível carregar os casos</p><p className="mt-1 text-sm text-muted-foreground">Atualize a página ou tente novamente em alguns instantes.</p></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center"><ClipboardCheck className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-medium">Nenhum caso corresponde aos filtros</p><p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou limpe os filtros aplicados.</p>{filtersActive && <Button variant="outline" className="mt-4" onClick={resetFilters}>Limpar filtros</Button>}</div>
      ) : (
        <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Título</TableHead><TableHead>Tipo</TableHead><TableHead>Risco</TableHead><TableHead>Status</TableHead><TableHead>Versão</TableHead><TableHead className="w-20"><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader><TableBody>{filtered.map(item => <TableRow key={item.id} className="cursor-pointer" tabIndex={0} onClick={() => { setEditing(item.id); setOpen(true); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setEditing(item.id); setOpen(true); } }}><TableCell className="font-mono text-xs font-semibold text-primary">{item.code}</TableCell><TableCell className="min-w-64 font-medium">{item.title}</TableCell><TableCell>{qualityLabel(item.test_type)}</TableCell><TableCell><Badge variant={qualityStatusTone(item.severity)}>{qualityLabel(item.severity)}</Badge></TableCell><TableCell><Badge variant={qualityStatusTone(item.status)}>{qualityLabel(item.status)}</Badge></TableCell><TableCell className="tabular-nums">v{item.current_version}</TableCell><TableCell>{canManage && <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Arquivar ${item.code}`} onClick={event => { event.stopPropagation(); setArchiveTarget({ id: item.id, code: item.code, title: item.title }); }}><Archive className="h-4 w-4" /></Button>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}

      {canManage && <TestCaseFormDialog organizationId={currentOrganizationId} caseId={editing} open={open} onOpenChange={setOpen} />}
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={value => !value && setArchiveTarget(undefined)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Arquivar {archiveTarget?.code}?</AlertDialogTitle><AlertDialogDescription>“{archiveTarget?.title}” deixará de aparecer na biblioteca ativa. O histórico e as execuções existentes serão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmArchive} disabled={archive.isPending}>Arquivar caso</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}
