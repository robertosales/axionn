import { type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowLeft, BadgeDollarSign, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { UserAccountMenu } from "@/components/GlobalLogoutButton";
import { AxionLogo } from "@/components/AxionLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/platform/plans", label: "Planos", icon: BadgeDollarSign },
  { to: "/platform/subscriptions", label: "Assinaturas", icon: Building2 },
  { to: "/platform/ai-providers", label: "IA global", icon: Sparkles },
] as const;

export function PlatformShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <AxionLogo size={28} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">Axionn</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-violet-300">
              Plataforma
            </p>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-300" />
            <p className="truncate text-sm font-medium">Admin da plataforma</p>
          </div>
          <Badge variant="outline" className="mt-3 border-violet-400/50 text-violet-200">
            Configuração global
          </Badge>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-violet-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/modulos">
              <ArrowLeft className="h-4 w-4" />
              Trocar ambiente
            </Link>
          </Button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:hidden">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/modulos">
                <ArrowLeft className="h-4 w-4" />
                Trocar ambiente
              </Link>
            </Button>
          </div>

          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-sm font-semibold">Plataforma Axionn</p>
            <p className="truncate text-xs text-muted-foreground">
              {navItems.find((item) => location.pathname.startsWith(item.to))
                ?.label ?? "Configuração global"}
            </p>
          </div>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:hidden">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <Badge variant="outline" className="hidden gap-1.5 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin da plataforma
          </Badge>
          <UserAccountMenu variant="compact" />
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
