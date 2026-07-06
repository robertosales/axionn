import { ChevronDown, Loader2, LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/shared/components/common/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserAccountMenuProps {
  variant?: "floating" | "inline";
}

export function UserAccountMenu({ variant = "floating" }: UserAccountMenuProps) {
  const location = useLocation();
  const { session, profile, signOut, isSigningOut } = useAuth();

  if (!session) return null;
  if (
    variant === "floating" &&
    (location.pathname === "/modulos" || location.pathname.startsWith("/organization/"))
  ) return null;

  const displayName = profile?.display_name || profile?.full_name || "Usuário";
  const triggerClass = variant === "inline"
    ? "flex h-10 max-w-[220px] items-center gap-2 rounded-xl border bg-background px-2.5 text-sm shadow-sm hover:bg-accent"
    : "fixed right-[19.25rem] top-2 z-[71] hidden h-8 max-w-[180px] items-center gap-2 rounded-lg border bg-background/95 px-2 text-xs shadow-sm backdrop-blur hover:bg-accent lg:flex";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label="Abrir menu da conta">
          <UserAvatar name={displayName} avatarUrl={profile?.avatar_url} size={variant === "inline" ? "sm" : "xs"} />
          <span className="min-w-0 flex-1 truncate text-left font-medium">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
          {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {isSigningOut ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GlobalLogoutButton() {
  return <UserAccountMenu />;
}
