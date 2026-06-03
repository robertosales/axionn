import { useState } from "react";
import {
  FileText, CheckCircle2, PauseCircle,
  AlertTriangle, LayoutGrid, Plus, Pencil, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContractWizardDialog } from "../components/ContractWizardDialog";
import { useContracts, type Contract, type ContractFormData } from "../hooks/useContracts";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:    { label: "Ativo",     variant: "default"     },
  paused:    { label: "Pausado",   variant: "secondary"   },
  expired:   { label: "Expirado",  variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline"     },
};

export function AdminContratosPage() {
  const { contracts, loading, kpis, create, update, remove, loadFormData } = useContracts();

  const [wizardOpen,   setWizardOpen]   = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingData,  setEditingData]  = useState<ContractFormData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [loadingEdit,  setLoadingEdit]  = useState(false);

  const handleNew = () => {
    setEditingId(null);
    setEditingData(null);
    setWizardOpen(true);
  };

  const handleEdit = async (contract: Contract) => {
    setLoadingEdit(true);
    const data = await loadFormData(contract.id);
    setEditingId(contract.id);
    setEditingData(data);
    setLoadingEdit(false);
    setWizardOpen(true);
  };

  const handleSave = async (data: ContractFormData): Promise<boolean> => {
    if (editingId) return update(editingId, data);
    return create(data);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Contratos</h2>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Carregando..."
              : `${kpis.total} contrato${kpis.total !== 1 ? "s" : ""} cadastrado${kpis.total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleNew}>
          <Plus className="h-4 w-4" /> Novo Contrato
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <CheckCircle2 className="h-4 w-4" />, label: "Ativos",     value: kpis.active   },
          { icon: <PauseCircle  className="h-4 w-4" />, label: "Pausados",   value: kpis.paused   },
          { icon: <AlertTriangle className="h-4 w-4" />, label: "Alertas SLA", value: kpis.critical },
          { icon: <LayoutGrid   className="h-4 w-4" />, label: "Total",      value: kpis.total    },
        ].map(({ icon, label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              {icon}
              <span>{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Contratos</span>
          <Badge variant="secondary" className="text-xs">{kpis.total}</Badge>
        </div>

        {loading ? (
          <Skeleton className="h-48 w-full rounded-b-lg" />
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum contrato cadastrado.</p>
            <Button size="sm" variant="outline" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeiro contrato
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {contracts.map(contract => {
              const meta = STATUS_META[contract.status] ?? STATUS_META.cancelled;
              return (
                <div
                  key={contract.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{contract.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {contract.start_date && (
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(contract.start_date).toLocaleDateString("pt-BR")} –{" "}
                            {contract.end_date
                              ? new Date(contract.end_date).toLocaleDateString("pt-BR")
                              : "sem fim"}
                          </span>
                        )}
                        {(contract.projectCount ?? 0) > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            · {contract.projectCount} projeto{contract.projectCount! > 1 ? "s" : ""}
                          </span>
                        )}
                        {(contract.slaCount ?? 0) > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            · {contract.slaCount} SLA{contract.slaCount! > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={meta.variant} className="text-[11px]">
                      {meta.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(contract)}
                      disabled={loadingEdit}
                    >
                      {loadingEdit
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Pencil className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(contract)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wizard */}
      <ContractWizardDialog
        open={wizardOpen}
        contractId={editingId}
        initialData={editingData}
        onClose={() => setWizardOpen(false)}
        onSave={handleSave}
      />

      {/* Confirm Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato <strong>{deleteTarget?.name}</strong> será excluído permanentemente.
              Os projetos vinculados <strong>não serão excluídos</strong>, apenas desvinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
