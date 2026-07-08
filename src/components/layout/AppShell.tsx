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
  LayoutDashboard, ListTodo, Layers, Kanban, Calendar, BarChart3,
  History, Users, Settings, Zap, Wrench, LogOut, User, GitBranch,
  AlertTriangle, FileText, Upload, Repeat, Activity, ShieldCheck,
  ChevronRight, ChevronLeft, Building2, ChevronsUpDown, Check,
  Sun, Moon, ClipboardList, CheckSquare, ArrowLeftRight, Target,
  Menu, Search, Shield,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

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

function PlayingCardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="2" width="11" height="15" rx="1.5" />
      <path d="M7 5.5c0-.8.6-1.5 1.4-1.5.4 0 .8.2 1.1.6.3-.4.7-.6 1.1-.6.8 0 1.4.7 1.4 1.5 0 1.2-1.5 2.3-2.5 3C9.5 7.8 7 6.7 7 5.5z"
        fill="currentColor" stroke="none" />
      <rect x="9" y="7" width="11" height="15" rx="1.5" />
    </svg>
  );
}

const GROUP_LABELS: Record<NavItem["group"], string> = {
  sprints: "Sprints", cerimonias: "Cerimônias", operacoes: "Operações",
  org: "Relatórios", config: "Configurações",
};

const NAV_SALA_AGIL: NavItem[] = [
  { key: "dashboard",      label: "Dashboard",     icon: LayoutDashboard, path: "/sala-agil",                group: "sprints" },
  { key: "board",          label: "Board Kanban",  icon: Kanban,          path: "/sala-agil/board",          group: "sprints" },
  { key: "backlog",        label: "Backlog",       icon: ListTodo,        path: "/sala-agil/backlog",        group: "sprints" },
  { key: "epicos",         label: "Épicos",        icon: Layers,          path: "/sala-agil/epicos",         group: "sprints" },
  { key: "planning-poker", label: "Planning Poker", icon: PlayingCardIcon, path: "/sala-agil/planning-poker", group: "cerimonias" },
  { key: "retrospectiva",  label: "Retrospectiva", icon: Repeat,          path: "/sala-agil/retrospectiva",  group: "cerimonias" },
  { key: "impedimentos",   label: "Impedimentos",  icon: AlertTriangle,   path: "/sala-agil/impedimentos",   group: "cerimonias" },
  { key: "calendario",     label: "Calendário",    icon: Calendar,        path: "/sala-agil/calendario",     group: "operacoes" },
  { key: "equipe",         label: "Equipe",        icon: Users,           path: "/sala-agil/equipe",         group: "operacoes" },
  { key: "atividades",     label: "Atividades",    icon: Activity,        path: "/sala-agil/atividades",     group: "operacoes" },
  { key: "metricas",       label: "Métricas",      icon: BarChart3,       path: "/sala-agil/metricas",       group: "org" },
  { key: "relatorios",     label: "Relatórios",    icon: FileText,        path: "/sala-agil/relatorios",     group: "org" },
  { key: "historico",      label: "Histórico",     icon: History,         path: "/sala-agil/historico",      group: "org" },
  { key: "okr",            label: "OKR",           icon: Target,          path: "/okr",                      group: "org" },
  { key: "times",          label: "Times",         icon: Users,           path: "/sala-agil/times",          group: "config" },
  { key: "membros",        label: "Membros",       icon: User,            path: "/sala-agil/membros",        group: "config" },
  { key: "perfis",         label: "Perfis (RBAC)", icon: ShieldCheck,     path: "/sala-agil/perfis",         group: "config" },
  { key: "fluxo",          label: "Fluxo",         icon: GitBranch,       path: "/sala-agil/fluxo",          group: "config" },
  { key: "campos",         label: "Campos Custom", icon: Settings,        path: "/sala-agil/campos",         group: "config" },
  { key: "automacoes",     label: "Automações",    icon: Repeat,          path: "/sala-agil/automacoes",     group: "config" },
];

