import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  path: string;
}

interface BreadcrumbsContextualProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbsContextual({ items, className }: BreadcrumbsContextualProps) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-muted-foreground", className)}>
      <Link to="/" className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted/40 hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Início</span>
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.path}-${index}`} className="flex min-w-0 shrink-0 items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
            {isLast ? (
              <span className="max-w-[min(38vw,260px)] truncate rounded-md px-2 py-1 font-medium text-foreground" title={item.label}>{item.label}</span>
            ) : (
              <Link to={item.path} className="max-w-[min(24vw,180px)] truncate rounded-md px-2 py-1 hover:bg-muted/40 hover:text-foreground" title={item.label}>
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
