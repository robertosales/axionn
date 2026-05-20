import { useNavigate, useLocation } from "react-router-dom";
import { getInitials, formatPersonName } from "@/lib/personName";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import { APP_VERSION, APP_BUILD_DATE } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  ListTodo,
  Layers,
  Kanban,
  Calendar,
  BarChart3,
  History,
  Users,
  Settings,
  Zap,
  Wrench,
  LogOut,
  User,
  GitBranch,
  AlertTriangle,
  FileText,
  Upload,
  Repeat,
  Activity,
  ShieldCheck,
  ChevronRight,
  Building2,
  ChevronsUpDown,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ClipboardList,
  CheckSquare,
  ArrowLeftRight,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { AxionLogo } from "@/components/AxionLogo";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

type ActiveModule = "sala_agil" | "sustentacao" | "rdm";

interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
  group: "sprints" | "cerimonias" | "operacoes" | "org" | "config";
  roles?: string[];
}

interface AppShellProps {
  module: ActiveModule;
  children: React.ReactNode;
  activeKey?: string;
  onNavigate?: (key: string) => void;
}

function HeartSuitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
    </svg>
  );
}

function PlayingCardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="2" width="11" height="15" rx="1.5" />
      <path
        d="M7 5.5c0-.8.6-1.5 1.4-1.5.4 0 .8.2 1.1.6.3-.4.7-.6 1.1-.6.8 0 1.4.7 1.4 1.5 0 1.2-1.5 2.3-2.5 3C9.5 7.8 7 6.7 7 5.5z"
        fill="currentColor"
        stroke="none"
      />
      <rect x="9" y="7" width="11" height="15" rx="1.5" />
    </svg>
  );
}

// Grupos da Sala Ágil divididos semanticamente
const GROUP_LABELS: Record<NavItem["group"], string> = {
  sprints:    "Sprints",
  cerimonias: "Cerimônias",
  operacoes:  "Operações",
  org:        "Relatórios",
  config:     "Configurações",
};

const NAV_SALA_AGIL: NavItem[] = [
  // Sprints
  { key: "dashboard", label: "Dashboard",     icon: LayoutDashboard, path: "/sala-agil",              group: "sprints" },
  { key: "board",     label: "Board Kanban",   icon: Kanban,          path: "/sala-agil/board",        group: "sprints" },
  { key: "backlog",   label: "Backlog",         icon: ListTodo,        path: "/sala-agil/backlog",      group: "sprints" },
  { key: "epicos",    label: "Épicos",           icon: Layers,          path: "/sala-agil/epicos",       group: "sprints" },
  // Cerimônias
  { key: "planning-poker", label: "Planning Poker", icon: PlayingCardIcon, path: "/sala-agil/planning-poker", group: "cerimonias" },
  { key: "retrospectiva",  label: "Retrospectiva",  icon: Repeat,          path: "/sala-agil/retrospectiva",  group: "cerimonias" },
  { key: "impedimentos",   label: "Impedimentos",   icon: AlertTriangle,   path: "/sala-agil/impedimentos",   group: "cerimonias" },
  // Operações
  { key: "calendario", label: "Calendário", icon: Calendar,  path: "/sala-agil/calendario", group: "operacoes" },
  { key: "equipe",     label: "Equipe",     icon: Users,     path: "/sala-agil/equipe",     group: "operacoes" },
  { key: "atividades", label: "Atividades", icon: Activity,  path: "/sala-agil/atividades", group: "operacoes" },
  // Relatórios
  { key: "metricas",    label: "Métricas",               icon: BarChart3, path: "/sala-agil/metricas",    group: "org" },
  { key: "historico",   label: "Histórico",               icon: History,   path: "/sala-agil/historico",   group: "org" },
  {
    key: "gerador-apf",
    label: "Relatório de Evidências",
    icon: FileText,
    path: "/sala-agil/gerador-apf",
    group: "org",
    roles: ["scrum_master", "analyst"],
  },
  // Configurações
  { key: "times",      label: "Times",         icon: Users,       path: "/sala-agil/times",      group: "config" },
  { key: "membros",    label: "Membros",        icon: User,        path: "/sala-agil/membros",    group: "config" },
  { key: "perfis",     label: "Perfis (RBAC)",  icon: ShieldCheck, path: "/sala-agil/perfis",     group: "config" },
  { key: "fluxo",      label: "Fluxo",          icon: GitBranch,   path: "/sala-agil/fluxo",      group: "config" },
  { key: "campos",     label: "Campos Custom",  icon: Settings,    path: "/sala-agil/campos",     group: "config" },
  { key: "automacoes", label: "Automações",     icon: Repeat,      path: "/sala-agil/automacoes", group: "config" },
];

