import { useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Zap, Shield, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { getInitials, formatPersonName } from "@/lib/personName";
import type { TeamAdmin } from "../hooks/useTeamsAdmin";

interface Member {
  user_id: string;
  display_name: string;
  email: string;
}

interface Props {
  teams: TeamAdmin[];
  onEdit: (team: TeamAdmin) => void;
  onDelete: (id: string) => Promise<boolean>;
}

export function TeamsTable({ teams, onEdit, onDelete }: Props) {
  const [confirmId, setConfirmId]     = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [loadingId, setLoadingId]     = useState<string | null>(null);
  const [membersCache, setMembersCache] = useState<Record<string, Member[]>>({});

  const handleRowClick = useCallback(async (team: TeamAdmin) => {
    if ((team.memberCount ?? 0) === 0) return;

    // recolhe se já expandido
    if (expandedId === team.id) { setExpandedId(null); return; }

    setExpandedId(team.id);

    // cache hit — não faz nova query
    if (membersCache[team.id]) return;

    setLoadingId(team.id);
    try {
      const { data } = await supabase
        .from("team_members")
        .select("user_id, profiles(display_name, email)")
        .eq("team_id", team.id);

      const members: Member[] = (data || []).map((m: any) => ({
        user_id:      m.user_id,
        display_name: m.profiles?.display_name || "—",
        email:        m.profiles?.email || "",
      }));

      // ordena alfabético
      members.sort((a, b) => a.display_name.localeCompare(b.display_name, "pt-BR", { sensitivity: "base" }));

      setMembersCache(prev => ({ ...prev, [team.id]: members }));
    } finally {
      setLoadingId(null);
    }
  }, [expandedId, membersCache]);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Módulo</TableHead>
            <TableHead className="text-center">Membros</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum time cadastrado.</TableCell>
            </TableRow>
          )}

          {teams.map(team => {
            const hasMembros  = (team.memberCount ?? 0) > 0;
            const isExpanded  = expandedId === team.id;
            const isLoading   = loadingId  === team.id;
            const members     = membersCache[team.id] ?? [];

            return (
              <>
                {/* Linha principal */}
                <TableRow
                  key={team.id}
                  className={hasMembros ? "cursor-pointer hover:bg-muted/50 select-none" : ""}
                  onClick={() => handleRowClick(team)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {hasMembros ? (
                        isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {team.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={team.module === "sala_agil" ? "default" : "secondary"} className="gap-1 text-[11px]">
                      {team.module === "sala_agil" ? <Zap className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                      {team.module === "sala_agil" ? "Sala Ágil" : "Sustentação"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={hasMembros ? "font-semibold text-primary" : "text-muted-foreground"}>
                      {team.memberCount ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(team)} className="gap-2">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfirmId(team.id)} className="gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>

                {/* Sub-linha de membros */}
                {isExpanded && (
                  <TableRow key={`${team.id}-members`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={4} className="py-3 px-6">
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando membros...
                        </div>
                      ) : members.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Nenhum membro encontrado.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {members.map(m => (
                            <div key={m.user_id} className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[11px]">
                                {getInitials(m.display_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{formatPersonName(m.display_name)}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!confirmId} onOpenChange={v => { if (!v) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir time?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Times com HUs ou demandas ativas não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => { if (confirmId) { await onDelete(confirmId); setConfirmId(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
