import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Building2,
  Calendar,
  CheckSquare,
  ClipboardList,
  ClipboardCheck,
  FileText,
  GitBranch,
  History,
  Home,
  Kanban,
  Layers,
  LayoutDashboard,
  ListTodo,
  Repeat,
  Settings,
  ShieldCheck,
  SquareStack,
  Sparkles,
  Target,
  User,
  Users,
  Upload,
} from "lucide-react";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
  children?: NavigationItem[];
  permissions?: string[];
  contextualActions?: Array<{ id: string; label: string; route: string }>;
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
}

export const navigationConfig: NavigationSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "home",
        label: "Início",
        icon: Home,
        route: "/",
      },
      {
        id: "organization-admin",
        label: "Administração",
        icon: Building2,
        route: "/organization/admin",
      },
    ],
  },
  {
    id: "operations",
    label: "Operações",
    items: [
      {
        id: "gitlab-integrations",
        label: "GitLab Integrations",
        icon: GitBranch,
        route: "/organization/gitlab-integrations",
        contextualActions: [
          { id: "events", label: "Eventos", route: "/organization/gitlab-integrations" },
        ],
      },
      {
        id: "contracts",
        label: "Contratos",
        icon: FileText,
        route: "/organization/contracts",
      },
      {
        id: "teams",
        label: "Times",
        icon: Users,
        route: "/organization/teams",
      },
    ],
  },
  {
    id: "platform",
    label: "Plataforma",
    items: [
      {
        id: "platform-plans",
        label: "Planos",
        icon: LayoutDashboard,
        route: "/platform/plans",
      },
      {
        id: "platform-subscriptions",
        label: "Assinaturas",
        icon: ArrowLeftRight,
        route: "/platform/subscriptions",
      },
      {
        id: "security",
        label: "Segurança",
        icon: ShieldCheck,
        route: "/platform/ai-providers",
      },
    ],
  },
];

export function buildBreadcrumbs(pathname: string, config: NavigationSection[]): Array<{ label: string; path: string }> {
  const candidates = config
    .flatMap((section) => section.items)
    .filter((item) => item.route === pathname || pathname.startsWith(`${item.route}/`));

  if (candidates.length === 0) {
    return [];
  }

  const match = candidates.reduce((best, item) =>
    item.route.length > best.route.length ? item : best,
  );

  const fallback = match.route === "/organization/gitlab-integrations"
    ? [{ label: "Organização", path: "/organization" }, { label: match.label, path: match.route }]
    : [{ label: match.label, path: match.route }];

  return fallback;
}

export const salaAgilNavigationConfig: NavigationSection[] = [
  ...(QUALITY_MANAGEMENT_ENABLED ? [{
    id: "sala-agil-quality",
    label: "Qualidade",
    items: [
      { id: "quality-cases", label: "Casos de Teste", icon: ClipboardCheck, route: "/sala-agil/qualidade/casos" },
      { id: "quality-suites", label: "Suítes", icon: Layers, route: "/sala-agil/qualidade/suites" },
      { id: "quality-plans", label: "Planos", icon: ClipboardList, route: "/sala-agil/qualidade/planos" },
      { id: "quality-runs", label: "Execuções", icon: Play, route: "/sala-agil/qualidade/execucoes" },
    ],
  }] : []),
  {
    id: "sala-agil-sprints",
    label: "Sprints",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, route: "/sala-agil/dashboard" },
      { id: "board", label: "Board Kanban", icon: Kanban, route: "/sala-agil/board" },
      { id: "backlog", label: "Backlog", icon: ListTodo, route: "/sala-agil/backlog" },
      { id: "epicos", label: "Épicos", icon: Layers, route: "/sala-agil/epicos" },
    ],
  },
  {
    id: "sala-agil-cerimonias",
    label: "Cerimônias",
    items: [
      { id: "planning-poker", label: "Planning Poker", icon: SquareStack, route: "/sala-agil/planning-poker" },
      { id: "retrospectiva", label: "Retrospectiva", icon: Repeat, route: "/sala-agil/retrospectiva" },
      { id: "briefing", label: "Briefing IA", icon: Sparkles, route: "/sala-agil/briefing" },
      { id: "impedimentos", label: "Impedimentos", icon: AlertTriangle, route: "/sala-agil/impedimentos" },
    ],
  },
  {
    id: "sala-agil-operacoes",
    label: "Operações",
    items: [
      { id: "calendario", label: "Calendário", icon: Calendar, route: "/sala-agil/calendario" },
      { id: "equipe", label: "Equipe", icon: Users, route: "/sala-agil/equipe" },
      { id: "atividades", label: "Atividades", icon: Activity, route: "/sala-agil/atividades" },
    ],
  },
  {
    id: "sala-agil-relatorios",
    label: "Relatórios",
    items: [
      { id: "metricas", label: "Métricas", icon: BarChart3, route: "/sala-agil/metricas" },
      { id: "relatorios", label: "Relatórios", icon: FileText, route: "/sala-agil/relatorios" },
      { id: "historico", label: "Histórico", icon: History, route: "/sala-agil/historico" },
      { id: "okr", label: "OKR", icon: Target, route: "/okr" },
    ],
  },
  {
    id: "sala-agil-config",
    label: "Configurações",
    items: [
      { id: "times", label: "Times", icon: Users, route: "/sala-agil/times" },
      { id: "membros", label: "Membros", icon: User, route: "/sala-agil/membros" },
      { id: "perfis", label: "Perfis (RBAC)", icon: ShieldCheck, route: "/sala-agil/perfis" },
      { id: "fluxo", label: "Fluxo", icon: GitBranch, route: "/sala-agil/fluxo" },
      { id: "campos", label: "Campos Custom", icon: Settings, route: "/sala-agil/campos" },
      { id: "automacoes", label: "Automações", icon: Repeat, route: "/sala-agil/automacoes" },
    ],
  },
];

