import { ArrowLeftRight, Building2, FileText, GitBranch, Home, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
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
  const match = config
    .flatMap((section) => section.items)
    .find((item) => item.route === pathname || pathname.startsWith(`${item.route}/`));

  if (!match) {
    return [];
  }

  const fallback = match.route === "/organization/gitlab-integrations"
    ? [{ label: "Organização", path: "/organization" }, { label: match.label, path: match.route }]
    : [{ label: match.label, path: match.route }];

  return fallback;
}