// 5d: item "projetos" removido — gestão centralizada no Admin
const NAV_SUSTENTACAO: NavItem[] = [
  { key: "dashboard",  label: "Dashboard",        icon: LayoutDashboard, path: "/sustentacao",            group: "sprints" },
  { key: "board",      label: "Board Kanban",     icon: Kanban,          path: "/sustentacao/board",      group: "sprints" },
  { key: "demandas",   label: "Demandas",         icon: ListTodo,        path: "/sustentacao/demandas",   group: "sprints" },
  { key: "importacao", label: "Importação Excel", icon: Upload,          path: "/sustentacao/importacao", group: "operacoes" },
  { key: "equipe",     label: "Equipe",           icon: Users,           path: "/sustentacao/equipe",     group: "operacoes" },
  { key: "fluxo",      label: "Fluxo de Trabalho", icon: GitBranch,      path: "/sustentacao/fluxo",      group: "operacoes" },
  { key: "relatorios", label: "Relatórios",       icon: FileText,        path: "/sustentacao/relatorios", group: "org" },
  { key: "times",      label: "Times",            icon: Users,           path: "/sustentacao/times",      group: "config" },
  { key: "membros",    label: "Membros",          icon: User,            path: "/sustentacao/membros",    group: "config" },
  { key: "perfis",     label: "Perfis (RBAC)",    icon: ShieldCheck,     path: "/sustentacao/perfis",     group: "config" },
  { key: "campos",     label: "Campos Custom",    icon: Settings,        path: "/sustentacao/campos",     group: "config" },
  { key: "automacoes", label: "Automações",       icon: Repeat,          path: "/sustentacao/automacoes", group: "config" },
];

const NAV_RDM: NavItem[] = [
  { key: "dashboard", label: "Dashboard",    icon: LayoutDashboard, path: "/rdm",           group: "sprints" },
  { key: "rdms",      label: "RDMs",         icon: ClipboardList,   path: "/rdm/rdms",      group: "sprints" },
  { key: "checklist", label: "Checklists",   icon: CheckSquare,     path: "/rdm/checklist", group: "sprints" },
  { key: "gonogo",    label: "Go/No-Go",     icon: ArrowLeftRight,  path: "/rdm/gonogo",    group: "sprints" },
  { key: "times",     label: "Times",        icon: Users,           path: "/rdm/times",     group: "config" },
  { key: "membros",   label: "Membros",      icon: User,            path: "/rdm/membros",   group: "config" },
  { key: "perfis",    label: "Perfis (RBAC)", icon: ShieldCheck,    path: "/rdm/perfis",    group: "config" },
];

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
          <DropdownMenuItem key={team.id} onClick={() => setCurrentTeamId(team.id)}
            className="text-xs gap-2 justify-between cursor-pointer">
            <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{team.name}</span>
            {team.id === currentTeamId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavItemButton({ item, isActive, collapsed, onNavigate }: {
  item: NavItem; isActive: boolean; collapsed: boolean; onNavigate?: (key: string) => void;
}) {
  const navigate = useNavigate();
  const Icon = item.icon;
  const handleClick = () => onNavigate ? onNavigate(item.key) : navigate(item.path);

  const btn = (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-center rounded-lg transition-all duration-200 relative group focus-visible:ring-2 focus-visible:ring-indigo-400",
        collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-2.5 px-3 h-9",
        isActive && "shadow-md shadow-indigo-900/40",
      )}
      style={{
        color:      isActive ? "#ffffff" : SB.fg,
        background: isActive ? SB.active : "transparent",
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = SB.acc; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
    >
      {isActive && !collapsed && (
        <span className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white" />
      )}
      <Icon className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-[14px] w-[14px]")}
        style={{ color: isActive ? "#ffffff" : SB.muted }} />
      {!collapsed && (
        <span className="text-[13px] font-medium truncate flex-1 text-left leading-none">{item.label}</span>
      )}
      {isActive && collapsed && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white" />
      )}
    </button>
  );

  if (collapsed) return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
    </Tooltip>
  );
  return btn;
}

