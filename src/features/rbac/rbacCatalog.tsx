import type { ComponentType } from "react";
import {
  Blocks,
  BookOpenCheck,
  Bot,
  BriefcaseBusiness,
  Bug,
  ChartNoAxesCombined,
  CircleGauge,
  Code2,
  Crown,
  FileCheck2,
  FolderKanban,
  Headphones,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import type {
  RbacModuleKey,
  RbacProfileCategory,
  RbacProfileDraft,
} from "@/features/rbac/types";

export const RBAC_MODULES: Array<{
  key: RbacModuleKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    key: "sala_agil",
    label: "Sala Ágil",
    description: "Dashboard, projetos, sprints, backlog, qualidade e relatórios.",
    icon: Zap,
  },
  {
    key: "sustentacao",
    label: "Sustentação",
    description: "Demandas, SLAs, filas, atendimento e operação de suporte.",
    icon: Headphones,
  },
  {
    key: "rdm",
    label: "RDM",
    description: "Mudanças, aprovações, execução e governança operacional.",
    icon: FileCheck2,
  },
];

export const RBAC_CATEGORIES: Array<{
  value: RbacProfileCategory;
  label: string;
}> = [
  { value: "governance", label: "Governança" },
  { value: "delivery", label: "Entrega" },
  { value: "quality", label: "Qualidade" },
  { value: "support", label: "Suporte" },
  { value: "custom", label: "Personalizado" },
];

export const RBAC_COLORS: Array<{
  value: string;
  label: string;
  swatchClass: string;
  surfaceClass: string;
  iconClass: string;
}> = [
  {
    value: "violet",
    label: "Violeta",
    swatchClass: "bg-violet-600",
    surfaceClass: "border-violet-300/70 bg-violet-500/10 dark:border-violet-700/70",
    iconClass: "text-violet-700 dark:text-violet-300",
  },
  {
    value: "blue",
    label: "Azul",
    swatchClass: "bg-blue-600",
    surfaceClass: "border-blue-300/70 bg-blue-500/10 dark:border-blue-700/70",
    iconClass: "text-blue-700 dark:text-blue-300",
  },
  {
    value: "cyan",
    label: "Ciano",
    swatchClass: "bg-cyan-600",
    surfaceClass: "border-cyan-300/70 bg-cyan-500/10 dark:border-cyan-700/70",
    iconClass: "text-cyan-700 dark:text-cyan-300",
  },
  {
    value: "emerald",
    label: "Esmeralda",
    swatchClass: "bg-emerald-600",
    surfaceClass: "border-emerald-300/70 bg-emerald-500/10 dark:border-emerald-700/70",
    iconClass: "text-emerald-700 dark:text-emerald-300",
  },
  {
    value: "amber",
    label: "Âmbar",
    swatchClass: "bg-amber-500",
    surfaceClass: "border-amber-300/70 bg-amber-500/10 dark:border-amber-700/70",
    iconClass: "text-amber-700 dark:text-amber-300",
  },
  {
    value: "rose",
    label: "Rosa",
    swatchClass: "bg-rose-600",
    surfaceClass: "border-rose-300/70 bg-rose-500/10 dark:border-rose-700/70",
    iconClass: "text-rose-700 dark:text-rose-300",
  },
];

export const RBAC_ICONS: Array<{
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "shield-check", label: "Escudo", icon: ShieldCheck },
  { value: "crown", label: "Coroa", icon: Crown },
  { value: "code", label: "Código", icon: Code2 },
  { value: "target", label: "Alvo", icon: Target },
  { value: "bug", label: "Qualidade", icon: Bug },
  { value: "headphones", label: "Suporte", icon: Headphones },
  { value: "folder-kanban", label: "Projeto", icon: FolderKanban },
  { value: "workflow", label: "Fluxo", icon: Workflow },
  { value: "users", label: "Pessoas", icon: UsersRound },
  { value: "key-round", label: "Acesso", icon: KeyRound },
  { value: "sparkles", label: "Especial", icon: Sparkles },
  { value: "briefcase", label: "Gestão", icon: BriefcaseBusiness },
];

export const RBAC_PERMISSION_GROUPS: Record<
  string,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  dashboard: { label: "Dashboard executivo", icon: LayoutDashboard },
  projects: { label: "Projetos e portfólio", icon: BriefcaseBusiness },
  kanban: { label: "Kanban e fluxo", icon: FolderKanban },
  backlog: { label: "Backlog e épicos", icon: ListChecks },
  sprint: { label: "Sprints e cerimônias", icon: Target },
  okr: { label: "OKRs", icon: CircleGauge },
  quality: { label: "Qualidade", icon: Bug },
  reports: { label: "Relatórios e exportações", icon: ChartNoAxesCombined },
  people: { label: "Usuários, times e perfis", icon: UsersRound },
  automation: { label: "Automações e integrações", icon: Bot },
  sustentacao: { label: "Sustentação e SLAs", icon: Wrench },
  rdm: { label: "RDM e aprovações", icon: FileCheck2 },
  settings: { label: "Configurações", icon: Settings2 },
  general: { label: "Permissões gerais", icon: Blocks },
  history: { label: "Histórico e auditoria", icon: BookOpenCheck },
};

export function getRbacColor(colorToken: string) {
  return RBAC_COLORS.find((color) => color.value === colorToken) ?? RBAC_COLORS[0];
}

export function getRbacIcon(iconName: string) {
  return RBAC_ICONS.find((entry) => entry.value === iconName)?.icon ?? ShieldCheck;
}

export function getRbacCategoryLabel(category: string) {
  return RBAC_CATEGORIES.find((entry) => entry.value === category)?.label ?? "Personalizado";
}

export function emptyRbacDraft(): RbacProfileDraft {
  return {
    profileKey: null,
    displayName: "",
    description: "",
    category: "custom",
    colorToken: "violet",
    iconName: "shield-check",
    moduleKeys: [],
    permissionKeys: [],
  };
}
