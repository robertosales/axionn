import { Bell, Search, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  collapsed?: boolean;
  className?: string;
}

export function TopBar({ title, subtitle, collapsed = false, className }: TopBarProps) {
  return (
    <header className={cn("flex h-16 items-center justify-between border-b border-border/70 bg-background/95 px-4 backdrop-blur sm:px-6", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl border border-border/70 bg-muted/30 p-2 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <label className={cn("hidden items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground md:flex", collapsed && "md:hidden") }>
          <Search className="h-4 w-4" />
          <Input placeholder="Buscar" className="h-8 w-40 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        </label>

        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Configurações globais">
          <Settings2 className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-2 py-1.5">
          <Badge variant="secondary" className="rounded-full px-2.5">Ops</Badge>
          <Avatar className="h-8 w-8">
            <AvatarFallback>AX</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
