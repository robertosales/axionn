// src/features/retro/components/RetroPage.tsx
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Repeat, AlertTriangle, History } from "lucide-react";
import { useRetroSession } from "../hooks/useRetroSession";
import { getModel } from "../utils/retroModels";
import { RetroStartScreen } from "./RetroStartScreen";
import { RetroPhaseHeader } from "./RetroPhaseHeader";
import { RetroWritingPhase } from "./RetroWritingPhase";
import { RetroRevealPhase } from "./RetroRevealPhase";
import { RetroVotingPhase } from "./RetroVotingPhase";
import { RetroActionPhase } from "./RetroActionPhase";
import { RetroResultsView } from "./RetroResultsView";
import { RetroHistoryPanel } from "./RetroHistoryPanel";
import { toast } from "sonner";
import type { RetroPhase } from "../types/retro";

const NEXT_PHASE: Record<RetroPhase, RetroPhase | null> = {
  writing: "reveal",
  reveal: "voting",
  voting: "action_items",
  action_items: "closed",
  closed: null,
};

const PHASE_LABELS_SHORT: Record<RetroPhase, string> = {
  writing: "Escrita",
  reveal: "Revelação",
  voting: "Votação",
  action_items: "Action Items",
  closed: "Encerrada",
};

export function RetroPage() {
  const { user, currentTeamId, roles, isAdmin } = useAuth();
  const { activeSprint } = useSprint();
  const [view, setView] = useState<"session" | "history">("session");

  const canStart = isAdmin || roles.includes("scrum_master") || roles.includes("product_owner");

  const {
    session,
    cards,
    votes,
    participants,
    actionItems,
    profiles,
    loading,
    isFacilitator,
    facilitatorOffline,
    createSession,
    setPhase,
    close,
    cancel,
    addCard,
    updateCardText,
    toggleHide,
    deleteCard,
    toggleVote,
    assumeFacilitator,
    transferFacilitatorTo,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    refresh,
  } = useRetroSession({
    teamId: currentTeamId,
    sprintId: activeSprint?.id ?? null,
    userId: user?.id ?? null,
  });

  const modelLabel = useMemo(() => (session ? getModel(session.model).label : ""), [session]);

  // ─── Sem sprint ativa ─────────────────────────────────────────────────────────────────
  if (!activeSprint) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center space-y-2">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhuma sprint ativa. Ative uma sprint para iniciar uma retrospectiva.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────────────────────
  const handleAdvance = async () => {
    if (!session) return;
    const next = NEXT_PHASE[session.currentPhase];
    if (!next || next === "closed") return;
    await setPhase(next);
    toast.success(`Avançado para ${PHASE_LABELS_SHORT[next]}`);
  };

  const handleClose = async () => {
    await close();
    toast.success("Retrospectiva encerrada e arquivada no histórico");
  };

  const handleCancel = async () => {
    await cancel();
    toast.info("Sessão cancelada");
  };

  const nextPhase = session ? NEXT_PHASE[session.currentPhase] : null;
  const nextLabel = nextPhase && nextPhase !== "closed" ? PHASE_LABELS_SHORT[nextPhase] : null;

  return (
    <div className="space-y-4">
      {/* Header com tabs */}
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Retrospectiva — {activeSprint.name}</h2>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "session" | "history")}>
          <TabsList className="h-8">
            <TabsTrigger value="session" className="text-xs px-3">Sessão atual</TabsTrigger>
            <TabsTrigger value="history" className="text-xs px-3">
              <History className="h-3 w-3 mr-1" /> Histórico
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Aba Histórico */}
      {view === "history" && currentTeamId && (
        <RetroHistoryPanel teamId={currentTeamId} profiles={profiles} />
      )}

      {/* Aba Sessão */}
      {view === "session" && (
        <>
          {!session && (
            <RetroStartScreen
              canStart={canStart}
              sprintName={activeSprint.name}
              onStart={createSession}
            />
          )}

          {session && session.status !== "active" && (
            <RetroResultsView
              session={session}
              cards={cards}
              actionItems={actionItems}
              profiles={profiles}
              onNewSession={refresh}
            />
          )}

          {session && session.status === "active" && (
            <>
              <RetroPhaseHeader
                session={session}
                participants={participants}
                profiles={profiles}
                isFacilitator={isFacilitator}
                facilitatorOffline={facilitatorOffline}
                modelLabel={modelLabel}
                onAdvance={handleAdvance}
                onClose={handleClose}
                onCancel={handleCancel}
                onAssumeFacilitator={assumeFacilitator}
                onTransfer={transferFacilitatorTo}
                nextPhaseLabel={nextLabel}
              />

              {session.currentPhase === "writing" && (
                <RetroWritingPhase
                  model={session.model}
                  cards={cards}
                  userId={user?.id ?? ""}
                  isFacilitator={isFacilitator}
                  onAdd={addCard}
                  onUpdate={updateCardText}
                  onToggleHide={toggleHide}
                  onDelete={deleteCard}
                />
              )}

              {session.currentPhase === "reveal" && (
                <RetroRevealPhase
                  model={session.model}
                  cards={cards}
                  profiles={profiles}
                />
              )}

              {session.currentPhase === "voting" && (
                <RetroVotingPhase
                  model={session.model}
                  cards={cards}
                  votes={votes}
                  profiles={profiles}
                  userId={user?.id ?? ""}
                  onToggleVote={toggleVote}
                />
              )}

              {session.currentPhase === "action_items" && (
                <RetroActionPhase
                  actionItems={actionItems}
                  cards={cards}
                  profiles={profiles}
                  isFacilitator={isFacilitator}
                  onCreate={createActionItem}
                  onUpdate={updateActionItem}
                  onDelete={deleteActionItem}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
