import { type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CreditCard,
  Headphones,
  LayoutDashboard,
  Receipt,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useBackofficeAuth } from "@/backoffice/hooks/useBackofficeAuth";
import { UserAccountMenu } from "@/components/GlobalLogoutButton";
import { AxionLogo } from "@/components/AxionLogo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/backoffice", label: "Dashboard", icon: LayoutDashboard },
  { to: "/backoffice/clientes", label: "Clientes", icon: Building2 },
  { to: "/backoffice/assinaturas", label: "Assinaturas", icon: CreditCard },
  { to: "/backoffice/financeiro", label: "Financeiro", icon: Receipt },
  { to: "/backoffice/equipe", label: "Equipe", icon: Users },
  { to: "/backoffice/suporte", label: "Suporte", icon: Headphones },
  { to: "/backoffice/analitico", label: "Analitico", icon: BarChart3 },
  { to: "/backoffice/configuracoes", label: "Configuracoes", icon: Settings2 },
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  financeiro: "Financeiro",
  suporte: "Suporte",
  comercial: "Comercial",
  dev: "Dev",
};

export function BackofficeLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { staffMember } = useBackofficeAuth();
  const { currentOrganizationId, isOrganizationAdmin } = useOrganization();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <AxionLogo size={28} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none">Axionn</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-cyan-300">
              Backoffice
            </p>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            <p className="truncate text-sm font-medium">Roberto Sales LTDA</p>
          </div>
          {staffMember && (
            <div className="mt-3 space-y-1">
              <p className="truncate text-xs text-slate-400">{staffMember.fullName}</p>
              <Badge variant="outline" className="border-cyan-400/50 text-cyan-200">
                {ROLE_LABELS[staffMember.role] ?? staffMember.role}
              </Badge>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/backoffice"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {currentOrganizationId && isOrganizationAdmin && (
          <div className="border-t border-white/10 p-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Link to="/organization/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Administrador
              </Link>
            </Button>
          </div>
        )}
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-4 border-b bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Backoffice Axionn</p>
            <p className="truncate text-xs text-muted-foreground">
              {navItems.find((item) =>
                item.to === "/backoffice"
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to),
              )?.label ?? "Operacao interna"}
            </p>
          </div>
          <UserAccountMenu variant="inline" />
        </header>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
