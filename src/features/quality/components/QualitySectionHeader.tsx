import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QualitySectionHeaderProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
}

export function QualitySectionHeader({ icon: Icon, title, count, action }: QualitySectionHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-primary" />
        <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
        {count !== undefined && <Badge variant="secondary">{count}</Badge>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
