import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { AdminIAsPage } from "@/features/admin/pages/AdminIAsPage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PlatformAIProvidersPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/organization/admin">
              <ArrowLeft className="h-4 w-4" />
              Console
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h1 className="truncate text-sm font-semibold">
                Provedores globais de IA
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Administracao exclusiva da plataforma.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            platform_admin
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <AdminIAsPage />
      </main>
    </div>
  );
}
