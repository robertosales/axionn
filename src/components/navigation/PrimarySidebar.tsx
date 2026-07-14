import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { NavigationSection, NavigationItem } from "./NavigationConfig";

interface PrimarySidebarProps {
  sections: NavigationSection[];
  activePath?: string;
  onNavigate?: (route: string) => void;
}

export function PrimarySidebar({ sections, activePath, onNavigate }: PrimarySidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const activeRoute = activePath ?? location.pathname;

  const handleNavigate = (item: NavigationItem) => {
    if (onNavigate) {
      onNavigate(item.route);
      return;
    }
    navigate(item.route);
  };

  const shortcutLabel = useMemo(() => (collapsed ? "Expandir" : "Recolher"), [collapsed]);

  return (
    <aside className={cn("flex h-full flex-col border-r border-border/70 bg-card/80", collapsed ? "w-20" : "w-72") }>
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-3">
        {!collapsed ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Axionn</p>
            <p className="text-sm font-semibold text-foreground">Navegação</p>
          </div>
        ) : (
          <div className="mx-auto h-9 w-9 rounded-lg border border-border/70 bg-muted/30" />
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed((value) => !value)} aria-label={shortcutLabel}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.id}>
              {!collapsed ? (
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
                  {section.label}
                </p>
              ) : null}
              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const isActive = activeRoute === item.route || activeRoute.startsWith(`${item.route}/`);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item)}
                      className={cn(
                        "flex w-full items-center rounded-xl border px-3 py-2.5 text-left transition-all",
                        collapsed ? "justify-center px-2" : "gap-2.5",
                        isActive
                          ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                          : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/40 hover:text-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 p-3">
        <div className={cn("rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground", collapsed && "px-2 py-3 text-center")}>
          {collapsed ? <ChevronRight className="mx-auto h-3.5 w-3.5" /> : "Navegação declarativa e escalável"}
        </div>
      </div>
    </aside>
  );
}
