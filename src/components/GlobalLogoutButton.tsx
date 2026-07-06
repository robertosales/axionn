import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/shared/components/common/UserAvatar";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import {
  hasManagedApplicationChrome,
  isModuleShellRoute,
} from "@/lib/layoutRoutes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserAccountMenuProps {
  variant?: "floating" | "inline" | "compact";
}

export function UserAccountMenu({ variant = "floating" }: UserAccountMenuProps) {
  const location = useLocation();
  const { session, profile, signOut, isSigningOut } = useAuth();

  if (!session) return null;
  if (variant === "floating" && hasManagedApplicationChrome(location.pathname)) {
    return null;
  }

  const displayName = profile?.display_name || profile?.full_name || "Usuário";
  const triggerClass =
    variant === "inline"
      ? "flex h-10 max-w-[220px] items-center gap-2 rounded-xl border bg-background px-2.5 text-sm shadow-sm transition-colors hover:bg-accent"
      : variant === "compact"
        ? "flex h-9 min-w-0 max-w-[170px] items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-2.5 text-xs text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
        : "fixed right-[19.25rem] top-2 z-[71] hidden h-8 max-w-[180px] items-center gap-2 rounded-lg border bg-background/95 px-2 text-xs shadow-sm backdrop-blur hover:bg-accent lg:flex";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label="Abrir menu da conta">
          <UserAvatar
            name={displayName}
            avatarUrl={profile?.avatar_url}
            size={variant === "inline" ? "sm" : "xs"}
          />
          <span className="min-w-0 flex-1 truncate text-left font-medium">
            {displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3 py-1">
            <UserAvatar name={displayName} avatarUrl={profile?.avatar_url} size="md" />
            <p className="truncate text-sm font-semibold">{displayName}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          disabled={isSigningOut}
          onClick={() => void signOut()}
        >
          {isSigningOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {isSigningOut ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PremiumShellHeaderControls({ pathname }: { pathname: string }) {
  const [companyTarget, setCompanyTarget] = useState<HTMLElement | null>(null);
  const [accountTarget, setAccountTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const moduleRoot = document.querySelector<HTMLElement>("[data-module]");
    const header = moduleRoot?.querySelector<HTMLElement>("header");
    const row = header?.firstElementChild as HTMLElement | null;
    const pageContext = row?.firstElementChild as HTMLElement | null;
    const nativeActions = row?.lastElementChild as HTMLElement | null;

    if (!row || !pageContext || !nativeActions) return;

    const companyMount = document.createElement("div");
    companyMount.dataset.premiumCompanyContext = "true";
    companyMount.className =
      "flex min-w-0 max-w-[220px] shrink items-center overflow-hidden";

    const accountMount = document.createElement("div");
    accountMount.dataset.premiumAccountControls = "true";
    accountMount.className = "hidden shrink-0 items-center xl:flex";

    pageContext.classList.add("overflow-hidden");
    pageContext.appendChild(companyMount);
    nativeActions.insertBefore(accountMount, nativeActions.firstChild);

    setCompanyTarget(companyMount);
    setAccountTarget(accountMount);

    return () => {
      setCompanyTarget(null);
      setAccountTarget(null);
      companyMount.remove();
      accountMount.remove();
      pageContext.classList.remove("overflow-hidden");
    };
  }, [pathname]);

  return (
    <>
      {companyTarget &&
        createPortal(
          <OrganizationSwitcher variant="context" />,
          companyTarget,
        )}
      {accountTarget &&
        createPortal(
          <UserAccountMenu variant="compact" />,
          accountTarget,
        )}
    </>
  );
}

export function GlobalLogoutButton() {
  const location = useLocation();

  if (isModuleShellRoute(location.pathname)) {
    return <PremiumShellHeaderControls pathname={location.pathname} />;
  }

  return <UserAccountMenu />;
}