const NAV_SUSTENTACAO: NavItem[] = [
  { key: "dashboard",  label: "Dashboard",        icon: LayoutDashboard, path: "/sustentacao",            group: "sprints" },
  { key: "board",      label: "Board Kanban",      icon: Kanban,          path: "/sustentacao/board",      group: "sprints" },
  { key: "demandas",   label: "Demandas",          icon: ListTodo,        path: "/sustentacao/demandas",   group: "sprints" },
  { key: "projetos",   label: "Projetos",          icon: Layers,          path: "/sustentacao/projetos",   group: "sprints" },
  { key: "importacao", label: "Importação Excel",  icon: Upload,          path: "/sustentacao/importacao", group: "operacoes" },
  { key: "equipe",     label: "Equipe",            icon: Users,           path: "/sustentacao/equipe",     group: "operacoes" },
  { key: "fluxo",      label: "Fluxo de Trabalho", icon: GitBranch,       path: "/sustentacao/fluxo",      group: "operacoes" },
  { key: "relatorios", label: "Relatórios",        icon: FileText,        path: "/sustentacao/relatorios", group: "org" },
  { key: "times",      label: "Times",             icon: Users,           path: "/sustentacao/times",      group: "config" },
  { key: "membros",    label: "Membros",            icon: User,            path: "/sustentacao/membros",    group: "config" },
  { key: "perfis",     label: "Perfis (RBAC)",      icon: ShieldCheck,     path: "/sustentacao/perfis",     group: "config" },
  { key: "campos",     label: "Campos Custom",      icon: Settings,        path: "/sustentacao/campos",     group: "config" },
  { key: "automacoes", label: "Automações",         icon: Repeat,          path: "/sustentacao/automacoes", group: "config" },
];

const NAV_RDM: NavItem[] = [
  { key: "dashboard", label: "Dashboard",    icon: LayoutDashboard, path: "/rdm",           group: "sprints" },
  { key: "rdms",      label: "RDMs",         icon: ClipboardList,   path: "/rdm/rdms",      group: "sprints" },
  { key: "checklist", label: "Checklists",   icon: CheckSquare,     path: "/rdm/checklist", group: "sprints" },
  { key: "gonogo",    label: "Go/No-Go",     icon: ArrowLeftRight,  path: "/rdm/gonogo",    group: "sprints" },
  { key: "times",     label: "Times",        icon: Users,           path: "/rdm/times",     group: "config" },
  { key: "membros",   label: "Membros",       icon: User,            path: "/rdm/membros",   group: "config" },
  { key: "perfis",    label: "Perfis (RBAC)", icon: ShieldCheck,     path: "/rdm/perfis",    group: "config" },
];

const ACCENT = {
  sala_agil: {
    hex: "#01696f",
    hexAlpha: (a: number) => `rgba(1,105,111,${a})`,
    textCls: "text-[#4f98a3]",
    bgCls: "bg-[rgba(1,105,111,0.14)]",
    avatarBg: "#01696f",
    label: "Sala Ágil",
    icon: Zap,
  },
  sustentacao: {
    hex: "#d97706",
    hexAlpha: (a: number) => `rgba(217,119,6,${a})`,
    textCls: "text-amber-400",
    bgCls: "bg-amber-400/10",
    avatarBg: "#b45309",
    label: "Sustentação",
    icon: Wrench,
  },
  rdm: {
    hex: "#7c3aed",
    hexAlpha: (a: number) => `rgba(124,58,237,${a})`,
    textCls: "text-violet-400",
    bgCls: "bg-violet-400/10",
    avatarBg: "#6d28d9",
    label: "RDM",
    icon: ClipboardList,
  },
} as const;

