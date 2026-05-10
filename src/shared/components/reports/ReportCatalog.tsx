import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  color?: string; /** Tailwind bg class para o ícone, ex: 'bg-blue-500/10 text-blue-600' */
}

interface ReportCatalogProps {
  items: CatalogItem[];
  onSelect: (id: string) => void;
  title?: string;
  subtitle?: string;
}

export function ReportCatalog({ items, onSelect, title, subtitle }: ReportCatalogProps) {
  return (
    <div className="space-y-5">
      {(title || subtitle) && (
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="group text-left w-full"
          >
            <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
              <CardContent className="p-5 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      "rounded-xl p-2.5",
                      item.color ?? "bg-primary/10 text-primary",
                    )}
                  >
                    <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="outline" className="text-[10px]">{item.badge}</Badge>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm leading-tight">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir relatório <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
