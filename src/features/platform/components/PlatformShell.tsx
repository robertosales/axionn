import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, BadgeDollarSign, Building2, ShieldCheck, Sparkles } from "lucide-react";
import { UserAccountMenu } from "@/components/GlobalLogoutButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/platform/plans", label: "Planos", icon: BadgeDollarSign },
  { to: "/platform/subscriptions", label: "Assinaturas", icon: Building2 },
  { to: "/platform/ai-providers", label: "IA global", icon: Sparkles },
] as const;

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/organization/admin">
              <ArrowLeft className="h-4 w-4" />
              Console
            </Link>
          </Button>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <Badge variant="outline" className="hidden gap-1.5 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            platform_admin
          </Badge>
          <UserAccountMenu variant="compact" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-6">{children}</main>
    </div>
  );
}
