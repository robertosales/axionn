import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { NavigationSection, NavigationItem } from "./NavigationConfig";

interface PrimarySidebarProps {
  sections: NavigationSection[];
  activePath?: string;
  onNavigate?: (route: string) => void;
}

export interface NavigationListProps {
  sections: NavigationSection[];
  activePath?: string;
  onNavigate?: (route: string) => void;
  collapsed?: boolean;
}

export function NavigationList({ sections, activePath, onNavigate, collapsed = false }: NavigationListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeRoute = activePath ?? location.pathname;
  const activeItemId = useMemo(() => {
    const matches = sections
      .flatMap((section) => section.items)
      .filter((item) => item.route === activeRoute || (item.route !== "/" && activeRoute.startsWith(`${item.route}/`)));
    return matches.sort((a, b) => b.route.length - a.route.length)[0]?.id;
  }, [activeRoute, sections]);
  const activeSectionId = useMemo(
    () => sections.find((section) => section.items.some((item) => item.id === activeItemId))?.id,
    [activeItemId, sections],
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((section) => [section.id, true])),
  );

  useEffect(() => {
    if (activeSectionId) {
      setOpenSections((current) => ({ ...current, [activeSectionId]: true }));
    }
  }, [activeSectionId]);

  const handleNavigate = (item: NavigationItem) => {
    if (onNavigate) {
      onNavigate(item.route);
      return;
    }
    navigate(item.route);
  };

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <Collapsible
          key={section.id}
          asChild
          open={collapsed || openSections[section.id] !== false}
          onOpenChange={(open) => setOpenSections((current) => ({ ...current, [section.id]: open }))}
        >
          <section>
          {!collapsed ? (
            <CollapsibleTrigger className="group mb-2 flex min-h-8 w-full items-center justify-between rounded-lg px-2 text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80 hover:bg-white/[0.04] hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active">
              <span>{section.label}</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" aria-hidden="true" />
            </CollapsibleTrigger>
          ) : null}
          <CollapsibleContent className="space-y-1.5 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            {section.items.map((item) => {
              const isActive = activeItemId === item.id;
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
          </CollapsibleContent>
          </section>
        </Collapsible>
      ))}
    </div>
  );
}

export function PrimarySidebar({ sections, activePath, onNavigate }: PrimarySidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

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
        <NavigationList sections={sections} activePath={activePath} collapsed={collapsed} onNavigate={onNavigate} />
      </ScrollArea>

      <div className="border-t border-border/70 p-3">
        <div className={cn("rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground", collapsed && "px-2 py-3 text-center")}>
          {collapsed ? <ChevronRight className="mx-auto h-3.5 w-3.5" /> : "Navegação declarativa e escalável"}
        </div>
      </div>
    </aside>
  );
}
