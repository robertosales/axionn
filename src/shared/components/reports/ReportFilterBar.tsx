import { ReactNode } from "react";
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
}

interface ReportFilterBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  extra?: ReactNode;
}

export function ReportFilterBar({ fields, values, onChange, onReset, extra }: ReportFilterBarProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-end gap-3">
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{f.label}</Label>
              {f.type === "select" ? (
                <Select value={values[f.key] ?? "all"} onValueChange={(v) => onChange(f.key, v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={f.placeholder ?? "Todos"} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "date" ? (
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              ) : (
                <Input
                  type="text"
                  className="h-8 text-xs"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
          {extra}
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1.5 text-xs text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
