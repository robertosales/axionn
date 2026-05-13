import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, ShieldCheck, ShieldOff, KeyRound, Zap, Shield } from "lucide-react";
import type { UserAdmin } from "../hooks/useUsersAdmin";

interface Props {
  users: UserAdmin[];
  onEdit: (user: UserAdmin) => void;
  onToggleAdmin: (userId: string, isAdmin: boolean) => Promise<boolean>;
  onToggleActive: (userId: string, active: boolean) => Promise<boolean>;
  onResetPassword: (email: string) => Promise<boolean>;
}

export function UsersTable({ users, onEdit, onToggleAdmin, onToggleActive, onResetPassword }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Módulo</TableHead>
          <TableHead className="text-center">Admin</TableHead>
          <TableHead className="text-center">Ativo</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 && (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
        )}
        {users.map(u => (
          <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-1.5">
                {u.display_name}
                {u.must_change_password && <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-500">troca senha</Badge>}
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
            <TableCell>
              {u.team_name
                ? <span className="text-xs">{u.team_name}</span>
                : <span className="text-xs text-muted-foreground italic">sem time</span>}
            </TableCell>
            <TableCell>
              <Badge variant={u.module_access === "sala_agil" ? "default" : u.module_access === "admin" ? "destructive" : "secondary"} className="gap-1 text-[10px]">
                {u.module_access === "sala_agil" ? <Zap className="h-3 w-3" /> : u.module_access === "sustentacao" ? <Shield className="h-3 w-3" /> : null}
                {u.module_access === "sala_agil" ? "Sala Ágil" : u.module_access === "sustentacao" ? "Sustentação" : "Admin"}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Switch
                checked={u.is_admin}
                onCheckedChange={v => onToggleAdmin(u.user_id, v)}
                className="scale-75"
              />
            </TableCell>
            <TableCell className="text-center">
              <Switch
                checked={u.is_active}
                onCheckedChange={v => onToggleActive(u.user_id, v)}
                className="scale-75"
              />
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
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
                  <DropdownMenuItem onClick={() => onToggleAdmin(u.user_id, !u.is_admin)} className="gap-2">
                    {u.is_admin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
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
