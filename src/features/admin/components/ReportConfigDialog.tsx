import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label }  from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Sheet as SheetIcon } from "lucide-react";
import type { ReportConfig } from "../hooks/useReportBuilder";
import type { PeriodoFiltro } from "../hooks/useSprintHistory";

const PERIODO_LABELS: Record<PeriodoFiltro, string> = {
  "3m":  "Últimos 3 meses",
  "6m":  "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  "all": "Todo o histórico",
};

interface Props {
  open:    boolean;
  teams:   { id: string; name: string }[];
  onClose: () => void;
  onExport:(config: ReportConfig, format: "pdf" | "excel") => void;
}

export function ReportConfigDialog({ open, teams, onClose, onExport }: Props) {
  const [config, setConfig] = useState<ReportConfig>({
    teamId: "all", teamLabel: "Todos os times",
    periodo: "6m", periodoLabel: PERIODO_LABELS["6m"],
    includeKpis: true, includeSprints: true,
    includeComparativo: true, includeImpedimentos: false,
  });

  useEffect(() => {
    if (open) setConfig(c => ({ ...c, teamId: "all", teamLabel: "Todos os times" }));
  }, [open]);

  const set = <K extends keyof ReportConfig>(k: K, v: ReportConfig[K]) =>
    setConfig(c => ({ ...c, [k]: v }));

  const handleTeam = (id: string) => {
    const name = id === "all" ? "Todos os times" : (teams.find(t => t.id === id)?.name ?? id);
    setConfig(c => ({ ...c, teamId: id, teamLabel: name }));
  };

  const handlePeriodo = (p: PeriodoFiltro) =>
    setConfig(c => ({ ...c, periodo: p, periodoLabel: PERIODO_LABELS[p] }));

  const atLeastOne = config.includeKpis || config.includeSprints || config.includeComparativo;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Relatório</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Time */}
          <div className="space-y-1.5">
            <Label className="text-xs">Time</Label>
            <Select value={config.teamId} onValueChange={handleTeam}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os times</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Período */}
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select value={config.periodo} onValueChange={v => handlePeriodo(v as PeriodoFiltro)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODO_LABELS) as PeriodoFiltro[]).map(k => (
                  <SelectItem key={k} value={k} className="text-xs">{PERIODO_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Seções */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Seções do relatório</Label>
            {([
              { key: "includeKpis",         label: "KPIs Globais" },
              { key: "includeSprints",       label: "Histórico de Sprints" },
              { key: "includeComparativo",   label: "Comparativo entre Times" },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                <Switch
                  id={key}
                  checked={config[key]}
                  onCheckedChange={v => set(key, v)}
                  className="scale-90"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} className="text-xs h-8">Cancelar</Button>
          <Button
            variant="outline"
            disabled={!atLeastOne}
            onClick={() => onExport(config, "excel")}
            className="text-xs h-8 gap-1.5 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
          >
            <SheetIcon className="h-3.5 w-3.5" /> Exportar Excel
          </Button>
          <Button
            disabled={!atLeastOne}
            onClick={() => onExport(config, "pdf")}
            className="text-xs h-8 gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" /> Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
