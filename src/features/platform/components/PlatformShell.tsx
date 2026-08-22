import { type ReactNode, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowLeft, BadgeDollarSign, Building2, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { UserAccountMenu } from "@/components/GlobalLogoutButton";
import { AxionLogo } from "@/components/AxionLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { to: "/platform/plans", label: "Planos", icon: BadgeDollarSign },
  { to: "/platform/subscriptions", label: "Assinaturas", icon: Building2 },
  { to: "/platform/ai-providers", label: "IA global", icon: Sparkles },
] as const;

export function PlatformShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-[hsl(var(--sidebar-accent))] bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-3 border-b border-[hsl(var(--sidebar-accent))] px-4">
        <AxionLogo size={26} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none text-sidebar-foreground">Axionn</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-primary">Plataforma</p>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-sidebar-foreground lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b border-[hsl(var(--sidebar-accent))] px-4 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="truncate text-sm font-medium text-sidebar-foreground">Admin da plataforma</p>
        </div>
        <Badge variant="outline" className="mt-3 border-primary/40 bg-primary/10 text-primary">Configuração global</Badge>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Navegação da plataforma">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(
              "flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[hsl(var(--sidebar-active))] text-white"
                : "text-[hsl(var(--sidebar-foreground))]/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-accent))] p-3">
        <Button asChild variant="ghost" size="sm" className="w-full justify-start text-[hsl(var(--sidebar-foreground))]/75 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Link to="/modulos" onClick={() => setMobileOpen(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Trocar ambiente
          </Link>
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          {sidebar}
          <button className="flex-1 bg-black/55" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />
        </div>
      )}

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md lg:px-6">
          <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Plataforma Axionn</p>
            <p className="truncate text-xs text-muted-foreground">
              {navItems.find((item) => location.pathname.startsWith(item.to))
                ?.label ?? "Configuração global"}
            </p>
          </div>

          <Badge variant="outline" className="hidden gap-1.5 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin da plataforma
          </Badge>
          <ThemeToggle />
          <UserAccountMenu variant="compact" />
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
