import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  KeyRound,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RbacProfileCard } from "@/features/rbac/components/RbacProfileCard";
import { RbacProfileWizard } from "@/features/rbac/components/RbacProfileWizard";
import { useRbacProfiles } from "@/features/rbac/hooks/useRbacProfiles";
import { RBAC_CATEGORIES, RBAC_MODULES } from "@/features/rbac/rbacCatalog";
import type {
  RbacModuleKey,
  RbacProfile,
  RbacWizardMode,
} from "@/features/rbac/types";

interface WizardState {
  open: boolean;
  mode: RbacWizardMode;
  profile: RbacProfile | null;
}

const CLOSED_WIZARD: WizardState = {
  open: false,
  mode: "create",
  profile: null,
};

export function RbacProfilesManager() {
  const {
    profiles,
    permissions,
    loading,
    saving,
    error,
    refresh,
    saveProfile,
    archiveProfile,
  } = useRbacProfiles();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [moduleKey, setModuleKey] = useState("all");
  const [wizard, setWizard] = useState<WizardState>(CLOSED_WIZARD);
  const [archiveTarget, setArchiveTarget] = useState<RbacProfile | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return profiles.filter((profile) => {
      const matchesSearch =
        !normalizedSearch ||
        [profile.displayName, profile.description]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch);
      const matchesCategory = category === "all" || profile.category === category;
      const matchesModule =
        moduleKey === "all" ||
        profile.moduleKeys.includes(moduleKey as RbacModuleKey);
      return matchesSearch && matchesCategory && matchesModule;
    });
  }, [category, moduleKey, profiles, search]);

  const metricCards = [
    {
      label: "Perfis ativos",
      value: profiles.length,
      description: "nativos e personalizados",
      icon: ShieldCheck,
    },
    {
      label: "Personalizados",
      value: profiles.filter((profile) => !profile.isSystem).length,
      description: "exclusivos da organização",
      icon: Sparkles,
    },
    {
      label: "Permissões",
      value: permissions.length,
      description: "ações disponíveis no catálogo",
      icon: KeyRound,
    },
    {
      label: "Atribuições",
      value: profiles.reduce((total, profile) => total + profile.userCount, 0),
      description: "vínculos de usuários e módulos",
      icon: UsersRound,
    },
  ];

  function openWizard(mode: RbacWizardMode, profile: RbacProfile | null = null) {
    setWizard({ open: true, mode, profile });
  }

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setModuleKey("all");
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiveError(null);
    try {
      await archiveProfile(archiveTarget);
      setArchiveTarget(null);
    } catch (archiveFailure) {
      console.error("[RbacProfilesManager] archive failed", archiveFailure);
      setArchiveError(
        archiveFailure instanceof Error
          ? archiveFailure.message
          : "Não foi possível arquivar este perfil.",
      );
    }
  }

  if (loading) return <RbacProfilesSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive" role="alert" className="mt-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não foi possível carregar os perfis</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" className="h-10" onClick={() => void refresh()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo dos perfis">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                      {metric.value}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4" aria-label="Filtros dos perfis">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 pl-9 pr-10 text-base sm:text-sm"
              placeholder="Buscar por nome ou descrição"
              aria-label="Buscar perfis"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 w-11"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 min-w-0 sm:w-44" aria-label="Filtrar por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {RBAC_CATEGORIES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={moduleKey} onValueChange={setModuleKey}>
              <SelectTrigger className="h-11 min-w-0 sm:w-44" aria-label="Filtrar por módulo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {RBAC_MODULES.map((module) => (
                  <SelectItem key={module.key} value={module.key}>
                    {module.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="h-11 xl:ml-auto" onClick={() => openWizard("create")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo perfil
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" className="text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground tabular-nums">
            {filteredProfiles.length}
          </strong>{" "}
          {filteredProfiles.length === 1 ? "perfil encontrado" : "perfis encontrados"}
        </div>
        {(search || category !== "all" || moduleKey !== "all") && (
          <Button variant="ghost" size="sm" className="h-10" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {profiles.length === 0 ? (
        <EmptyProfiles onCreate={() => openWizard("create")} />
      ) : filteredProfiles.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
          <Search className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-base font-semibold">Nenhum perfil corresponde aos filtros</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Tente outro termo, categoria ou módulo para ampliar os resultados.
          </p>
          <Button variant="outline" className="mt-4 h-11" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Catálogo de perfis">
          {filteredProfiles.map((profile) => (
            <RbacProfileCard
              key={profile.key}
              profile={profile}
              highlighted={profile.key === highlightedKey}
              onView={(selected) => openWizard("view", selected)}
              onEdit={(selected) => openWizard("edit", selected)}
              onDuplicate={(selected) => openWizard("duplicate", selected)}
              onArchive={setArchiveTarget}
            />
          ))}
        </section>
      )}

      <RbacProfileWizard
        open={wizard.open}
        mode={wizard.mode}
        profile={wizard.profile}
        permissions={permissions}
        saving={saving}
        onClose={() => setWizard(CLOSED_WIZARD)}
        onSave={async (draft) => {
          const savedKey = await saveProfile(draft);
          setHighlightedKey(savedKey);
          window.setTimeout(() => setHighlightedKey(null), 3000);
          return savedKey;
        }}
      />

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
            setArchiveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar {archiveTarget?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              O perfil deixará de aparecer em novas atribuições. Esta ação só é permitida quando não há usuários vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError && (
            <Alert variant="destructive" role="alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Não foi possível arquivar</AlertTitle>
              <AlertDescription>{archiveError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void confirmArchive();
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Arquivar perfil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RbacProfilesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando perfis de acesso">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[272px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function EmptyProfiles({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShieldCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Crie o primeiro perfil de acesso</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        Organize permissões por responsabilidade e simplifique as atribuições de novos usuários.
      </p>
      <Button className="mt-5 h-11" onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Criar perfil
      </Button>
    </div>
  );
}
