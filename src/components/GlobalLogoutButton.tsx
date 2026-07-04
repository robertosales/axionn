import { LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function GlobalLogoutButton() {
  const location = useLocation();
  const { session, signOut } = useAuth();

  if (!session || location.pathname.startsWith("/organization/")) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="fixed right-[19.25rem] top-2 z-[71] hidden h-8 bg-background/95 shadow-sm backdrop-blur sm:flex"
      onClick={signOut}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sair
    </Button>
  );
}