// ─── TeamSwitcher ─────────────────────────────────────────────────────────────
function TeamSwitcher({ module, collapsed }: { module: ActiveModule; collapsed: boolean }) {
  const { teams, currentTeamId, setCurrentTeamId } = useAuth();

  const moduleTeams = teams.filter((t) => t.module === module);
  const activeTeam  = moduleTeams.find((t) => t.id === currentTeamId);

  // Espaço sempre reservado — label estática se 1 time, dropdown se 2+
  if (moduleTeams.length <= 1) {
    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full flex items-center justify-center p-2">
              <Building2 className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {activeTeam?.name ?? "Time"}
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <div className="w-full flex items-center gap-2 px-3 py-1.5">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-[11px] text-muted-foreground/50 truncate">
          {activeTeam?.name ?? "Sem time"}
        </span>
      </div>
    );
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="w-full flex items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {activeTeam?.name ?? "Time"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors group">
          <div className="h-7 w-7 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0 border border-border">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[10px] text-muted-foreground leading-none mb-0.5 uppercase tracking-wider">Time ativo</p>
            <p className="text-[12px] font-medium text-sidebar-foreground truncate leading-none">
              {activeTeam?.name ?? "Selecionar time"}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Trocar time</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {moduleTeams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => setCurrentTeamId(team.id)}
            className="text-xs gap-2 justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              {team.name}
            </span>
            {team.id === currentTeamId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── NavItemButton ────────────────────────────────────────────────────────────
function NavItemButton({
  item,
  module,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  module: ActiveModule;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: (key: string) => void;
}) {
  const navigate = useNavigate();
  const accent = ACCENT[module];
  const Icon = item.icon;
  const handleClick = () => {
    onNavigate ? onNavigate(item.key) : navigate(item.path);
  };

  const btn = (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-center rounded-lg transition-all duration-150 group relative",
        collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-3 py-2",
        isActive ? "text-white" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
      )}
      style={
        isActive
          ? {
              backgroundColor: accent.hexAlpha(0.18),
              boxShadow: `inset 0 0 0 1px ${accent.hexAlpha(0.25)}`,
            }
          : {}
      }
    >
      {isActive && !collapsed && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
          style={{ backgroundColor: accent.hex }}
        />
      )}
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-4 w-4" : "h-3.5 w-3.5",
          isActive ? accent.textCls : "",
        )}
      />
      {!collapsed && (
        <span className="text-[12.5px] font-medium truncate flex-1 text-left leading-none">{item.label}</span>
      )}
      {isActive && collapsed && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent.hex }} />
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

