import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge }   from "@/components/ui/badge";
import { Button }  from "@/components/ui/button";
import { Switch }  from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal, Pencil, ShieldCheck, ShieldOff, KeyRound,
  Zap, Shield, FileText,
} from "lucide-react";
import { getRoleLabel } from "@/hooks/usePermissions";
import type { UserAdmin } from "../hooks/useUsersAdmin";

interface Props {
  users:           UserAdmin[];
  onEdit:          (user: UserAdmin) => void;
  onToggleAdmin:   (userId: string, isAdmin: boolean)  => Promise<boolean>;
  onToggleActive:  (userId: string, active: boolean)   => Promise<boolean>;
  onResetPassword: (email: string)                     => Promise<boolean>;
}

const MODULE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  sala_agil:   { icon: Zap,      color: "text-blue-400",    label: "Sala Ágil"   },
  sustentacao: { icon: Shield,   color: "text-emerald-400", label: "Sustentação" },
  rdm:         { icon: FileText, color: "text-purple-400",  label: "RDM"         },
};

export function UsersTable({
  users, onEdit, onToggleAdmin, onToggleActive, onResetPassword,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Times</TableHead>
          <TableHead>Módulos & Perfis</TableHead>
          <TableHead className="text-center">Admin</TableHead>
          <TableHead className="text-center">Ativo</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              Nenhum usuário encontrado.
            </TableCell>
          </TableRow>
        )}
        {users.map(u => (
          <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>

            {/* Nome */}
            <TableCell className="font-medium">
              <div className="flex items-center gap-1.5">
                {u.display_name}
                {u.must_change_password && (
                  <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-500">
                    troca senha
                  </Badge>
                )}
              </div>
            </TableCell>

            {/* E-mail */}
            <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>

            {/* Times */}
            <TableCell>
              {u.teams.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {u.teams.map(t => (
                    <Badge key={t.id} variant="outline" className="text-[10px] font-normal">
                      {t.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">sem time</span>
              )}
            </TableCell>

            {/* Módulos & Perfis — NOVO: tags modulo:perfil coloridas */}
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {u.module_roles.map(mr => {
                  const meta = MODULE_META[mr.module];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <Badge
                      key={`${mr.module}-${mr.role_name}`}
                      variant="outline"
                      className={`gap-1 text-[10px] font-normal ${meta.color} border-current`}
                      title={`${meta.label}: ${getRoleLabel(mr.role_name)}`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {getRoleLabel(mr.role_name)}
                    </Badge>
                  );
                })}
                {u.module_roles.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">sem módulo</span>
                )}
              </div>
            </TableCell>

            {/* Admin */}
            <TableCell className="text-center">
              <Switch
                checked={u.is_admin}
                aria-label={`Alternar administrador para ${u.display_name}`}
                onCheckedChange={v => onToggleAdmin(u.user_id, v)}
                className="scale-75"
              />
            </TableCell>

            {/* Ativo */}
            <TableCell className="text-center">
              <Switch
                checked={u.is_active}
                aria-label={`Alternar status ativo para ${u.display_name}`}
                onCheckedChange={v => onToggleActive(u.user_id, v)}
                className="scale-75"
              />
            </TableCell>

            {/* Ações */}
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Ações de ${u.display_name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(u)} className="gap-2">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onResetPassword(u.email)} className="gap-2">
                    <KeyRound className="h-3.5 w-3.5" /> Resetar senha
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onToggleAdmin(u.user_id, !u.is_admin)}
                    className="gap-2"
                  >
                    {u.is_admin
                      ? <ShieldOff  className="h-3.5 w-3.5" />
                      : <ShieldCheck className="h-3.5 w-3.5" />}
                    {u.is_admin ? "Remover admin" : "Promover a admin"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
