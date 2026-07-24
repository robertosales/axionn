import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useOkrCycles } from "../hooks/useOkrCycles";
import { useOkrAlignments, useOkrObjectivesV2 } from "../hooks/useOkrObjectivesV2";
import {
  OKR_ALIGNMENT_TYPE_LABEL,
  OKR_OBJECTIVE_LEVEL_LABEL,
  OKR_OBJECTIVE_LIFECYCLE_LABEL,
  type OkrAlignmentType,
  type OkrObjectiveLevel,
  type OkrObjectiveLifecycle,
  type OkrObjectiveV2,
  type OkrObjectiveV2Input,
} from "../types/objective";

const LIFECYCLE_BADGE: Record<OkrObjectiveLifecycle, string> = {
  draft: "bg-slate-200 text-slate-800",
  ready: "bg-blue-100 text-blue-800",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  cancelled: "bg-rose-100 text-rose-800",
  completed: "bg-sky-100 text-sky-800",
  archived: "bg-zinc-200 text-zinc-700",
};

const EMPTY_FORM: OkrObjectiveV2Input = {
  cycle_id: "",
  title: "",
  description: "",
  objective_level: "team",
};

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Erro inesperado";
}

export function OkrObjectivesPage() {
  const cycles = useOkrCycles();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const objectives = useOkrObjectivesV2(selectedCycleId, includeArchived);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<OkrObjectiveV2Input>(EMPTY_FORM);
  const [alignmentTarget, setAlignmentTarget] = useState<OkrObjectiveV2 | null>(null);

  const openCycles = useMemo(
    () => cycles.cycles.filter((c) => c.status === "planning" || c.status === "active"),
    [cycles.cycles],
  );

  const handleCreate = async () => {
    if (!form.cycle_id || !form.title.trim()) {
      toast.error("Ciclo e título são obrigatórios.");
      return;
    }
    try {
      await objectives.create.mutateAsync(form);
      toast.success("Objective criado.");
      setFormOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handlePublish = async (obj: OkrObjectiveV2) => {
    try {
      await objectives.publish.mutateAsync(obj.id);
      toast.success("Objective publicado.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleArchive = async (obj: OkrObjectiveV2) => {
    const reason = window.prompt("Motivo do arquivamento (opcional):") ?? undefined;
    try {
      await objectives.archive.mutateAsync({ id: obj.id, reason });
      toast.success("Objective arquivado.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Objectives (OKR v2)</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de objetivos e alinhamentos por ciclo. Todas as mutações passam por RPC transacional.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCycleId ?? "all"} onValueChange={(v) => setSelectedCycleId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os ciclos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ciclos</SelectItem>
              {cycles.cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(v) => setIncludeArchived(v === true)}
            />
            Incluir arquivados
          </label>
          <Button onClick={() => setFormOpen(true)} disabled={openCycles.length === 0}>
            + Novo objective
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de objectives</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {objectives.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : objectives.objectives.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum objective encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Ciclo de vida</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objectives.objectives.map((obj) => (
                  <TableRow key={obj.id}>
                    <TableCell className="font-medium">{obj.title}</TableCell>
                    <TableCell>{obj.cycle_code ?? "—"}</TableCell>
                    <TableCell>{OKR_OBJECTIVE_LEVEL_LABEL[obj.objective_level]}</TableCell>
                    <TableCell>{obj.team_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={LIFECYCLE_BADGE[obj.lifecycle_status]}>
                        {OKR_OBJECTIVE_LIFECYCLE_LABEL[obj.lifecycle_status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {(obj.lifecycle_status === "draft" || obj.lifecycle_status === "ready") && (
                        <Button size="sm" variant="outline" onClick={() => handlePublish(obj)}>
                          Publicar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setAlignmentTarget(obj)}>
                        Alinhamentos
                      </Button>
                      {obj.lifecycle_status !== "archived" && (
                        <Button size="sm" variant="ghost" onClick={() => handleArchive(obj)}>
                          Arquivar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo objective</DialogTitle>
            <DialogDescription>
              O objective começa em rascunho. Publique quando estiver pronto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ciclo</Label>
              <Select
                value={form.cycle_id}
                onValueChange={(v) => setForm((f) => ({ ...f, cycle_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ciclo aberto" />
                </SelectTrigger>
                <SelectContent>
                  {openCycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Reduzir tempo de resposta em 30%"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label>Nível</Label>
              <Select
                value={form.objective_level ?? "team"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, objective_level: v as OkrObjectiveLevel }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_OBJECTIVE_LEVEL_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={objectives.create.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alignment dialog */}
      <AlignmentDialog
        objective={alignmentTarget}
        allObjectives={objectives.objectives}
        onClose={() => setAlignmentTarget(null)}
      />
    </div>
  );
}

function AlignmentDialog({
  objective,
  allObjectives,
  onClose,
}: {
  objective: OkrObjectiveV2 | null;
  allObjectives: OkrObjectiveV2[];
  onClose: () => void;
}) {
  const alignments = useOkrAlignments(objective?.id ?? null);
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<OkrAlignmentType>("contributes_to");
  const [weight, setWeight] = useState("");
  const [rationale, setRationale] = useState("");

  if (!objective) return null;

  const candidates = allObjectives.filter((o) => o.id !== objective.id);

  const handleCreate = async () => {
    if (!targetId) {
      toast.error("Selecione o objective alvo.");
      return;
    }
    try {
      await alignments.create.mutateAsync({
        source_objective_id: objective.id,
        target_objective_id: targetId,
        alignment_type: type,
        contribution_weight: weight ? Number(weight) : null,
        rationale: rationale || null,
      });
      toast.success("Alinhamento criado.");
      setTargetId("");
      setWeight("");
      setRationale("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await alignments.archive.mutateAsync(id);
      toast.success("Alinhamento removido.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alinhamentos — {objective.title}</DialogTitle>
          <DialogDescription>
            Relacione este objective a outros da mesma organização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Objective alvo</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as OkrAlignmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_ALIGNMENT_TYPE_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peso (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div>
              <Label>Justificativa</Label>
              <Input value={rationale} onChange={(e) => setRationale(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={alignments.create.isPending}>
            Adicionar alinhamento
          </Button>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Alinhamentos existentes</h4>
            {alignments.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : alignments.alignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alinhamento.</p>
            ) : (
              <ul className="space-y-2">
                {alignments.alignments.map((a) => {
                  const outgoing = a.source_objective_id === objective.id;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded border p-2 text-sm"
                    >
                      <div>
                        <Badge variant="outline">{OKR_ALIGNMENT_TYPE_LABEL[a.alignment_type]}</Badge>{" "}
                        <span className="text-muted-foreground">
                          {outgoing ? "→" : "←"}
                        </span>{" "}
                        <span className="font-medium">
                          {outgoing ? a.target_title : a.source_title}
                        </span>
                        {a.contribution_weight != null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            peso {a.contribution_weight}
                          </span>
                        )}
                        {a.rationale && (
                          <p className="text-xs text-muted-foreground">{a.rationale}</p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleArchive(a.id)}>
                        Remover
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}