// src/features/retro/types/retro.ts

export type RetroPhase = "writing" | "reveal" | "voting" | "action_items" | "closed";
export type RetroStatus = "active" | "finished" | "cancelled";
export type RetroModelKey = "4ls" | "start_stop_continue" | "mad_sad_glad" | "starfish" | "kpt";
export type ActionItemStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface RetroColumn {
  key: string;
  label: string;
  icon: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}

export interface RetroSession {
  id: string;
  teamId: string;
  sprintId: string;
  model: RetroModelKey;
  status: RetroStatus;
  currentPhase: RetroPhase;
  createdBy: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface RetroCard {
  id: string;
  sessionId: string;
  columnKey: string;
  text: string;
  authorId: string;
  votes: number;
  hidden: boolean;
  isAction: boolean;
  actionOwnerId: string | null;
  actionTargetSprintId: string | null;
  createdAt: string;
}

export interface RetroVote {
  id: string;
  sessionId: string;
  cardId: string;
  userId: string;
  createdAt: string;
}

export interface RetroParticipant {
  id: string;
  sessionId: string;
  userId: string;
  isFacilitator: boolean;
  isOnline: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface RetroActionItem {
  id: string;
  sessionId: string;
  cardId: string | null;
  title: string;
  description: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  createdAt: string;
  updatedAt: string;
}
