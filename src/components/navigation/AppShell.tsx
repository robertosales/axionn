import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { TopBar } from "./TopBar";
import { PrimarySidebar } from "./PrimarySidebar";
import { BreadcrumbsContextual } from "./BreadcrumbsContextual";
import { buildBreadcrumbs, navigationConfig } from "./NavigationConfig";
import { cn } from "@/lib/utils";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ title, subtitle, children, className }: AppShellProps) {
  const location = useLocation();
  const breadcrumbs = useMemo(() => buildBreadcrumbs(location.pathname, navigationConfig), [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <PrimarySidebar sections={navigationConfig} activePath={location.pathname} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar title={title} subtitle={subtitle} />
        <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Contexto</p>
              <BreadcrumbsContextual items={breadcrumbs} />
            </div>
            <div className="text-sm text-muted-foreground">
              Migração gradual da navegação Axionn
            </div>
          </div>
          <div className={cn("rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm", className)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
