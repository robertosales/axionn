import { useNavigate, useLocation } from "react-router-dom";
import { getInitials } from "@/lib/personName";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSprint } from "@/contexts/SprintContext";
import { APP_VERSION, APP_BUILD_DATE } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Layers, Zap, Wrench, LogOut, GitBranch,
  AlertTriangle, ChevronRight, ChevronLeft, Building2, ChevronsUpDown, Check,
  Sun, Moon, ClipboardList, Menu, Search, Shield,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { NavigationList } from "@/components/navigation/PrimarySidebar";
import {
  filterSalaAgilNavigation,
  sustentacaoNavigationConfig,
  rdmNavigationConfig,
  buildBreadcrumbs,
} from "@/components/navigation/NavigationConfig";
import type { NavigationSection } from "@/components/navigation/NavigationConfig";
import { BreadcrumbsContextual } from "@/components/navigation/BreadcrumbsContextual";
import { useQualityPermissions } from "@/features/quality/hooks/useQualityPermissions";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { persistModuleTeamSelection } from "@/lib/moduleTeamSelection";

const SB = {
  bg:       "#0F172A",
  fg:       "#CBD5E1",
  muted:    "#94A3B8",
  acc:      "rgba(255,255,255,0.06)",
  active:   "#4F46E5",
  teal:     "#6366F1",
  border:   "rgba(255,255,255,0.06)",
  tealA:    (a: number) => `rgba(99,102,241,${a})`,
} as const;

type ActiveModule = "sala_agil" | "sustentacao" | "rdm";

interface AppShellProps {
  module: ActiveModule;
  children: React.ReactNode;
}

const ACCENT = {
  sala_agil:   { hex: "#6366F1", hexAlpha: (a: number) => `rgba(99,102,241,${a})`, avatarBg: "#4f46e5", label: "Sala Ágil", icon: Zap, textCls: "text-indigo-500", bgCls: "bg-indigo-500/12", boxCls: "bg-indigo-500/15 text-indigo-300", path: "/sala-agil" },
  sustentacao: { hex: "#F59E0B", hexAlpha: (a: number) => `rgba(245,158,11,${a})`, avatarBg: "#d97706", label: "Sustentação", icon: Wrench, textCls: "text-amber-500", bgCls: "bg-amber-500/12", boxCls: "bg-amber-500/15 text-amber-300", path: "/sustentacao" },
  rdm:         { hex: "#8B5CF6", hexAlpha: (a: number) => `rgba(139,92,246,${a})`, avatarBg: "#7c3aed", label: "RDM", icon: ClipboardList, textCls: "text-violet-500", bgCls: "bg-violet-500/12", boxCls: "bg-violet-500/15 text-violet-300", path: "/rdm" },
} as const;

function TeamSwitcher({ module, collapsed }: { module: ActiveModule; collapsed: boolean }) {
  const { teams, currentTeamId, setCurrentTeamId } = useAuth();
  const moduleTeams = teams.filter((t) => t.module === module);
  const activeTeam  = moduleTeams.find((t) => t.id === currentTeamId);

  if (moduleTeams.length <= 1) {
    if (collapsed) return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full flex items-center justify-center p-2">
            <Building2 className="h-4 w-4" style={{ color: SB.muted }} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{activeTeam?.name ?? "Time"}</TooltipContent>
      </Tooltip>
    );
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2">
        <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: SB.muted }} />
        <span className="text-[11px] truncate" style={{ color: SB.muted }}>
          {activeTeam?.name ?? "Sem time"}
        </span>
      </div>
    );
  }

  if (collapsed) return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="w-full flex items-center justify-center p-2 rounded-md transition-colors"
          style={{ color: SB.fg }}
          onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <Building2 className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{activeTeam?.name ?? "Time"}</TooltipContent>
    </Tooltip>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors"
          style={{ color: SB.fg }}
          onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: SB.acc, border: `1px solid ${SB.border}` }}>
            <Building2 className="h-3.5 w-3.5" style={{ color: SB.muted }} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[10px] leading-none mb-0.5 uppercase tracking-wider" style={{ color: SB.muted }}>Time ativo</p>
            <p className="text-[12px] font-semibold truncate leading-none" style={{ color: SB.fg }}>
              {activeTeam?.name ?? "Selecionar time"}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" style={{ color: SB.muted }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Trocar time</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {moduleTeams.map((team) => (
          <DropdownMenuItem key={team.id} onClick={() => {
            persistModuleTeamSelection(module, team.id);
            setCurrentTeamId(team.id);
          }}
            className="text-xs gap-2 justify-between cursor-pointer">
            <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{team.name}</span>
            {team.id === currentTeamId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav({ collapsed, navigationConfig }: {
  collapsed: boolean;
  navigationConfig: NavigationSection[];
}) {
  const location = useLocation();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-1 min-h-0 scrollbar-none">
      <NavigationList
        sections={navigationConfig}
        activePath={location.pathname}
        collapsed={collapsed}
      />
    </nav>
  );
}