// ─── SidebarNav ───────────────────────────────────────────────────────────────
function SidebarNav({
  module,
  activeKey,
  collapsed,
  onNavigate,
}: {
  module: ActiveModule;
  activeKey?: string;
  collapsed: boolean;
  onNavigate?: (key: string) => void;
}) {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const items =
    module === "sala_agil"
      ? NAV_SALA_AGIL
      : module === "sustentacao"
        ? NAV_SUSTENTACAO
        : NAV_RDM;

  const filteredItems = items.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => hasPermission(r as any));
  });

  const groupOrder = (["sprints", "cerimonias", "operacoes", "org", "config"] as const).filter(
    (g) => filteredItems.some((i) => i.group === g),
  );

  const groups = groupOrder.map((g) => ({
    group: g,
    items: filteredItems.filter((i) => i.group === g),
  }));

  const isItemActive = (item: NavItem) => {
    if (activeKey) return item.key === activeKey;
    const roots = ["/sala-agil", "/sustentacao", "/rdm"];
    if (roots.includes(item.path)) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-3 scrollbar-none min-h-0">
      {groups.map(({ group, items: groupItems }) => (
        <div key={group}>
          {!collapsed && (
            <p className="px-3 pb-1 text-[9px] font-bold tracking-[0.12em] text-muted-foreground/50 uppercase select-none">
              {GROUP_LABELS[group]}
            </p>
          )}
          {collapsed && group !== "sprints" && <div className="h-px bg-border mx-1 my-1" />}
          <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
            {groupItems.map((item) => (
              <NavItemButton
                key={item.key}
                item={item}
                module={module}
                isActive={isItemActive(item)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ─── ModuleSwitcher — tabs com borda ativa ────────────────────────────────────
function ModuleSwitcher({ module, collapsed }: { module: ActiveModule; collapsed: boolean }) {
  const navigate = useNavigate();
  const modules: { key: ActiveModule; path: string; shortLabel: string }[] = [
    { key: "sala_agil",   path: "/sala-agil",  shortLabel: "Ágil" },
    { key: "sustentacao", path: "/sustentacao", shortLabel: "Sust." },
    { key: "rdm",         path: "/rdm",         shortLabel: "RDM" },
  ];

  if (collapsed) {
    return (
      <div className="mx-auto mb-2 flex flex-col items-center gap-1 w-full px-2">
        {modules.map(({ key, path, shortLabel }) => {
          const acc = ACCENT[key];
          const Icon = acc.icon;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate(path)}
                  className={cn(
                    "flex w-full items-center justify-center rounded-lg p-2 transition-all",
                    module === key
                      ? `${acc.textCls}`
                      : "text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                  )}
                  style={module === key ? { backgroundColor: acc.hexAlpha(0.2) } : {}}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{acc.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  // Tabs com borda colorida na aba ativa
  return (
    <div className="mx-2 mb-0 flex items-end border-b border-border">
      {modules.map(({ key, path, shortLabel }) => {
        const acc = ACCENT[key];
        const Icon = acc.icon;
        const isActive = module === key;
        return (
          <button
            key={key}
            onClick={() => navigate(path)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold transition-all relative",
              isActive
                ? `${acc.textCls}`
                : "text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-t-md",
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            {shortLabel}
            {isActive && (
              <span
                className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full"
                style={{ backgroundColor: acc.hex }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── DarkModeToggle ───────────────────────────────────────────────────────────
function getThemeIsDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return document.documentElement.classList.contains("dark");
}

function DarkModeToggle() {
  const [isDark, setIsDark] = useState(getThemeIsDark);

  useEffect(() => {
    const current = getThemeIsDark();
    setIsDark(current);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
    try { sessionStorage.setItem("theme", isDark ? "dark" : "light"); } catch {}
  }, [isDark]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setIsDark((d) => !d)}
          aria-label="Alternar modo escuro"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground
            hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{isDark ? "Modo claro" : "Modo escuro"}</TooltipContent>
    </Tooltip>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({ module, activeKey }: { module: ActiveModule; activeKey?: string }) {
  const { activeSprint } = useSprint();
  const location = useLocation();
  const accent = ACCENT[module];
  const items =
    module === "sala_agil"
      ? NAV_SALA_AGIL
      : module === "sustentacao"
        ? NAV_SUSTENTACAO
        : NAV_RDM;
  const activeItem = activeKey
    ? items.find((i) => i.key === activeKey)
    : items.find((i) => {
        const roots = ["/sala-agil", "/sustentacao", "/rdm"];
        if (roots.includes(i.path)) return location.pathname === i.path;
        return location.pathname.startsWith(i.path);
      });
  const pageLabel = activeItem?.label ?? "Dashboard";
  const Icon = activeItem?.icon;
  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-4 bg-sidebar border-b border-border overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-[11px] text-muted-foreground font-medium hidden sm:block shrink-0">
          {accent.label}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 hidden sm:block shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", accent.textCls)} />}
          <span className="text-[13px] font-semibold text-foreground truncate">{pageLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {module === "sala_agil" && activeSprint && (
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold border shrink-0"
            style={{
              backgroundColor: accent.hexAlpha(0.12),
              color: accent.hex,
              borderColor: accent.hexAlpha(0.25),
            }}
          >
            <GitBranch className="h-2.5 w-2.5" />
            <span className="truncate max-w-[120px]">{activeSprint.name}</span>
          </div>
        )}
        <DarkModeToggle />
        <NotificationBell />
      </div>
    </header>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
export function AppShell({ module, children, activeKey, onNavigate }: AppShellProps) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const moduleAccess = profile?.module_access ?? "sala_agil";
  const canSwitch = isAdmin || moduleAccess === "admin";
  const accent = ACCENT[module];
  const userInitials = getInitials(profile?.full_name ?? profile?.display_name ?? "U");
  const sidebarWidth = collapsed ? "w-[56px]" : "w-[220px]";

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-screen w-screen overflow-hidden bg-background" data-module={module}>
        {/* Sidebar */}
        <aside
          className={cn(
            "flex flex-col h-full shrink-0 bg-sidebar transition-[width] duration-200 ease-in-out overflow-hidden",
            sidebarWidth,
          )}
          style={{ boxShadow: "1px 0 0 hsl(var(--border)), 4px 0 24px rgba(0,0,0,0.15)" }}
        >
          {/* Logo + collapse button */}
          <div
            className={cn(
              "flex items-center h-12 shrink-0 px-3 border-b border-border",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCollapsed(false)}
                    aria-label="Expandir sidebar"
                    className="flex items-center justify-center rounded-md text-muted-foreground/40
                      hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Expandir</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <AxionLogo size={22} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-foreground tracking-tight leading-none">Axion</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
                      {accent.label}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCollapsed(true)}
                  aria-label="Recolher sidebar"
                  className="flex h-6 w-6 items-center justify-center rounded-md shrink-0
                    text-muted-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Module Switcher — tabs com borda ativa */}
          {canSwitch && (
            <div className="shrink-0">
              <ModuleSwitcher module={module} collapsed={collapsed} />
            </div>
          )}

          {!canSwitch && !collapsed && (
            <div
              className={cn(
                "mx-2 mt-2 flex items-center rounded-xl px-3 py-2 text-[12px] font-semibold gap-2",
                accent.bgCls,
                accent.textCls,
              )}
            >
              <accent.icon className="h-3.5 w-3.5 shrink-0" />
              {accent.label}
            </div>
          )}

          {/* Team Switcher — espaço sempre reservado */}
          <div className="px-2 mt-1 shrink-0">
            <TeamSwitcher module={module} collapsed={collapsed} />
          </div>

          <div className="h-px bg-border mx-2 mb-1 shrink-0" />

          <SidebarNav module={module} activeKey={activeKey} collapsed={collapsed} onNavigate={onNavigate} />

          {/* Rodapé */}
          <div className="shrink-0 px-2 pb-3 pt-1">
            <div className="h-px bg-border mb-2" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-xl p-2 hover:bg-sidebar-accent transition-colors",
                    collapsed && "justify-center",
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback
                      className="text-[11px] font-bold text-white"
                      style={{ backgroundColor: accent.avatarBg }}
                    >
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate leading-none">
                        {profile?.full_name ?? profile?.display_name ?? profile?.email?.split("@")[0] ?? "Usuário"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                        {profile?.role ?? profile?.module_access ?? "Membro"}
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
                  onClick={() => signOut()}
                  className="text-red-500 focus:text-red-500 gap-2 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <VersionBadge collapsed={collapsed} />
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar module={module} activeKey={activeKey} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ─── Versão do sistema ───────────────────────────────────────────────────── */
function VersionBadge({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-2 flex items-center justify-center text-[9px] font-mono text-muted-foreground/60 select-none">
            v{APP_VERSION}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          Versão {APP_VERSION} · {APP_BUILD_DATE}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="mt-2 px-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground/60 select-none">
      <span>v{APP_VERSION}</span>
      <span className="text-muted-foreground/40">{APP_BUILD_DATE}</span>
    </div>
  );
}
