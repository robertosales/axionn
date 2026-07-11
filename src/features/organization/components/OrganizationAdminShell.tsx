import { type ReactNode, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Building2,
  FileText,
  FolderKanban,
  Gauge,
  Menu,
  Settings2,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AxionLogo } from "@/components/AxionLogo";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { UserAccountMenu } from "@/components/GlobalLogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContractProvider } from "@/features/admin/contexts/ContractContext";
import OrganizationCompaniesPage from "@/features/organization/pages/OrganizationCompaniesPage";
import { useBackofficeAuth } from "@/backoffice/hooks/useBackofficeAuth";

const navItems = [
  { to: "/organization/admin", label: "Visão geral", icon: Gauge },
  { to: "/organization/companies", label: "Empresas", icon: Building2 },
  { to: "/organization/contracts", label: "Contratos", icon: FileText },
  { to: "/organization/projects", label: "Projetos", icon: FolderKanban },
  { to: "/organization/teams", label: "Times", icon: UsersRound },
  { to: "/organization/members", label: "Usuários", icon: Users },
  { to: "/organization/usage", label: "Plano e uso", icon: Gauge },
  { to: "/organization/settings", label: "Configurações", icon: Settings2 },
  { to: "/admin/gitlab-integrations", label: "GitLab", icon: GitBranch },
] as const;

function ShellNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1" aria-label="Console da organização">
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
  const location = useLocation();
  const { currentOrganization, isPlatformAdmin } = useOrganization();
  const { staffMember } = useBackofficeAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <AxionLogo size={24} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none text-white">Axion</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-primary">
            Organização
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
          {currentOrganization?.name ?? "Organização"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {currentOrganization?.plan && (
            <Badge variant="secondary" className="text-[10px]">
              {currentOrganization.plan}
            </Badge>
          )}
          {isPlatformAdmin && (
            <Badge variant="outline" className="border-primary/50 text-[10px] text-primary">
              Admin da plataforma
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <ShellNav onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="border-t border-white/10 px-3 pt-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full justify-start text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"
        >
          <Link to="/modulos">Trocar ambiente</Link>
        </Button>
      </div>

      {(isPlatformAdmin || staffMember) && (
        <div className="p-3 pt-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"
          >
            <Link to="/backoffice">Backoffice Axionn</Link>
          </Button>
        </div>
      )}
    </aside>
  );

  const pageContent =
    location.pathname === "/organization/companies" ? (
      <OrganizationCompaniesPage />
    ) : (
      children
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
          <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Console operacional</p>
              <p className="truncate text-xs text-muted-foreground">
                {currentOrganization?.name ?? "Selecione uma organização"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden md:block">
                <OrganizationSwitcher variant="inline" />
              </div>
              <UserAccountMenu variant="inline" />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-6">{pageContent}</main>
        </div>
      </div>
    </ContractProvider>
  );
}
