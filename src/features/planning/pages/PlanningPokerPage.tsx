import { useState } from "react";
import { usePlanningPoker, DECKS } from "../hooks/usePlanningPoker";
import { PokerDeck }   from "../components/PokerDeck";
import { VotesReveal } from "../components/VotesReveal";
import { HUSelector }  from "../components/HUSelector";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Users, History, Spade, RotateCcw } from "lucide-react";
import type { DeckMode } from "../hooks/usePlanningPoker";

export function PlanningPokerPage() {
  const {
    session, round, history, participants,
    sprints, backlogHUs, loading, myVote, isFacilitator,
    createSession, joinSession,
    startRound, castVote, revealVotes, saveResult, closeSession,
  } = usePlanningPoker();

  const [newOpen,        setNewOpen]        = useState(false);
  const [selectedSprint, setSelectedSprint] = useState("");
  const [selectedDeck,   setSelectedDeck]   = useState<DeckMode>("fibonacci");

  const handleCreate = async () => {
    if (!selectedSprint) return;
    await createSession(selectedSprint, selectedDeck);
    setNewOpen(false);
  };

  if (loading) return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Spade className="h-5 w-5 text-primary" /> Planning Poker
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Estime HUs de forma colaborativa e em tempo real.</p>
        </div>
        {!session && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Play className="h-3.5 w-3.5" /> Nova Sessão
          </Button>
        )}
      </div>

      <Tabs defaultValue={session ? "session" : "history"}>
        <TabsList className="mb-4">
          <TabsTrigger value="session" className="gap-1.5 text-xs">
            <Spade className="h-3.5 w-3.5" /> Sessão
            {session && <Badge variant="default" className="text-[9px] ml-1">ao vivo</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> Histórico
            <span className="text-muted-foreground ml-1 text-[10px]">({history.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ─ Sessão ativa */}
        <TabsContent value="session">
          {!session ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Spade className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma sessão em andamento.</p>
              {isFacilitator && (
                <Button variant="outline" size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" /> Iniciar Planning Poker
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status bar */}
              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Sprint</p>
                    <p className="text-sm font-semibold">{session.sprint_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deck</p>
                    <Badge variant="outline" className="text-xs">{DECKS[session.deck_mode]?.label}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {participants.length} participante{participants.length !== 1 ? "s" : ""}
                    <span className="ml-1 text-emerald-500">
                      ({participants.filter(p => p.has_voted).length} votaram)
                    </span>
                  </div>
                </div>
                {isFacilitator && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={closeSession}>
                      <RotateCcw className="h-3.5 w-3.5" /> Encerrar
                    </Button>
                  </div>
                )}
                {!participants.find(p => p.user_id === session.created_by) && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={joinSession}>
                    Entrar na sessão
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Coluna esquerda: seletor de HU (facilitador) */}
                {isFacilitator && (
                  <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Backlog</h3>
                    <HUSelector
                      hus={backlogHUs}
                      onStartRound={startRound}
                      disabled={!!(round && round.status !== "saved")}
                    />
                  </div>
                )}

                {/* Coluna direita: round ativo */}
                <div className={`space-y-4 ${isFacilitator ? "lg:col-span-2" : "lg:col-span-3"}`}>
                  {!round ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground rounded-xl border border-dashed border-border">
                      <Spade className="h-8 w-8 opacity-30" />
                      <p className="text-sm">{isFacilitator ? "Selecione uma HU no backlog para iniciar." : "Aguardando o facilitador iniciar uma rodada..."}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                      {/* HU sendo estimada */}
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground font-mono">{round.hu_code}</p>
                        <h3 className="text-sm font-semibold">{round.hu_title}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {round.status === "voting" ? "🔴 Votando" : round.status === "revealed" ? "👀 Revelado" : "✅ Salvo"}
                        </Badge>
                      </div>

                      {/* Deck de cartas */}
                      {round.status === "voting" && (
                        <PokerDeck
                          deckMode={session.deck_mode}
                          myVote={myVote}
                          onVote={castVote}
                          disabled={false}
                        />
                      )}

                      {/* Votos revelados + stats */}
                      <VotesReveal
                        round={round}
                        participants={participants}
                        isFacilitator={isFacilitator}
                        onReveal={revealVotes}
                        onSave={saveResult}
                        onNewRound={() => startRound(round.hu_id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─ Histórico */}
        <TabsContent value="history">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessão realizada ainda.</p>
          ) : (
            <div className="space-y-3">
              {history.map(h => (
                <div key={h.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{h.sprint_name}</span>
                      <Badge variant={h.status === "open" ? "default" : "secondary"} className="text-[10px]">
                        {h.status === "open" ? "Em andamento" : "Encerrada"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{DECKS[h.deck_mode]?.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(h.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {(h.total_hus !== null || h.total_horas !== null) && (
                    <div className="flex items-center gap-3 text-xs">
                      {h.total_hus !== null && <span className="text-muted-foreground">{h.total_hus} HU{h.total_hus !== 1 ? "s" : ""} estimadas</span>}
                      {h.total_horas !== null && h.total_horas > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{h.total_horas}h total</Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog nova sessão */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Sessão de Planning Poker</DialogTitle></DialogHeader>
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
              <label className="text-xs font-medium">Deck de Cartas</label>
              <Select value={selectedDeck} onValueChange={v => setSelectedDeck(v as DeckMode)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DECKS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v.label} — {v.values.slice(0,5).join(", ")}...</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} className="text-xs h-8">Cancelar</Button>
            <Button onClick={handleCreate} disabled={!selectedSprint} className="text-xs h-8 gap-1">
              <Play className="h-3.5 w-3.5" /> Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