export const sustentacaoNavigationConfig: NavigationSection[] = [
  {
    id: "sustentacao-sprints",
    label: "Sprints",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, route: "/sustentacao/dashboard" },
      { id: "board", label: "Board Kanban", icon: Kanban, route: "/sustentacao/board" },
      { id: "demandas", label: "Demandas", icon: ListTodo, route: "/sustentacao/demandas" },
    ],
  },
  {
    id: "sustentacao-operacoes",
    label: "Operações",
    items: [
      { id: "importacao", label: "Importação Excel", icon: Upload, route: "/sustentacao/importacao" },
      { id: "equipe", label: "Equipe", icon: Users, route: "/sustentacao/equipe" },
      { id: "fluxo", label: "Fluxo de Trabalho", icon: GitBranch, route: "/sustentacao/fluxo" },
    ],
  },
  {
    id: "sustentacao-relatorios",
    label: "Relatórios",
    items: [
      { id: "relatorios", label: "Relatórios", icon: FileText, route: "/sustentacao/relatorios" },
    ],
  },
  {
    id: "sustentacao-config",
    label: "Configurações",
    items: [
      { id: "times", label: "Times", icon: Users, route: "/sustentacao/times" },
      { id: "membros", label: "Membros", icon: User, route: "/sustentacao/membros" },
      { id: "perfis", label: "Perfis (RBAC)", icon: ShieldCheck, route: "/sustentacao/perfis" },
      { id: "campos", label: "Campos Custom", icon: Settings, route: "/sustentacao/campos" },
      { id: "automacoes", label: "Automações", icon: Repeat, route: "/sustentacao/automacoes" },
    ],
  },
];

export const rdmNavigationConfig: NavigationSection[] = [
  {
    id: "rdm-sprints",
    label: "Sprints",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, route: "/rdm/dashboard" },
      { id: "rdms", label: "RDMs", icon: ClipboardList, route: "/rdm/rdms" },
      { id: "checklist", label: "Checklists", icon: CheckSquare, route: "/rdm/checklist" },
      { id: "gonogo", label: "Go/No-Go", icon: ArrowLeftRight, route: "/rdm/gonogo" },
    ],
  },
  {
    id: "rdm-config",
    label: "Configurações",
    items: [
      { id: "times", label: "Times", icon: Users, route: "/rdm/times" },
      { id: "membros", label: "Membros", icon: User, route: "/rdm/membros" },
      { id: "perfis", label: "Perfis (RBAC)", icon: ShieldCheck, route: "/rdm/perfis" },
    ],
  },
];
