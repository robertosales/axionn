import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRetroSession, RETRO_COLUMNS } from "../hooks/useRetroSession";
import { RetroBoard }   from "../components/RetroBoard";
import { RetroHistory } from "../components/RetroHistory";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClipboardList, History, Play, ChevronRight, Users, RotateCcw } from "lucide-react";
import type { RetroModel } from "../hooks/useRetroSession";

const PHASE_LABELS: Record<string, string> = {
  writing:    "✏️ Escrita",
  voting:     "👍 Votação",
  discussing: "💬 Discussão",
  actions:    "⚡ Ações",
  closed:     "✅ Encerrada",
};

const PHASE_ORDER = ["writing", "voting", "discussing", "actions", "closed"];

export function RetroPage() {
  const { profile, currentTeam } = useAuth();
  const teamId  = currentTeam?.id ?? "";
  const userId  = profile?.user_id ?? "";
  const isAdmin = profile?.module_access === "admin";

  const {
    session, history, loading, sprints,
    createSession, joinSession,
    addCard, deleteCard, editCard,
    voteCard, advancePhase, closeSession,
  } = useRetroSession(teamId);

  const [newSessionOpen,  setNewSessionOpen]  = useState(false);
  const [selectedSprint,  setSelectedSprint]  = useState("");
  const [selectedModel,   setSelectedModel]   = useState<RetroModel>("classic");

  const isFacilitator = session?.created_by === userId || isAdmin;
  const phaseIdx      = session ? PHASE_ORDER.indexOf(session.current_phase) : -1;
  const isLastPhase   = phaseIdx === PHASE_ORDER.length - 2; // antes de "closed"

  const handleCreate = async () => {
    if (!selectedSprint) return;
    await createSession(selectedSprint, selectedModel);
    setNewSessionOpen(false);
  };

  if (loading) return <div className="space-y-4 p-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Retrospectiva
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Reflita sobre o sprint e defina ações de melhoria.</p>
        </div>
        {!session && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewSessionOpen(true)}>
            <Play className="h-3.5 w-3.5" /> Nova Retro
          </Button>
        )}
      </div>

      <Tabs defaultValue={session ? "board" : "history"}>
        <TabsList className="mb-4">
          <TabsTrigger value="board" className="gap-1.5 text-xs">
            <ClipboardList className="h-3.5 w-3.5" /> Board
            {session && <Badge variant="default" className="text-[9px] ml-1">ao vivo</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Histórico
            <span className="text-muted-foreground ml-1 text-[10px]">({history.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Board */}
        <TabsContent value="board">
          {!session ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <ClipboardList className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma retrospectiva em andamento.</p>
              {(isFacilitator || isAdmin) && (
                <Button variant="outline" size="sm" onClick={() => setNewSessionOpen(true)} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" /> Iniciar Retrospectiva
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Sprint</p>
                    <p className="text-sm font-semibold">{session.sprint_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fase atual</p>
                    <Badge variant="outline" className="text-xs">
                      {PHASE_LABELS[session.current_phase] ?? session.current_phase}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {session.participants.length} participante{session.participants.length !== 1 ? "s" : ""}
                  </div>
                </div>
                {isFacilitator && session.current_phase !== "closed" && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={closeSession}>
                      <RotateCcw className="h-3.5 w-3.5" /> Encerrar
                    </Button>
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={advancePhase}>
                      {isLastPhase ? "Encerrar" : "Próxima fase"} <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {!session.participants.includes(userId) && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={joinSession}>
                    Entrar na sessão
                  </Button>
                )}
              </div>

              {/* Fases progress bar */}
              <div className="flex gap-1">
                {PHASE_ORDER.filter(p => p !== "closed").map((p, i) => (
                  <div key={p} className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < phaseIdx ? "bg-primary" : i === phaseIdx ? "bg-primary/60" : "bg-muted"
                  }`} />
                ))}
              </div>

              {session.current_phase !== "closed" ? (
                <RetroBoard
                  session={session}
                  myUserId={userId}
                  isFacilitator={isFacilitator}
                  onAddCard={addCard}
                  onVote={voteCard}
                  onEdit={editCard}
                  onDelete={deleteCard}
                />
              ) : (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-6 text-center space-y-2">
                  <p className="text-2xl">✅</p>
                  <p className="font-semibold">Retrospectiva encerrada!</p>
                  <p className="text-sm text-muted-foreground">
                    {session.cards.filter(c => c.is_action).length} itens de ação registrados.
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="history">
          <RetroHistory history={history} />
        </TabsContent>
      </Tabs>

      {/* Dialog nova sessão */}
      <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Retrospectiva</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Sprint</label>
              <Select value={selectedSprint} onValueChange={setSelectedSprint}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o sprint" /></SelectTrigger>
                <SelectContent>
                  {sprints.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Modelo</label>
              <Select value={selectedModel} onValueChange={v => setSelectedModel(v as RetroModel)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic"              className="text-xs">Clássico (Bem / Melhorar / Ações)</SelectItem>
                  <SelectItem value="start_stop_continue"  className="text-xs">Start / Stop / Continue</SelectItem>
                  <SelectItem value="glad_sad_mad"         className="text-xs">Glad / Sad / Mad</SelectItem>
                  <SelectItem value="4ls"                  className="text-xs">4Ls</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSessionOpen(false)} className="text-xs h-8">Cancelar</Button>
            <Button onClick={handleCreate} disabled={!selectedSprint} className="text-xs h-8 gap-1">
              <Play className="h-3.5 w-3.5" /> Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
