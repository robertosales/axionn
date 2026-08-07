import {
  Archive,
  Copy,
  MoreHorizontal,
  PencilLine,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getRbacCategoryLabel,
  getRbacColor,
  getRbacIcon,
  RBAC_MODULES,
} from "@/features/rbac/rbacCatalog";
import type { RbacProfile } from "@/features/rbac/types";

interface RbacProfileCardProps {
  profile: RbacProfile;
  highlighted?: boolean;
  onView: (profile: RbacProfile) => void;
  onEdit: (profile: RbacProfile) => void;
  onDuplicate: (profile: RbacProfile) => void;
  onArchive: (profile: RbacProfile) => void;
}

export function RbacProfileCard({
  profile,
  highlighted = false,
  onView,
  onEdit,
  onDuplicate,
  onArchive,
}: RbacProfileCardProps) {
  const color = getRbacColor(profile.colorToken);
  const Icon = getRbacIcon(profile.iconName);

  return (
    <article
      className={cn(
        "group flex min-h-[272px] flex-col rounded-2xl border bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md motion-reduce:hover:translate-y-0",
        highlighted && "border-primary ring-2 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
            color.surfaceClass,
          )}
          aria-hidden="true"
        >
          <Icon className={cn("h-5 w-5", color.iconClass)} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-muted-foreground"
              aria-label={`Mais ações para ${profile.displayName}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!profile.isSystem && (
              <DropdownMenuItem onClick={() => onEdit(profile)}>
                <PencilLine className="mr-2 h-4 w-4" />
                Editar perfil
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDuplicate(profile)}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicar como novo
            </DropdownMenuItem>
            {!profile.isSystem && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={profile.userCount > 0}
                  onClick={() => onArchive(profile)}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {profile.userCount > 0 ? "Perfil em uso" : "Arquivar perfil"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold leading-6 text-foreground">
            {profile.displayName}
          </h3>
          <Badge variant={profile.isSystem ? "secondary" : "outline"}>
            {profile.isSystem ? "Nativo" : "Personalizado"}
          </Badge>
        </div>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {getRbacCategoryLabel(profile.category)}
        </p>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {profile.description || "Perfil sem descrição."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Módulos do perfil">
        {profile.moduleKeys.map((moduleKey) => {
          const module = RBAC_MODULES.find((entry) => entry.key === moduleKey);
          return module ? (
            <Badge key={moduleKey} variant="outline" className="font-normal">
              {module.label}
            </Badge>
          ) : null;
        })}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-foreground tabular-nums">
              {profile.permissionCount}
            </strong>{" "}
            permissões
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 text-muted-foreground">
          <UsersRound className="h-4 w-4" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-foreground tabular-nums">
              {profile.userCount}
            </strong>{" "}
            usuários
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-3 h-11 w-full justify-center"
        onClick={() => onView(profile)}
      >
        Ver detalhes
      </Button>
    </article>
  );
}
