import { type ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Building2,
  FileText,
  FolderKanban,
  Gauge,
  LogOut,
  Menu,
  Settings2,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AxionLogo } from "@/components/AxionLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContractProvider } from "@/features/admin/contexts/ContractContext";

const navItems = [
  { to: "/organization/admin", label: "Visao geral", icon: Gauge },
  { to: "/organization/companies", label: "Empresas", icon: Building2 },
  { to: "/organization/contracts", label: "Contratos", icon: FileText },
  { to: "/organization/projects", label: "Projetos", icon: FolderKanban },
  { to: "/organization/teams", label: "Times", icon: UsersRound },
  { to: "/organization/members", label: "Usuarios", icon: Users },
  { to: "/organization/usage", label: "Plano e uso", icon: Gauge },
  { to: "/organization/settings", label: "Configuracoes", icon: Settings2 },
] as const;

function ShellNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1" aria-label="Console da organizacao">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/organization/admin"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[hsl(var(--sidebar-active))] text-white"
                : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function OrganizationAdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { currentOrganization, isPlatformAdmin } = useOrganization();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials =
    profile?.display_name
      ?.split(" ")
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <AxionLogo size={24} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none text-white">Axion</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-primary">
            Organizacao
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 text-[hsl(var(--sidebar-foreground))]/70 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b border-white/10 px-4 py-3">
        <p className="truncate text-sm font-medium text-white">
          {currentOrganization?.name ?? "Organizacao"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {currentOrganization?.plan && (
            <Badge variant="secondary" className="text-[10px]">
              {currentOrganization.plan}
            </Badge>
          )}
          {isPlatformAdmin && (
            <Badge variant="outline" className="border-primary/50 text-[10px] text-primary">
              platform_admin
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ShellNav onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {profile?.display_name ?? "Usuario"}
            </p>
            <p className="truncate text-[11px] text-[hsl(var(--sidebar-foreground))]/50">
              {profile?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );

  return (
    <ContractProvider>
      <div className="min-h-screen bg-background">
        <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
          {sidebar}
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            {sidebar}
            <button
              className="flex-1 bg-black/50"
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            />
          </div>
        )}

        <div className="flex min-h-screen flex-col lg:pl-64">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                Console operacional
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {currentOrganization?.name ?? "Selecione uma organizacao"}
              </p>
            </div>
            {isPlatformAdmin && (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/platform/ai-providers">Plataforma</Link>
              </Button>
            )}
            <ThemeToggle />
          </header>

          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </ContractProvider>
  );
}
