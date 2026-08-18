import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronRight, FileCheck2, FileSearch, FolderKanban, Loader2, Plus } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useApfEvidenceDossiers } from "../../hooks/useApfEvidenceDossiers";
import { APF_DOSSIER_STATUS_LABELS, type ApfDossierStatus } from "../../types/apfEvidenceDossier.types";
import { CreateApfDossierDialog } from "./CreateApfDossierDialog";
import { ApfDossierSpecification } from "./ApfDossierSpecification";
import { ApfMeasurementBatches } from "./ApfMeasurementBatches";
import { ApfGovernanceDashboard } from "./ApfGovernanceDashboard";

const FLOW = ["Visão geral", "Especificação", "Evidências", "Rastreabilidade", "Contagem", "Auditoria", "Documento"];
const statusVariant: Record<ApfDossierStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", collecting_evidence: "secondary", under_review: "secondary", validated: "default",
  homologated: "default", superseded: "outline", cancelled: "destructive",
};

export function ApfDossierWorkspace() {
  const { currentOrganizationId } = useOrganization();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const { data: dossiers = [], isLoading, isError, refetch } = useApfEvidenceDossiers(currentOrganizationId);
  const homologated = dossiers.filter((item) => item.status === "homologated").length;
  const active = dossiers.filter((item) => !["homologated", "superseded", "cancelled"].includes(item.status)).length;
  const readiness = dossiers.length === 0 ? 0 : Math.round((homologated / dossiers.length) * 100);
  const selectedDossier = dossiers.find((dossier) => dossier.id === selectedDossierId) ?? null;

  if (selectedDossier) {
    return <ApfDossierSpecification dossier={selectedDossier} onBack={() => setSelectedDossierId(null)} onSuccessorCreated={async () => { setSelectedDossierId(null); await refetch(); }} />;
  }

  return <section className="space-y-4" aria-labelledby="apf-dossier-title">
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <CardTitle id="apf-dossier-title" className="flex items-center gap-2 text-lg"><FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />Dossiê APF por Impacto</CardTitle>
          <CardDescription>Evidências, rastreabilidade e memória de cálculo reproduzível por HU.</CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!currentOrganizationId}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Novo dossiê</Button>
      </CardHeader>
      <CardContent><ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" aria-label="Etapas do dossiê">
        {FLOW.map((step, index) => <li key={step} className="rounded-md border bg-background/80 px-3 py-2 text-xs font-medium"><span className="mr-1.5 text-muted-foreground">{index + 1}.</span>{step}</li>)}
      </ol></CardContent>
    </Card>

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={FolderKanban} label="Dossiês ativos" value={active} />
      <Metric icon={CheckCircle2} label="Homologados" value={homologated} />
      <Card><CardContent className="space-y-2 p-4"><div className="flex items-center justify-between text-xs font-medium"><span>Prontidão global</span><span>{readiness}%</span></div><Progress value={readiness} aria-label={`Prontidão global: ${readiness}%`} /></CardContent></Card>
    </div>
    {currentOrganizationId && <ApfGovernanceDashboard organizationId={currentOrganizationId} />}
    {currentOrganizationId && <ApfMeasurementBatches organizationId={currentOrganizationId} dossiers={dossiers} />}

    {isLoading ? <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Carregando dossiês…</div>
      : isError ? <Card role="alert" className="border-destructive/30"><CardContent className="flex items-center justify-between gap-4 p-5"><p className="text-sm text-destructive">Não foi possível carregar os dossiês desta organização.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button></CardContent></Card>
      : dossiers.length === 0 ? <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center"><FileSearch className="h-9 w-9 text-muted-foreground" aria-hidden="true" /><div><p className="font-semibold">Nenhum dossiê nesta organização</p><p className="mt-1 text-sm text-muted-foreground">A fundação está pronta para receber a primeira HU e suas evidências.</p></div></CardContent></Card>
      : <div className="space-y-2" aria-live="polite">{dossiers.map((dossier) => <Card key={dossier.id} className="transition-shadow motion-reduce:transition-none hover:shadow-sm"><CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{dossier.dossierCode}</span><Badge variant={statusVariant[dossier.status]}>{APF_DOSSIER_STATUS_LABELS[dossier.status]}</Badge></div><h3 className="mt-1 truncate font-semibold">{dossier.title}</h3><p className="mt-1 text-xs text-muted-foreground">{dossier.userStory ? `${dossier.userStory.code} · ${dossier.userStory.title}` : "HU não vinculada"}{` · Atualizado ${format(new Date(dossier.updatedAt), "dd MMM yyyy", { locale: ptBR })}`}</p></div>
        <div className="flex items-center justify-between gap-4 md:justify-end"><div className="text-right"><p className="text-lg font-semibold tabular-nums">{dossier.totalImpactedPf.toLocaleString("pt-BR")} PF</p><p className="text-[11px] text-muted-foreground">impactado</p></div><Button variant="ghost" size="icon" aria-label={`Abrir dossiê ${dossier.dossierCode}`} onClick={() => setSelectedDossierId(dossier.id)}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></div>
      </CardContent></Card>)}</div>}
    {currentOrganizationId && <CreateApfDossierDialog open={createOpen} onOpenChange={setCreateOpen} organizationId={currentOrganizationId} onCreated={refetch} />}
  </section>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof FolderKanban; label: string; value: number }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}
import { useState } from "react";