function SidebarNav({ module, activeKey, collapsed, onNavigate }: {
  module: ActiveModule; activeKey?: string; collapsed: boolean; onNavigate?: (key: string) => void;
}) {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const items = module === "sala_agil" ? NAV_SALA_AGIL : module === "sustentacao" ? NAV_SUSTENTACAO : NAV_RDM;

  const filteredItems = items.filter((item) => !item.roles || item.roles.some((r) => hasPermission(r as any)));
  const groupOrder = (["sprints", "cerimonias", "operacoes", "org", "config"] as const)
    .filter((g) => filteredItems.some((i) => i.group === g));
  const groups = groupOrder.map((g) => ({ group: g, items: filteredItems.filter((i) => i.group === g) }));

  const isItemActive = (item: NavItem) => {
    if (activeKey) return item.key === activeKey;
    const roots = ["/sala-agil", "/sustentacao", "/rdm"];
    if (item.path === "/okr") return location.pathname === "/okr";
    if (roots.includes(item.path)) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-3 scrollbar-none min-h-0">
      {groups.map(({ group, items: groupItems }) => (
        <div key={group}>
          {!collapsed && (
            <p className="px-3 pb-1.5 pt-0.5 text-[9px] font-bold tracking-[0.16em] uppercase select-none" style={{ color: SB.muted }}>
              {GROUP_LABELS[group]}
            </p>
          )}
          {collapsed && group !== "sprints" && <div className="h-px mx-1 my-1" style={{ background: SB.border }} />}
          <div className={cn("space-y-[2px]", collapsed && "flex flex-col items-center")}>
            {groupItems.map((item) => (
              <NavItemButton key={item.key} item={item} isActive={isItemActive(item)} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
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
    try { sessionStorage.setItem("theme", isDark ? "dark" : "light"); } catch {}
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

function Topbar({ module, activeKey, onOpenMobile }: { module: ActiveModule; activeKey?: string; onOpenMobile: () => void }) {
  const { activeSprint } = useSprint();
  const location = useLocation();
  const accent = ACCENT[module];
  const items = module === "sala_agil" ? NAV_SALA_AGIL : module === "sustentacao" ? NAV_SUSTENTACAO : NAV_RDM;

  const activeItem = activeKey
    ? items.find((i) => i.key === activeKey)
    : items.find((i) => {
        const roots = ["/sala-agil", "/sustentacao", "/rdm"];
        if (i.path === "/okr") return location.pathname === "/okr";
        if (roots.includes(i.path)) return location.pathname === i.path;
        return location.pathname.startsWith(i.path);
      });

  const pageLabel = activeItem?.label ?? "Dashboard";
  const Icon = activeItem?.icon;

  return (
    <header className="sticky top-0 z-20 h-14 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 border-b border-border overflow-hidden bg-card/80 backdrop-blur-md">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={onOpenMobile}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted lg:hidden"
          aria-label="Abrir navegação"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="font-display text-[13px] text-muted-foreground font-bold hidden sm:block shrink-0">{accent.label}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 hidden sm:block shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", accent.textCls)} />}
          <span className="font-display text-[13px] font-bold text-foreground truncate">{pageLabel}</span>
        </div>
      </div>
      <button className="hidden h-9 min-w-[180px] items-center justify-between rounded-lg bg-muted/60 px-3 text-left text-xs text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:flex lg:min-w-[260px]">
        <span className="flex items-center gap-2"><Search className="h-3.5 w-3.5" />Search...</span>
        <span className="font-mono text-[10px]">⌘K</span>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        {module === "sala_agil" && activeSprint && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold border shrink-0"
            style={{ backgroundColor: accent.hexAlpha(0.12), color: accent.hex, borderColor: accent.hexAlpha(0.25) }}>
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
    <div className="sticky top-14 z-10 border-b border-indigo-500/10 bg-indigo-600/[0.06] px-4 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-display font-bold text-indigo-700 dark:text-indigo-300">Sprint ativa</span>
          <span className="truncate font-semibold text-foreground">{activeSprint.name}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="font-mono font-semibold text-indigo-600">{progress}%</span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-indigo-500/12">
          <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-muted-foreground">{sprintHUs.length} HUs</span>
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

export function AppShell({ module, children, activeKey, onNavigate }: AppShellProps) {
  const { profile, isAdmin, signOut, isSigningOut } = useAuth();
  const { isPlatformAdmin, isOrganizationAdmin, hasModuleAccess } = useOrganization();
  const location = useLocation();
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
          style={{ background: SB.bg, borderColor: SB.border, boxShadow: "2px 0 24px rgba(15,23,42,0.28)" }}>
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
          <SidebarNav module={module} activeKey={activeKey} collapsed={collapsed} onNavigate={onNavigate} />

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
          <Topbar module={module} activeKey={activeKey} onOpenMobile={() => setMobileOpen(true)} />
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
