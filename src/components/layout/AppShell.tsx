import { useNavigate, useLocation } from "react-router-dom";
import { getInitials } from "@/lib/personName";
import { useAuth } from "@/contexts/AuthContext";
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
  ChevronRight, Building2, ChevronsUpDown, Check, PanelLeftClose,
  PanelLeftOpen, Sun, Moon, ClipboardList, CheckSquare, ArrowLeftRight,
  Target,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { AxionLogo } from "@/components/AxionLogo";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const SB = {
  bg:       "#0f1a18",
  fg:       "#c0d4d0",
  muted:    "#3d5a56",
  acc:      "#182e2a",
  active:   "#0c3d38",
  teal:     "#0bbcaf",
  border:   "rgba(192,212,208,0.08)",
  tealA:    (a: number) => `rgba(11,188,175,${a})`,
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

const NAV_SUSTENTACAO: NavItem[] = [
  { key: "dashboard",  label: "Dashboard",        icon: LayoutDashboard, path: "/sustentacao",            group: "sprints" },
  { key: "board",      label: "Board Kanban",     icon: Kanban,          path: "/sustentacao/board",      group: "sprints" },
  { key: "demandas",   label: "Demandas",         icon: ListTodo,        path: "/sustentacao/demandas",   group: "sprints" },
  { key: "projetos",   label: "Projetos",         icon: Layers,          path: "/sustentacao/projetos",   group: "sprints" },
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
  sala_agil:   { hex: "#0bbcaf", hexAlpha: (a: number) => `rgba(11,188,175,${a})`,  avatarBg: "#0a8f85",  label: "Sala Ágil",    icon: Zap,          textCls: "text-[#0bbcaf]", bgCls: "bg-[rgba(11,188,175,0.12)]" },
  sustentacao: { hex: "#d97706", hexAlpha: (a: number) => `rgba(217,119,6,${a})`,   avatarBg: "#b45309",  label: "Sustentação",  icon: Wrench,       textCls: "text-amber-500", bgCls: "bg-amber-500/10" },
  rdm:         { hex: "#7c3aed", hexAlpha: (a: number) => `rgba(124,58,237,${a})`,  avatarBg: "#6d28d9",  label: "RDM",          icon: ClipboardList, textCls: "text-violet-500", bgCls: "bg-violet-500/10" },
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
        "w-full flex items-center rounded-md transition-all duration-150 relative",
        collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-3 py-[7px]",
      )}
      style={{
        color:      isActive ? "#ffffff" : SB.fg,
        background: isActive ? SB.active : "transparent",
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = SB.acc; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
          style={{ background: SB.teal }} />
      )}
      <Icon className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-[14px] w-[14px]")}
        style={{ color: isActive ? SB.teal : SB.muted }} />
      {!collapsed && (
        <span className="text-[13px] font-medium truncate flex-1 text-left leading-none">{item.label}</span>
      )}
      {isActive && collapsed && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: SB.teal }} />
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

function ModuleSwitcher({ module, collapsed }: { module: ActiveModule; collapsed: boolean }) {
  const navigate = useNavigate();
  const modules = [
    { key: "sala_agil"   as ActiveModule, path: "/sala-agil",  label: "Ágil",  Icon: Zap },
    { key: "sustentacao" as ActiveModule, path: "/sustentacao", label: "Sust.", Icon: Wrench },
    { key: "rdm"         as ActiveModule, path: "/rdm",         label: "RDM",   Icon: ClipboardList },
  ];

  if (collapsed) return (
    <div className="flex flex-col items-center gap-1 w-full px-2 py-1">
      {modules.map(({ key, path, label, Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <button onClick={() => navigate(path)} className="flex w-full items-center justify-center rounded-md p-2 transition-all"
              style={{ color: module === key ? SB.teal : SB.muted, background: module === key ? SB.active : "transparent" }}
              onMouseEnter={e => { if (module !== key) e.currentTarget.style.background = SB.acc; }}
              onMouseLeave={e => { if (module !== key) e.currentTarget.style.background = "transparent"; }}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );

  return (
    <div className="flex items-stretch" style={{ borderBottom: `1px solid ${SB.border}` }}>
      {modules.map(({ key, path, label, Icon }) => {
        const isActive = module === key;
        return (
          <button key={key} onClick={() => navigate(path)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-all relative"
            style={{ color: isActive ? SB.teal : SB.muted, background: isActive ? SB.active : "transparent" }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = SB.acc; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
            <Icon className="h-3 w-3 shrink-0" />
            {label}
            {isActive && <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: SB.teal }} />}
          </button>
        );
      })}
    </div>
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

function Topbar({ module, activeKey }: { module: ActiveModule; activeKey?: string }) {
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
    <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-[11px] text-muted-foreground font-medium hidden sm:block shrink-0">{accent.label}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 hidden sm:block shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", accent.textCls)} />}
          <span className="text-[13px] font-semibold text-foreground truncate">{pageLabel}</span>
        </div>
      </div>
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

export function AppShell({ module, children, activeKey, onNavigate }: AppShellProps) {
  const { profile, isAdmin, signOut, isSigningOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const moduleAccess = profile?.module_access ?? "sala_agil";
  const canSwitch = isAdmin || moduleAccess === "admin";
  const accent = ACCENT[module];
  const userInitials = getInitials(profile?.full_name ?? profile?.display_name ?? "U");
  const sidebarWidth = collapsed ? "w-[56px]" : "w-[220px]";

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
  };

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-screen w-screen overflow-hidden bg-background" data-module={module}>
        <aside className={cn("flex flex-col h-full shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden", sidebarWidth)}
          style={{ background: SB.bg, boxShadow: "2px 0 16px rgba(0,0,0,0.4)" }}>
          <div className={cn("flex items-center h-14 shrink-0 px-3", collapsed ? "justify-center" : "justify-between")}
            style={{ borderBottom: `1px solid ${SB.border}` }}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setCollapsed(false)} aria-label="Expandir sidebar"
                    className="flex items-center justify-center rounded-md transition-colors"
                    style={{ color: SB.muted }}
                    onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Expandir</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <AxionLogo size={24} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-none tracking-tight" style={{ color: "#ffffff" }}>Axion</p>
                    <p className="text-[9px] uppercase tracking-widest leading-none mt-0.5" style={{ color: SB.teal }}>{accent.label}</p>
                  </div>
                </div>
                <button onClick={() => setCollapsed(true)} aria-label="Recolher sidebar"
                  className="flex h-6 w-6 items-center justify-center rounded-md shrink-0 transition-colors"
                  style={{ color: SB.muted }}
                  onMouseEnter={e => (e.currentTarget.style.background = SB.acc)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {canSwitch && <div className="shrink-0"><ModuleSwitcher module={module} collapsed={collapsed} /></div>}
          {!canSwitch && !collapsed && (
            <div className="mx-2 mt-2 flex items-center rounded-lg px-3 py-2 text-[12px] font-semibold gap-2" style={{ background: SB.active, color: SB.teal }}>
              <accent.icon className="h-3.5 w-3.5 shrink-0" />
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
          <Topbar module={module} activeKey={activeKey} />
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
