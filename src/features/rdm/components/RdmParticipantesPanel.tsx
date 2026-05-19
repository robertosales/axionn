import { useState, useMemo } from "react";
import { Plus, Trash2, Loader2, Users, UserPlus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import {
  Avatar, AvatarFallback, AvatarImage,
} from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRdmParticipantes }           from "../hooks/useRdmParticipantes";
import { useTeams }                      from "../hooks/useTeams";
import { useTeamMembers, ROLE_TO_PAPEL } from "../hooks/useTeamMembers";
import { toast }                         from "sonner";

const PAPEIS = [
  { value: "arquiteto",     label: "Arquiteto" },
  { value: "scrum_master",  label: "Scrum Master" },
  { value: "ad",            label: "AD" },
  { value: "desenvolvedor", label: "Desenvolvedor" },
  { value: "product_owner", label: "Product Owner" },
  { value: "requisitos",    label: "Requisitos" },
] as const;

const PAPEL_COLORS: Record<string, string> = {
  arquiteto:     "bg-purple-500/15 text-purple-400 border-purple-500/20",
  scrum_master:  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  ad:            "bg-orange-500/15 text-orange-400 border-orange-500/20",
  desenvolvedor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  product_owner: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  requisitos:    "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

function getInitials(name?: string | null, email?: string | null) {
  if (name?.trim())
    return name.trim().split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (email?.[0] ?? "?").toUpperCase();
}

function displayOf(name?: string | null, email?: string | null, id = "") {
  return name?.trim() || email?.trim() || id.slice(0, 8) + "\u2026";
}

interface Props { rdmId: string }

export function RdmParticipantesPanel({ rdmId }: Props) {
  const { participantes, loading: loadingP, add, remove } = useRdmParticipantes(rdmId);
  const { teams, loading: loadingTeams }                  = useTeams();

  const [selectedTeam,   setSelectedTeam]   = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [selectedPapel,  setSelectedPapel]  = useState<string>("desenvolvedor");
  const [submitting,     setSubmitting]     = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving]               = useState(false);

  const { members, loading: loadingM } = useTeamMembers(selectedTeam || null);

  const addedIds = useMemo(
    () => new Set(participantes.map((p) => p.profile_id)),
    [participantes]
  );

  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId);
    setSelectedMember("");
    setSelectedPapel("desenvolvedor");
  };

  const handleMemberChange = (memberId: string) => {
    setSelectedMember(memberId);
    const m = members.find((m) => m.id === memberId);
    if (m?.role) setSelectedPapel(ROLE_TO_PAPEL[m.role] ?? "desenvolvedor");
  };

  const handleAdd = async () => {
    if (!selectedMember) { toast.warning("Selecione um membro."); return; }
    setSubmitting(true);
    try {
      await add({ rdm_id: rdmId, profile_id: selectedMember, papel: selectedPapel });
      const nome  = members.find((m) => m.id === selectedMember)?.display_name ?? "Membro";
      const papel = PAPEIS.find((p) => p.value === selectedPapel)?.label ?? selectedPapel;
      toast.success(`${nome} adicionado como ${papel}.`);
      setSelectedMember("");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemoveId) return;
    setRemoving(true);
    try {
      await remove(confirmRemoveId);
      toast.success("Participante removido.");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setRemoving(false);
      setConfirmRemoveId(null);
    }
  };

  const confirmP    = participantes.find((p) => p.id === confirmRemoveId);
  const confirmName = displayOf(confirmP?.profile?.display_name, confirmP?.profile?.email, confirmP?.profile_id);

  if (loadingP) return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ======== Formulário de adição ======== */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Adicionar participante
        </p>

        {/* Select de Time */}
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Time
          </p>
          <Select value={selectedTeam} onValueChange={handleTeamChange} disabled={loadingTeams}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={loadingTeams ? "Carregando times…" : "Selecione um time…"} />
            </SelectTrigger>
            <SelectContent>
              {teams.length === 0 && !loadingTeams && (
                <SelectItem value="__none" disabled>Nenhum time encontrado</SelectItem>
              )}
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Membro + Papel + Botão — só após selecionar time */}
        {selectedTeam && (
          <div className="flex flex-col sm:flex-row gap-2">

            <div className="flex-1 space-y-1">
              <p className="text-[11px] text-muted-foreground">Membro</p>
              <Select value={selectedMember} onValueChange={handleMemberChange} disabled={loadingM}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={loadingM ? "Carregando…" : "Selecione um membro…"} />
                </SelectTrigger>
                <SelectContent>
                  {!loadingM && members.length === 0 && (
                    <SelectItem value="__none" disabled>Nenhum membro neste time</SelectItem>
                  )}
                  {members.map((m) => {
                    const name        = displayOf(m.display_name, m.email, m.id);
                    const jaAdicionado = addedIds.has(m.id);
                    return (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        disabled={jaAdicionado}
                        className={jaAdicionado ? "opacity-40" : ""}
                      >
                        <span className="flex items-center gap-2">
                          {name}
                          {jaAdicionado && (
                            <span className="text-[10px] text-muted-foreground">(já adicionado)</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:w-44 space-y-1">
              <p className="text-[11px] text-muted-foreground">Papel na RDM</p>
              <Select value={selectedPapel} onValueChange={setSelectedPapel}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:self-end">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={submitting || !selectedMember}
                className="gap-1.5 h-8 w-full sm:w-auto"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ======== Lista de participantes ======== */}
      {participantes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-2">
          <Users className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum participante adicionado ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
            Equipe da RDM — {participantes.length} participante{participantes.length !== 1 ? "s" : ""}
          </p>
          {participantes.map((p) => {
            const initials    = getInitials(p.profile?.display_name, p.profile?.email);
            const displayName = displayOf(p.profile?.display_name, p.profile?.email, p.profile_id);
            const papelLabel  = PAPEIS.find((r) => r.value === p.papel)?.label ?? p.papel;
            return (
              <div key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={p.profile?.avatar_url ?? undefined} alt={displayName} />
                  <AvatarFallback className="text-[11px] font-semibold bg-primary/20 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  {p.profile?.email && (
                    <p className="text-[11px] text-muted-foreground truncate">{p.profile.email}</p>
                  )}
                </div>
                <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${PAPEL_COLORS[p.papel] ?? ""}`}>
                  {papelLabel}
                </Badge>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setConfirmRemoveId(p.id)}
                  title="Remover participante"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ======== Confirmar remoção ======== */}
      <AlertDialog open={!!confirmRemoveId} onOpenChange={(o) => !o && !removing && setConfirmRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Remover Participante
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remover <span className="font-semibold text-foreground">{confirmName}</span> desta RDM?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={removing}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {removing ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
