/**
 * TeamsTable — Lista expandivel de times
 *
 * fix: corrige join de membros (busca em dois passos: team_members -> profiles)
 * redesign: visual compacto seguindo padrao feature/redesign-ui-admin
 *
 * STYLE GUIDE — TeamsTable:
 *   Header:       bg-muted/60  text-[10px] uppercase tracking-wider py-2
 *   Linhas:       text-xs py-2 hover:bg-muted/30
 *   Badge modulo: text-[9px] px-1.5 py-0
 *   Avatar:       h-6 w-6 rounded-full bg-primary/10 text-[10px] font-bold
 *   Sub-painel:   bg-muted/30 px-6 py-3
 */
import { useState, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal, Pencil, Trash2, Zap,
  Shield, ChevronRight, ChevronDown, Loader2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase }           from "@/integrations/supabase/client";
import { getInitials, formatPersonName } from "@/lib/personName";
import type { TeamAdmin }     from "../hooks/useTeamsAdmin";

interface Member {
  user_id:      string;
  display_name: string;
  email:        string;
}

interface Props {
  teams:    TeamAdmin[];
  onEdit:   (team: TeamAdmin) => void;
  onDelete: (id: string) => Promise<boolean>;
}

export function TeamsTable({ teams, onEdit, onDelete }: Props) {
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [loadingId,    setLoadingId]    = useState<string | null>(null);
  const [membersCache, setMembersCache] = useState<Record<string, Member[]>>({});

  const handleRowClick = useCallback(async (team: TeamAdmin) => {
    // Recolhe se ja expandido
    if (expandedId === team.id) { setExpandedId(null); return; }

    // Expande (mesmo sem membros confirmados — a contagem pode estar desatualizada)
    setExpandedId(team.id);

    // Cache hit — nao refaz query
    if (membersCache[team.id] !== undefined) return;

    setLoadingId(team.id);
    try {
      // Passo 1: busca user_ids do time
      const { data: tmData, error: tmErr } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", team.id);

      if (tmErr) throw tmErr;

      const userIds = (tmData ?? []).map((r: any) => r.user_id).filter(Boolean);

      if (userIds.length === 0) {
        setMembersCache(prev => ({ ...prev, [team.id]: [] }));
        return;
      }

      // Passo 2: busca profiles pelos user_ids
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      if (profErr) throw profErr;

      const profileMap: Record<string, { display_name: string; email: string }> = {};
      (profData ?? []).forEach((p: any) => {
        if (p.user_id) profileMap[p.user_id] = {
          display_name: p.display_name || "",
          email:        p.email        || "",
        };
      });

      const members: Member[] = userIds.map(uid => ({
        user_id:      uid,
        display_name: profileMap[uid]?.display_name || uid,
        email:        profileMap[uid]?.email        || "",
      }));

      members.sort((a, b) =>
        a.display_name.localeCompare(b.display_name, "pt-BR", { sensitivity: "base" }),
      );

      setMembersCache(prev => ({ ...prev, [team.id]: members }));
    } catch (err) {
      console.error("[TeamsTable] erro ao carregar membros:", err);
      // Em caso de erro, registra array vazio para nao ficar em loop
      setMembersCache(prev => ({ ...prev, [team.id]: [] }));
    } finally {
      setLoadingId(null);
    }
  }, [expandedId, membersCache]);

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Nome</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Módulo</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Membros</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  Nenhum time cadastrado.
                </TableCell>
              </TableRow>
            )}

            {teams.map(team => {
              const hasMembros = (team.memberCount ?? 0) > 0;
              const isExpanded = expandedId === team.id;
              const isLoading  = loadingId  === team.id;
              const members    = membersCache[team.id] ?? [];

              return (
                <>
                  {/* Linha principal */}
                  <TableRow
                    key={team.id}
                    className={[
                      "transition-colors",
                      hasMembros ? "cursor-pointer hover:bg-muted/40 select-none" : "",
                      isExpanded  ? "bg-muted/20" : "",
                    ].join(" ")}
                    onClick={() => hasMembros && handleRowClick(team)}
                  >
                    <TableCell className="py-2">
                      <span className="flex items-center gap-1.5">
                        {hasMembros ? (
                          isExpanded
                            ? <ChevronDown  className="h-3 w-3 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        ) : (
                          <span className="w-3" />
                        )}
                        <span className="text-xs font-medium">{team.name}</span>
                      </span>
                    </TableCell>

                    <TableCell className="py-2">
                      <Badge
                        variant={team.module === "sala_agil" ? "default" : "secondary"}
                        className="gap-1 text-[9px] px-1.5 py-0"
                      >
                        {team.module === "sala_agil"
                          ? <Zap    className="h-2.5 w-2.5" />
                          : <Shield className="h-2.5 w-2.5" />}
                        {team.module === "sala_agil" ? "Sala Ágil" : "Sustentação"}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-2 text-center">
                      <span className={[
                        "text-xs font-semibold",
                        hasMembros ? "text-primary" : "text-muted-foreground",
                      ].join(" ")}>
                        {team.memberCount ?? 0}
                      </span>
                    </TableCell>

                    <TableCell className="py-2 text-right" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(team)} className="gap-2 text-xs">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmId(team.id)}
                            className="gap-2 text-xs text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>

                  {/* Sub-linha de membros */}
                  {isExpanded && (
                    <TableRow key={`${team.id}-members`} className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={4} className="py-3 px-6">
                        {isLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Carregando membros...
                          </div>
                        ) : members.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Sem membros registrados.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {members.map(m => (
                              <div key={m.user_id} className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10px]">
                                  {getInitials(m.display_name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium truncate leading-tight">
                                    {formatPersonName(m.display_name)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
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
      </div>

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
              onClick={async () => {
                if (confirmId) { await onDelete(confirmId); setConfirmId(null); }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