function ModuleSwitcher({
  module,
  collapsed,
  allowedModules,
  administrationPath,
}: {
  module: ActiveModule;
  collapsed: boolean;
  allowedModules: ActiveModule[];
  administrationPath: string | null;
}) {
  const navigate = useNavigate();
  const operationalModules = [
    { key: "sala_agil" as ActiveModule, path: "/sala-agil", label: "Sala Ágil", Icon: Zap },
    { key: "sustentacao" as ActiveModule, path: "/sustentacao", label: "Sustentação", Icon: Wrench },
    { key: "rdm" as ActiveModule, path: "/rdm", label: "RDM", Icon: ClipboardList },
  ].filter(({ key }) => allowedModules.includes(key));
  const modules = administrationPath
    ? [
        ...operationalModules,
        {
          key: "administracao",
          path: administrationPath,
          label: "Administrador",
          Icon: Shield,
        },
      ]
    : operationalModules;
  const activeModule =
    operationalModules.find(({ key }) => key === module) ?? operationalModules[0];

  if (!activeModule) return null;

  if (collapsed) return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              className="mx-auto my-1 flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
              style={{ color: SB.teal, background: SB.active }}
              aria-label={`Trocar módulo. Atual: ${activeModule.label}`}
            >
              <activeModule.Icon className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {activeModule.label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Trocar módulo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modules.map(({ key, path, label, Icon }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => navigate(path)}
            className="cursor-pointer justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
            {key === module && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2.5 px-3 py-2 transition-colors"
          style={{ color: SB.fg, borderBottom: `1px solid ${SB.border}` }}
          onMouseEnter={(event) => (event.currentTarget.style.background = SB.acc)}
          onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: SB.active, color: SB.teal }}
          >
            <activeModule.Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="mb-0.5 text-[10px] uppercase leading-none tracking-wider" style={{ color: SB.muted }}>
              Módulo ativo
            </p>
            <p className="truncate text-[12px] font-semibold leading-none" style={{ color: SB.fg }}>
              {activeModule.label}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" style={{ color: SB.muted }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Trocar módulo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modules.map(({ key, path, label, Icon }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => navigate(path)}
            className="cursor-pointer justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
            {key === module && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getThemeIsDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return document.documentElement.classList.contains("dark");
}

function DarkModeToggle() {
  const [isDark, setIsDark] = useState(getThemeIsDark);
  useEffect(() => { setIsDark(getThemeIsDark()); }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    try { sessionStorage.setItem("theme", isDark ? "dark" : "light"); } catch {
      // O tema continua aplicado no DOM mesmo sem persistência.
    }
  }, [isDark]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={() => setIsDark((d) => !d)} aria-label="Alternar modo escuro"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          style={{ color: SB.muted }}
          onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{isDark ? "Modo claro" : "Modo escuro"}</TooltipContent>
    </Tooltip>
  );
}

function Topbar({
  module,
  onOpenMobile,
  navigationConfig,
  profile,
  onSignOut,
  isSigningOut,
}: {
  module: ActiveModule;
  onOpenMobile: () => void;
  navigationConfig: NavigationSection[];
  profile: ReturnType<typeof useAuth>["profile"];
  onSignOut: (event: React.MouseEvent) => void;
  isSigningOut: boolean;
}) {
  const { teams, currentTeamId } = useAuth();
  const { activeSprint } = useSprint();
  const location = useLocation();
  const accent = ACCENT[module];
  const activeTeam = teams.find((team) => team.id === currentTeamId && team.module === module);
  const userInitials = getInitials(profile?.full_name ?? profile?.display_name ?? "U");
  const userName = profile?.full_name ?? profile?.display_name ?? profile?.email?.split("@")[0] ?? "Usuário";

  return (
    <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <button
          onClick={onOpenMobile}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label="Abrir navegação"
        >
          <Menu className="h-4 w-4" />
        </button>
        <BreadcrumbsContextual
          className="max-w-[min(42vw,360px)]"
          items={buildBreadcrumbs(location.pathname, navigationConfig)}
        />
      </div>
      <button aria-label="Abrir busca" className="hidden h-9 w-[clamp(150px,22vw,240px)] shrink-0 items-center justify-between rounded-lg bg-muted/60 px-3 text-left text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:flex">
        <span className="flex items-center gap-2"><Search className="h-3.5 w-3.5" />Search...</span>
        <span className="font-mono text-[10px]">⌘K</span>
      </button>
      <div className="hidden min-w-0 max-w-[190px] items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 lg:flex">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium" title={activeTeam?.name ?? "Sem time selecionado"}>
          {activeTeam?.name ?? "Sem time selecionado"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-l border-border/70 pl-1.5 sm:gap-1.5 sm:pl-2">
        <DarkModeToggle />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 max-w-[150px] items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px] font-bold text-white" style={{ backgroundColor: accent.avatarBg }}>{userInitials}</AvatarFallback>
              </Avatar>
              <span className="hidden truncate text-xs font-semibold sm:block">{userName}</span>
              <ChevronsUpDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} disabled={isSigningOut} className="cursor-pointer gap-2 text-red-500 focus:text-red-500">
              <LogOut className="h-4 w-4" /> {isSigningOut ? "Saindo..." : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function SprintBanner() {
  const sprint = useSprint() as any;
  const { activeSprint, userStories = [], impediments = [] } = sprint;
  if (!activeSprint) return null;

  const sprintHUs = userStories.filter((hu: any) => (hu.sprintId || hu.sprint_id) === activeSprint.id);
  const doneHUs = sprintHUs.filter((hu: any) =>
    ["done", "concluido", "finalizado", "pronto_para_publicacao"].includes(String(hu.status ?? "").toLowerCase()),
  );
  const progress = sprintHUs.length > 0 ? Math.round((doneHUs.length / sprintHUs.length) * 100) : 0;
  const activeImpediments = impediments.filter((imp: any) => !imp.resolvedAt && !imp.resolved_at);

  return (
    <div className="sticky top-14 z-10 border-b border-indigo-500/10 bg-indigo-600/[0.06] px-3 py-2 backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <div className="flex min-w-0 max-w-full items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-display font-bold text-indigo-700 dark:text-indigo-300">Sprint ativa</span>
          <span className="truncate font-semibold text-foreground" title={activeSprint.name}>{activeSprint.name}</span>
        </div>
        <div className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-2" aria-label={`Progresso da sprint: ${progress}%`}>
          <span className="font-mono font-semibold text-indigo-600">{progress}%</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-indigo-500/12 sm:w-24">
          <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span className="rounded-md bg-background/60 px-2 py-1 font-medium text-muted-foreground">{sprintHUs.length} HUs</span>
        {activeImpediments.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 font-semibold text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            {activeImpediments.length} imped.
          </span>
        )}
      </div>
    </div>
  );
}

export function AppShell({ module, children }: AppShellProps) {
  const { profile, isAdmin, signOut, isSigningOut } = useAuth();
  const {
    isPlatformAdmin,
    isOrganizationAdmin,
    hasModuleAccess,
    getModuleRole,
  } = useOrganization();
  const location = useLocation();
  const { can: qualityPermissions } = useQualityPermissions({
    entitlementEnabled: module === "sala_agil",
  });
  const navigationConfig = useMemo(
    () =>
      module === "sala_agil"
        ? filterSalaAgilNavigation(qualityPermissions.viewQuality)
        : module === "sustentacao"
          ? sustentacaoNavigationConfig
          : rdmNavigationConfig,
    [module, qualityPermissions.viewQuality],
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const allowedModules = (["sala_agil", "sustentacao", "rdm"] as ActiveModule[]).filter(
    (moduleKey) => isAdmin || isPlatformAdmin || hasModuleAccess(moduleKey),
  );
  const administrationPath = isOrganizationAdmin
    ? "/organization/admin"
    : isAdmin
      ? "/dashboard-admin"
      : null;
  const canSwitch =
    allowedModules.length > 1 ||
    Boolean(administrationPath) ||
    isPlatformAdmin;
  const accent = ACCENT[module];
  const moduleRole = getModuleRole(module);
  const roleLabel =
    moduleRole === "admin"
      ? "Administrador"
      : moduleRole === "member"
        ? "Membro"
        : moduleRole === "viewer"
          ? "Leitura"
          : null;
  const profileContextLabel = roleLabel
    ? `${accent.label} · ${roleLabel}`
    : accent.label;
  const ModuleIcon = accent.icon;
  const userInitials = getInitials(profile?.full_name ?? profile?.display_name ?? "U");
  const sidebarWidth = collapsed ? "w-16" : "w-60";

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-screen w-screen overflow-hidden bg-background font-sans" data-module={module}>
        {mobileOpen && (
          <button
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            aria-label="Fechar navegação"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col h-full shrink-0 overflow-hidden border-r transition-all duration-300 ease-in-out lg:static lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-16 w-60" : sidebarWidth,
        )}
          style={{ background: SB.bg, borderColor: SB.border }}>
          <div className={cn("flex items-center h-14 shrink-0 px-3", collapsed ? "justify-center" : "justify-between")}
            style={{ borderBottom: `1px solid ${SB.border}` }}>
            {collapsed ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-display text-sm font-black text-white shadow-md shadow-indigo-950/30">
                Ax
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-display text-sm font-black text-white shadow-md shadow-indigo-950/30">
                    Ax
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base font-extrabold leading-none text-white">Axionn</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{accent.label}</p>
                  </div>
                </div>
                <button onClick={() => setCollapsed(true)} aria-label="Recolher sidebar"
                  className="hidden h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors lg:flex"
                  style={{ color: SB.muted }}
                  onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </>
            )}
            {collapsed && (
              <button onClick={() => setCollapsed(false)} aria-label="Expandir sidebar"
                className="absolute left-11 hidden h-8 w-8 items-center justify-center rounded-lg transition-colors lg:flex"
                style={{ color: SB.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {canSwitch && (
            <div className="shrink-0">
              <ModuleSwitcher
                module={module}
                collapsed={collapsed}
                allowedModules={allowedModules}
                administrationPath={administrationPath}
              />
            </div>
          )}
          {!canSwitch && !collapsed && (
            <div className="mx-2 mt-2 flex items-center rounded-lg px-3 py-2 text-[12px] font-semibold gap-2" style={{ background: SB.active, color: SB.teal }}>
              <ModuleIcon className="h-3.5 w-3.5 shrink-0" />
              {accent.label}
            </div>
          )}

          <div className="px-2 mt-1 shrink-0"><TeamSwitcher module={module} collapsed={collapsed} /></div>
          <div className="h-px mx-2 mb-1 shrink-0" style={{ background: SB.border }} />
          <SidebarNav
            collapsed={collapsed}
            navigationConfig={navigationConfig}
          />

          <div className="shrink-0 px-2 pb-3 pt-1" style={{ borderTop: `1px solid ${SB.border}` }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn("w-full flex items-center gap-2.5 rounded-lg p-2 mt-1 transition-colors", collapsed && "justify-center")}
                  onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[11px] font-bold text-white" style={{ backgroundColor: accent.avatarBg }}>{userInitials}</AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[12px] font-semibold truncate leading-none" style={{ color: "#ffffff" }}>
                        {profile?.full_name ?? profile?.display_name ?? profile?.email?.split("@")[0] ?? "Usuário"}
                      </p>
                      <p className="text-[10px] truncate leading-none mt-0.5" style={{ color: SB.teal }}>
                        {profileContextLabel}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align={collapsed ? "center" : "end"} className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <p className="font-semibold text-sm">{profile?.full_name ?? profile?.display_name ?? "Usuário"}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/modulos")}
                  className="cursor-pointer gap-2"
                >
                  <Layers className="h-4 w-4" />
                  Trocar ambiente
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}
                  className="text-red-500 focus:text-red-500 gap-2 cursor-pointer disabled:opacity-50">
                  {isSigningOut ? (
                    <><svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" /></svg>Saindo...</>
                  ) : (
                    <><LogOut className="h-4 w-4" /> Sair</>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <VersionBadge collapsed={collapsed} />
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar
            module={module}
            onOpenMobile={() => setMobileOpen(true)}
            navigationConfig={navigationConfig}
            profile={profile}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />
          {module === "sala_agil" && <SprintBanner />}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function VersionBadge({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="mt-1 flex items-center justify-center text-[9px] font-mono select-none" style={{ color: SB.muted }}>v{APP_VERSION}</div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">Versão {APP_VERSION} · {APP_BUILD_DATE}</TooltipContent>
    </Tooltip>
  );
  return (
    <div className="mt-1 px-1 flex items-center justify-between text-[10px] font-mono select-none" style={{ color: SB.muted }}>
      <span>v{APP_VERSION}</span>
      <span style={{ opacity: 0.4 }}>{APP_BUILD_DATE}</span>
    </div>
  );
}
