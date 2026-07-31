import { lazy, Suspense } from "react";
import { KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RbacProfilesManager } from "@/features/rbac/components/RbacProfilesManager";

const UserRolesManager = lazy(() =>
  import("@/components/UserRolesManager").then((module) => ({
    default: module.UserRolesManager,
  })),
);

export default function RbacWorkspace() {
  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 pb-10" id="rbac-main-content">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Perfis e permissões
              </h1>
              <Badge variant="secondary" className="h-6">
                RBAC
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Defina responsabilidades, controle privilégios e acompanhe quem pode acessar cada recurso do Axionn.
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="profiles" className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-12 min-w-max rounded-xl bg-muted/70 p-1">
            <TabsTrigger value="profiles" className="h-10 gap-2 rounded-lg px-4">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Perfis de acesso
            </TabsTrigger>
            <TabsTrigger value="assignments" className="h-10 gap-2 rounded-lg px-4">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              Atribuições
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profiles" className="mt-0 focus-visible:outline-none">
          <RbacProfilesManager />
        </TabsContent>

        <TabsContent value="assignments" className="mt-0 focus-visible:outline-none">
          <Suspense fallback={<AssignmentsSkeleton />}>
            <UserRolesManager />
          </Suspense>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function AssignmentsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando atribuições">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

