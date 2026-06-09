import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export type FilterOption = { value: string; label: string };

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "date" | "text";
  options?: FilterOption[];
  placeholder?: string;
  disabled?: boolean;
}

interface AnalistaItem { user_id: string; display_name: string; }

interface ReportFilterBarProps {
  // modo simples (fields/values)
  fields?: FilterField[];
  values?: Record<string, string>;
  onChange?: (key: string, value: string) => void;
  /** Mensagem opcional de validação (modo fields). */
  periodValidation?: string;
  // modo relatorio
  periodo?: string;
  setPeriodo?: (v: string) => void;
  dataInicio?: string;
  setDataInicio?: (v: string) => void;
  dataFim?: string;
  setDataFim?: (v: string) => void;
  analista?: string;
  setAnalista?: (v: string) => void;
  analistas?: AnalistaItem[];
  showAnalista?: boolean;
  analistaDisabled?: boolean;
  modulo?: string;
  totalFiltrado?: number;
  onClear?: () => void;
  onReset?: () => void;
}

const PERIODOS = [
  { value: "7",   label: "Últimos 7 dias" },
  { value: "15",  label: "Últimos 15 dias" },
  { value: "30",  label: "Últimos 30 dias" },
  { value: "60",  label: "Últimos 60 dias" },
  { value: "90",  label: "Últimos 90 dias" },
  { value: "custom", label: "Personalizado" },
];

export function ReportFilterBar({
  fields, values, onChange, periodValidation,
  periodo, setPeriodo,
  dataInicio, setDataInicio,
  dataFim, setDataFim,
  analista, setAnalista,
  analistas = [],
  showAnalista = true,
  analistaDisabled = false,
  totalFiltrado,
  onClear, onReset,
}: ReportFilterBarProps) {

  // modo fields/values legado
  if (fields && values && onChange) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-end gap-3">
            {fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1 min-w-[140px]">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{f.label}</Label>
                {f.type === "select" ? (
                  <Select value={values[f.key] ?? "all"} onValueChange={(v) => onChange(f.key, v)} disabled={f.disabled}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={f.placeholder ?? "Todos"} /></SelectTrigger>
                    <SelectContent>
                      {f.options?.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input type={f.type === "date" ? "date" : "text"} className="h-8 text-xs" placeholder={f.placeholder} disabled={f.disabled}
                    value={values[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} />
                )}
              </div>
            ))}
            {(onReset || onClear) && (
              <Button variant="ghost" size="sm" onClick={onReset ?? onClear} className="h-8 gap-1.5 text-xs text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
          {periodValidation && (
            <p className="mt-2 text-[11px] text-destructive">{periodValidation}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // modo relatorio
  const handlePeriodo = (v: string) => {
    if (!setPeriodo || !setDataInicio || !setDataFim) return;
    setPeriodo(v);
    if (v !== "custom") {
      const days = parseInt(v, 10);
      const fim = new Date(); const ini = new Date();
      ini.setDate(fim.getDate() - days);
      setDataFim(fim.toISOString().split("T")[0]);
      setDataInicio(ini.toISOString().split("T")[0]);
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-end gap-3">
          {setPeriodo && (
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Período</Label>
              <Select value={periodo ?? "30"} onValueChange={handlePeriodo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODOS.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {setDataInicio && (
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Data início</Label>
              <Input type="date" className="h-8 text-xs" value={dataInicio ?? ""}
                onChange={e => { setDataInicio(e.target.value); setPeriodo?.("custom"); }} />
            </div>
          )}
          {setDataFim && (
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Data fim</Label>
              <Input type="date" className="h-8 text-xs" value={dataFim ?? ""}
                onChange={e => { setDataFim(e.target.value); setPeriodo?.("custom"); }} />
            </div>
          )}
          {showAnalista && setAnalista && (
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Analista</Label>
              <Select value={analista ?? "all"} onValueChange={setAnalista} disabled={analistaDisabled}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  {analistas.map(a => <SelectItem key={a.user_id} value={a.user_id} className="text-xs">{a.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end gap-2 ml-auto">
            {totalFiltrado !== undefined && (
              <span className="text-[11px] text-muted-foreground pb-1.5">{totalFiltrado} registro{totalFiltrado !== 1 ? "s" : ""}</span>
            )}
            {(onClear || onReset) && (
              <Button variant="ghost" size="sm" onClick={onClear ?? onReset} className="h-8 gap-1.5 text-xs text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
