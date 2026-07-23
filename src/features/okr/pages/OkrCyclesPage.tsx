import { useState } from "react";
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
import { useOkrCycles } from "../hooks/useOkrCycles";
import {
  OKR_CYCLE_STATUS_LABEL,
  OKR_CYCLE_TYPE_LABEL,
  type OkrCycle,
  type OkrCycleInput,
  type OkrCycleStatus,
} from "../types/cycle";

const STATUS_BADGE: Record<OkrCycleStatus, string> = {
  planning: "bg-slate-200 text-slate-800",
  active: "bg-emerald-100 text-emerald-800",
  closing: "bg-amber-100 text-amber-800",
  closed: "bg-sky-100 text-sky-800",
  archived: "bg-zinc-200 text-zinc-700",
  cancelled: "bg-rose-100 text-rose-800",
};

const EMPTY: OkrCycleInput = {
  code: "",
  name: "",
  cycle_type: "quarterly",
  starts_at: "",
  ends_at: "",
  check_in_frequency: "weekly",
  scoring_method: "weighted_or_average",
};

export function OkrCyclesPage() {
  const cycles = useOkrCycles();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OkrCycleInput>(EMPTY);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cycles.create.mutateAsync(form);
      toast.success(`Ciclo ${form.code} criado.`);
      setOpen(false);
      setForm(EMPTY);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Falha ao criar ciclo.");
    }
  }

  async function runTransition(label: string, action: () => Promise<unknown>) {
    try {
      await action();
      toast.success(label);
    } catch (err) {
      toast.error((err as Error)?.message ?? "Operação falhou.");
    }
  }

  if (!cycles.organizationId) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Ciclos de OKR</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Selecione uma organização para gerenciar seus ciclos.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ciclos de OKR</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a vida do ciclo: planejamento → ativo → fechamento → fechado → arquivado.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Novo ciclo</Button>
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Objetivos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando ciclos…
                  </TableCell>
                </TableRow>
              )}
              {!cycles.isLoading && cycles.cycles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum ciclo cadastrado para esta organização.
                  </TableCell>
                </TableRow>
              )}
              {cycles.cycles.map((c) => (
                <CycleRow
                  key={c.id}
                  cycle={c}
                  onPublish={() =>
                    runTransition("Ciclo publicado.", () => cycles.publish.mutateAsync(c.id))
                  }
                  onStartClosing={() =>
                    runTransition("Fechamento iniciado.", () =>
                      cycles.startClosing.mutateAsync(c.id),
                    )
                  }
                  onClose={() =>
                    runTransition("Ciclo fechado.", () => cycles.close.mutateAsync(c.id))
                  }
                  onArchive={() =>
                    runTransition("Ciclo arquivado.", () => cycles.archive.mutateAsync(c.id))
                  }
                  onCancel={(reason) =>
                    runTransition("Ciclo cancelado.", () =>
                      cycles.cancel.mutateAsync({ id: c.id, reason }),
                    )
                  }
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo ciclo</DialogTitle>
            <DialogDescription>
              O ciclo começa em <strong>Planejamento</strong>. Publique quando estiver pronto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  placeholder="Q1/2027"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Q1 2027"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.cycle_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, cycle_type: v as never }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OKR_CYCLE_TYPE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cadência</Label>
                <Select
                  value={form.check_in_frequency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, check_in_frequency: v as never }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="starts">Início *</Label>
                <Input
                  id="starts"
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="ends">Fim *</Label>
                <Input
                  id="ends"
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={cycles.create.isPending}>
                {cycles.create.isPending ? "Criando…" : "Criar ciclo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CycleRow(props: {
  cycle: OkrCycle;
  onPublish: () => void;
  onStartClosing: () => void;
  onClose: () => void;
  onArchive: () => void;
  onCancel: (reason: string) => void;
}) {
  const { cycle } = props;
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{cycle.code}</TableCell>
      <TableCell>{cycle.name}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {OKR_CYCLE_TYPE_LABEL[cycle.cycle_type] ?? cycle.cycle_type}
      </TableCell>
      <TableCell className="text-xs">
        {cycle.starts_at} → {cycle.ends_at}
      </TableCell>
      <TableCell>
        <Badge className={STATUS_BADGE[cycle.status]}>
          {OKR_CYCLE_STATUS_LABEL[cycle.status] ?? cycle.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">{cycle.objectives_count}</TableCell>
      <TableCell className="space-x-1 text-right">
        {cycle.status === "planning" && (
          <Button size="sm" variant="secondary" onClick={props.onPublish}>
            Publicar
          </Button>
        )}
        {cycle.status === "active" && (
          <Button size="sm" variant="secondary" onClick={props.onStartClosing}>
            Iniciar fechamento
          </Button>
        )}
        {cycle.status === "closing" && (
          <Button size="sm" onClick={props.onClose}>
            Fechar
          </Button>
        )}
        {(cycle.status === "closed" || cycle.status === "cancelled") && (
          <Button size="sm" variant="ghost" onClick={props.onArchive}>
            Arquivar
          </Button>
        )}
        {(cycle.status === "planning" || cycle.status === "active") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const reason = window.prompt("Motivo do cancelamento:");
              if (reason && reason.trim()) props.onCancel(reason.trim());
            }}
          >
            Cancelar
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export default OkrCyclesPage;