import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Developer,
  UserStory,
  Activity,
  Sprint,
  KanbanStatus,
  Impediment,
  ImpedimentType,
  ImpedimentCriticality,
  ActivityType,
  Epic,
  CustomFieldDefinition,
  AutomationRule,
  WorkflowColumn,
  DEFAULT_KANBAN_COLUMNS,
  normalizeWorkflowColumns,
  getColumnHex,
} from "@/types/sprint";
import { toast } from "sonner";
import { calcDelayDays } from "@/utils/sprintStatus";

function toDecimalHours(value: unknown): number {
  if (typeof value === "number" && !isNaN(value)) return value;
  const str = String(value ?? "").trim();
  if (str.includes(":")) {
    const [h = "0", m = "0"] = str.split(":");
    const hours = parseInt(h, 10) || 0;
    const minutes = parseInt(m, 10) || 0;
    return hours + minutes / 60;
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export interface AddImpedimentData {
  reason: string;
  type: ImpedimentType;
  criticality: ImpedimentCriticality;
  hasTicket: boolean;
  ticketUrl?: string;
  ticketId?: string;
  startedAt?: string;
}

export interface ImpedimentTarget {
  huId?: string;
  sprintId?: string;
}

interface SprintContextType {
  developers: Developer[];
  userStories: UserStory[];
  activities: Activity[];
  sprints: Sprint[];
  epics: Epic[];
  customFields: CustomFieldDefinition[];
  automationRules: AutomationRule[];
  workflowColumns: WorkflowColumn[];
  activeSprint: Sprint | null;
  loading: boolean;
  addDeveloper: (dev: Omit<Developer, "id">) => Promise<void>;
  updateDeveloper: (id: string, dev: Partial<Omit<Developer, "id">>) => Promise<void>;
  removeDeveloper: (id: string) => Promise<void>;
  addUserStory: (hu: Omit<UserStory, "id" | "code" | "createdAt" | "impediments"> & { status?: string }) => Promise<void>;
  updateUserStory: (id: string, hu: Partial<Omit<UserStory, "id" | "code" | "createdAt">>) => Promise<void>;
  removeUserStory: (id: string) => Promise<void>;
  updateUserStoryStatus: (id: string, status: KanbanStatus) => Promise<void>;
  reorderUserStories: (updates: { id: string; position: number }[]) => Promise<void>;
  addActivity: (act: Omit<Activity, "id" | "endDate" | "createdAt">) => Promise<void>;
  updateActivity: (id: string, act: Partial<Omit<Activity, "id" | "createdAt">>) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;
  closeActivity: (id: string) => Promise<void>;
  reopenActivity: (id: string) => Promise<void>;
  addImpediment: (target: ImpedimentTarget | string, data: AddImpedimentData) => Promise<void>;
  addSprintImpediment: (sprintId: string, data: AddImpedimentData) => Promise<void>;
  resolveImpediment: (huIdOrNull: string | null, impedimentId: string, resolution?: string) => Promise<void>;
  addSprint: (sprint: Omit<Sprint, "id" | "createdAt" | "isActive">) => Promise<void>;
  updateSprint: (id: string, sprint: Partial<Omit<Sprint, "id" | "createdAt">>) => Promise<void>;
  removeSprint: (id: string) => Promise<void>;
  closeSprint: (id: string) => Promise<void>;
  setActiveSprint: (id: string) => Promise<void>;
  addEpic: (epic: Omit<Epic, "id" | "createdAt">) => Promise<void>;
  updateEpic: (id: string, epic: Partial<Omit<Epic, "id" | "createdAt">>) => Promise<void>;
  removeEpic: (id: string) => Promise<void>;
  addCustomField: (field: Omit<CustomFieldDefinition, "id">) => Promise<void>;
  updateCustomField: (id: string, field: Partial<Omit<CustomFieldDefinition, "id">>) => Promise<void>;
  removeCustomField: (id: string) => Promise<void>;
  addAutomationRule: (rule: Omit<AutomationRule, "id" | "createdAt">) => Promise<void>;
  updateAutomationRule: (id: string, rule: Partial<Omit<AutomationRule, "id" | "createdAt">>) => Promise<void>;
  removeAutomationRule: (id: string) => Promise<void>;
  setWorkflowColumns: (columns: WorkflowColumn[]) => void;
  addWorkflowColumn: (col: WorkflowColumn) => Promise<void>;
  removeWorkflowColumn: (key: string) => Promise<void>;
  updateWorkflowColumn: (key: string, col: Partial<WorkflowColumn>) => Promise<void>;
  reorderWorkflowColumns: (columns: WorkflowColumn[]) => Promise<void>;
  impediments: Impediment[];
  refreshAll: () => Promise<void>;
}

const SprintContext = createContext<SprintContextType | undefined>(undefined);

// ─── Helpers de mapeamento ─────────────────────────────────────────────────────
const mapImpediment = (imp: any): Impediment => ({
  id: imp.id,
  huId: imp.hu_id ?? undefined,
  sprintId: imp.sprint_id ?? undefined,
  reason: imp.reason,
  type: imp.type,
  criticality: imp.criticality,
  hasTicket: imp.has_ticket,
  ticketUrl: imp.ticket_url,
  ticketId: imp.ticket_id,
  reportedAt: imp.reported_at,
  resolvedAt: imp.resolved_at,
  resolution: imp.resolution,
  startedAt: imp.started_at ?? undefined,
});

const mapUserStory = (h: any, impData: any[]): UserStory => ({
  id: h.id, code: h.code, title: h.title, description: h.description || "",
  storyPoints: h.story_points, priority: h.priority, status: h.status,
  sprintId: h.sprint_id, epicId: h.epic_id,
  startDate: h.start_date || undefined, endDate: h.end_date || undefined,
  sizeReference: h.size_reference || null,
  estimatedHours: h.estimated_hours != null ? Number(h.estimated_hours) : null,
  planningStatus: h.planning_status || "pending",
  votedAt: h.voted_at || null, votedBy: h.voted_by || null,
  functionPoints: h.function_points != null ? Number(h.function_points) : null,
  assigneeId: h.assignee_id || null, position: h.position ?? 0,
  impediments: impData.filter((imp: any) => imp.hu_id === h.id).map(mapImpediment),
  customFields: h.custom_fields || {}, createdAt: h.created_at,
  statusChangedAt: h.status_changed_at ?? null,
});

const mapActivity = (a: any): Activity => ({
  id: a.id, huId: a.hu_id, title: a.title, description: a.description || "",
  activityType: a.activity_type, assigneeId: a.assignee_id || "",
  hours: Number(a.hours), startDate: a.start_date, endDate: a.end_date,
  createdAt: a.created_at, isClosed: a.is_closed, closedAt: a.closed_at,
});

export function SprintProvider({ children }: { children: ReactNode }) {
  const { currentTeamId } = useAuth();
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [workflowColumns, setWorkflowColumnsState] = useState<WorkflowColumn[]>(DEFAULT_KANBAN_COLUMNS);
  const [impediments, setImpediments] = useState<Impediment[]>([]);
  const [loading, setLoading] = useState(false);

  const teamId = currentTeamId;

  // ── PRIORIDADE #2: AbortController — race condition guard ─────────────────────
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);

  // ── refreshAll: carga inicial + operações que precisam de IDs do banco ─────────
  const refreshAll = useCallback(async () => {
    if (!teamId) {
      setDevelopers([]); setUserStories([]); setActivities([]); setSprints([]);
      setEpics([]); setCustomFields([]); setAutomationRules([]);
      setWorkflowColumnsState(DEFAULT_KANBAN_COLUMNS); setImpediments([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const [devRes, sprintRes, epicRes, huRes, actRes, impRes, cfRes, arRes, wcRes] = await Promise.all([
        supabase.from("developers").select("*").eq("team_id", teamId).limit(200),
        supabase.from("sprints").select("*").eq("team_id", teamId).limit(100),
        supabase.from("epics").select("*").eq("team_id", teamId).limit(100),
        supabase.from("user_stories").select("*").eq("team_id", teamId).order("position", { ascending: true }).limit(500),
        supabase.from("activities").select("*").eq("team_id", teamId).limit(500),
        supabase.from("impediments").select("*").eq("team_id", teamId).limit(200),
        supabase.from("custom_field_definitions").select("*").eq("team_id", teamId).limit(50),
        supabase.from("automation_rules").select("*").eq("team_id", teamId).limit(50),
        supabase.from("workflow_columns").select("*").eq("team_id", teamId).order("sort_order").limit(50),
      ]);
      if (controller.signal.aborted) return;
      setDevelopers((devRes.data || []).map((d: any) => ({ id: d.id, name: d.name, email: d.email, role: d.role, avatar: d.avatar })));
      setSprints((sprintRes.data || []).map((s: any) => ({
        id: s.id, name: s.name, startDate: s.start_date, endDate: s.end_date,
        goal: s.goal || "", isActive: s.is_active, createdAt: s.created_at,
        closedAt: s.closed_at ?? null, delayDays: s.delay_days ?? null,
      })));
      setEpics((epicRes.data || []).map((e: any) => ({
        id: e.id, name: e.name, description: e.description || "", color: e.color, createdAt: e.created_at,
      })));
      const impData = (impRes.data || []) as any[];
      setImpediments(impData.map(mapImpediment));
      const huData = (huRes.data || []) as any[];
      setUserStories(huData.map((h: any) => mapUserStory(h, impData)));
      setActivities((actRes.data || []).map(mapActivity));
      setCustomFields((cfRes.data || []).map((f: any) => ({
        id: f.id, key: f.key || f.id, name: f.name || f.label || "",
        label: f.label || f.name || "", type: f.field_type as any,
        options: f.options ?? null, required: f.required ?? false,
      })));
      setAutomationRules((arRes.data || []).map((r: any) => ({
        id: r.id, name: r.name, enabled: r.enabled ?? r.is_active ?? false,
        isActive: r.is_active ?? r.enabled ?? false,
        trigger: { type: r.trigger_type, fromStatus: r.trigger_from_status ?? null, toStatus: r.trigger_to_status },
        action: { type: r.action_type, targetStatus: r.action_target_status ?? null, message: r.action_message ?? null },
        createdAt: r.created_at,
      })));
      const wc = (wcRes.data || []) as any[];
      if (wc.length > 0) {
        setWorkflowColumnsState(normalizeWorkflowColumns(wc.map((c: any) => ({
          key: c.key, label: c.label, colorClass: c.color_class || "",
          dotColor: c.dot_color || "", hex: c.hex || undefined,
          wipLimit: c.wip_limit ?? null, orderIndex: c.sort_order ?? 0,
        }))));
      } else {
        setWorkflowColumnsState(DEFAULT_KANBAN_COLUMNS);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Error loading data:", err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIORIDADE #5 — Realtime channels
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;

    const channel = supabase
      .channel(`sprint-team-${teamId}`)

      // ── user_stories ──────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_stories", filter: `team_id=eq.${teamId}` },
        () => { refreshAll(); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_stories", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as any;
          setUserStories((prev) => {
            const exists = prev.find((h) => h.id === row.id);
            if (!exists) return prev;
            return prev.map((h) =>
              h.id === row.id
                ? {
                    ...h,
                    title: row.title,
                    description: row.description || "",
                    status: row.status,
                    priority: row.priority,
                    storyPoints: row.story_points,
                    position: row.position ?? h.position,
                    sprintId: row.sprint_id,
                    epicId: row.epic_id,
                    assigneeId: row.assignee_id || null,
                    estimatedHours: row.estimated_hours != null ? Number(row.estimated_hours) : null,
                    functionPoints: row.function_points != null ? Number(row.function_points) : null,
                    planningStatus: row.planning_status || "pending",
                    votedAt: row.voted_at || null,
                    votedBy: row.voted_by || null,
                    startDate: row.start_date || undefined,
                    endDate: row.end_date || undefined,
                    sizeReference: row.size_reference || null,
                    customFields: row.custom_fields || {},
                    statusChangedAt: row.status_changed_at ?? null,
                  }
                : h,
            );
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "user_stories", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const id = (payload.old as any).id;
          setUserStories((prev) => prev.filter((h) => h.id !== id));
          setActivities((prev) => prev.filter((a) => a.huId !== id));
          setImpediments((prev) => prev.filter((imp) => imp.huId !== id));
        },
      )

      // ── activities ───────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activities", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as any;
          setActivities((prev) => {
            if (prev.some((a) => a.id === row.id)) return prev;
            return [...prev, mapActivity(row)];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "activities", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as any;
          setActivities((prev) =>
            prev.map((a) => a.id === row.id ? mapActivity(row) : a),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activities", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const id = (payload.old as any).id;
          setActivities((prev) => prev.filter((a) => a.id !== id));
        },
      )

      // ── sprints ──────────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sprints", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as any;
          const newSprint: Sprint = {
            id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date,
            goal: row.goal || "", isActive: row.is_active, createdAt: row.created_at,
            closedAt: row.closed_at ?? null, delayDays: row.delay_days ?? null,
          };
          setSprints((prev) => {
            if (prev.some((s) => s.id === row.id)) return prev;
            return [...prev, newSprint];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sprints", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as any;
          setSprints((prev) =>
            prev.map((s) =>
              s.id === row.id
                ? {
                    ...s,
                    name: row.name, startDate: row.start_date, endDate: row.end_date,
                    goal: row.goal || "", isActive: row.is_active,
                    closedAt: row.closed_at ?? null, delayDays: row.delay_days ?? null,
                  }
                : s,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "sprints", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const id = (payload.old as any).id;
          setSprints((prev) => prev.filter((s) => s.id !== id));
        },
      )

      // ── impediments ──────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "impediments", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as any;
          const newImp = mapImpediment(row);
          setImpediments((prev) => {
            if (prev.some((imp) => imp.id === row.id)) return prev;
            return [...prev, newImp];
          });
          if (row.hu_id) {
            setUserStories((prev) => prev.map((h) =>
              h.id === row.hu_id && !h.impediments.some((i) => i.id === row.id)
                ? { ...h, impediments: [...h.impediments, newImp] }
                : h,
            ));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "impediments", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const row = payload.new as any;
          const updatedImp = mapImpediment(row);
          setImpediments((prev) => prev.map((imp) => imp.id === row.id ? updatedImp : imp));
          setUserStories((prev) => prev.map((h) => ({
            ...h,
            impediments: h.impediments.map((imp) => imp.id === row.id ? updatedImp : imp),
          })));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "impediments", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const id = (payload.old as any).id;
          setImpediments((prev) => prev.filter((imp) => imp.id !== id));
          setUserStories((prev) => prev.map((h) => ({
            ...h, impediments: h.impediments.filter((imp) => imp.id !== id),
          })));
        },
      )

      // ── developers ───────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "developers", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const d = payload.new as any;
          setDevelopers((prev) => {
            if (prev.some((dev) => dev.id === d.id)) return prev;
            return [...prev, { id: d.id, name: d.name, email: d.email, role: d.role, avatar: d.avatar }];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "developers", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const d = payload.new as any;
          setDevelopers((prev) =>
            prev.map((dev) => dev.id === d.id ? { id: d.id, name: d.name, email: d.email, role: d.role, avatar: d.avatar } : dev),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "developers", filter: `team_id=eq.${teamId}` },
        (payload) => {
          const id = (payload.old as any).id;
          setDevelopers((prev) => prev.filter((dev) => dev.id !== id));
        },
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.debug(`[Realtime] canal sprint-team-${teamId} conectado`);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[Realtime] canal sprint-team-${teamId} com problema (${status}), tentando reconectar...`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      console.debug(`[Realtime] canal sprint-team-${teamId} removido`);
    };
  }, [teamId, refreshAll]);

  const activeSprint = sprints.find((s) => s.isActive) || null;

  const runAutomations = useCallback(async (huId: string, fromStatus: string, toStatus: string) => {
    const rules = automationRules.filter((r) => {
      const en = r.enabled ?? (r as any).isActive ?? false;
      const trig = typeof r.trigger === "string" ? null : r.trigger;
      return en && trig?.type === "status_change";
    });
    for (const rule of rules) {
      const trig = typeof rule.trigger === "string" ? JSON.parse(rule.trigger) : rule.trigger;
      const act  = typeof rule.action  === "string" ? JSON.parse(rule.action)  : rule.action;
      if ((!trig.fromStatus || trig.fromStatus === fromStatus) && trig.toStatus === toStatus) {
        if (act.type === "notify" && act.message) toast.info(`🤖 Automação "${rule.name}": ${act.message}`);
        if (act.type === "change_status" && act.targetStatus) {
          await supabase.from("user_stories").update({ status: act.targetStatus }).eq("id", huId);
          toast.info(`🤖 Automação "${rule.name}": Status alterado automaticamente`);
        }
      }
    }
  }, [automationRules]);

  // ── DEVELOPERS ────────────────────────────────────────────────────────────────
  const addDeveloper = useCallback(async (dev: Omit<Developer, "id">) => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("developers")
      .insert({ team_id: teamId, name: dev.name, email: dev.email, role: dev.role, avatar: dev.avatar })
      .select()
      .single();
    if (error) { toast.error("Erro ao adicionar desenvolvedor"); return; }
    if (data) setDevelopers((prev) =>
      prev.some((d) => d.id === data.id) ? prev : [...prev, { id: data.id, name: data.name, email: data.email, role: data.role, avatar: data.avatar }]
    );
  }, [teamId]);

  const updateDeveloper = useCallback(async (id: string, dev: Partial<Omit<Developer, "id">>) => {
    const { error } = await supabase.from("developers").update(dev).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setDevelopers((prev) => prev.map((d) => d.id === id ? { ...d, ...dev } : d));
  }, []);

  const removeDeveloper = useCallback(async (id: string) => {
    const { error } = await supabase.from("developers").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover desenvolvedor"); return; }
    setDevelopers((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // ── USER STORIES ──────────────────────────────────────────────────────────────
  const addUserStory = useCallback(async (hu: Omit<UserStory, "id" | "code" | "createdAt" | "impediments"> & { status?: string }) => {
    if (!teamId) return;
    const count = userStories.length + 1;
    const firstCol = workflowColumns[0]?.key || "aguardando_desenvolvimento";
    const targetStatus = hu.status || firstCol;
    const lastPosition = userStories.filter((h) => h.status === targetStatus).reduce((max, h) => Math.max(max, h.position ?? 0), -1) + 1;
    const { error } = await supabase.from("user_stories").insert({
      team_id: teamId, sprint_id: hu.sprintId, epic_id: hu.epicId || null,
      code: `HU-${String(count).padStart(3, "0")}`, title: hu.title,
      description: hu.description, story_points: hu.storyPoints, priority: hu.priority,
      status: targetStatus, position: lastPosition, custom_fields: hu.customFields || {},
      start_date: hu.startDate || null, end_date: hu.endDate || null,
      size_reference: (hu as any).sizeReference || null,
      estimated_hours: (hu as any).estimatedHours || null,
      function_points: (hu as any).functionPoints || null,
      assignee_id: (hu as any).assigneeId || null,
    });
    if (error) { toast.error("Erro ao criar HU"); return; }
    await refreshAll();
  }, [teamId, userStories, workflowColumns, refreshAll]);

  const updateUserStory = useCallback(async (id: string, hu: Partial<Omit<UserStory, "id" | "code" | "createdAt">>) => {
    const updateData: any = {};
    if (hu.title !== undefined) updateData.title = hu.title;
    if (hu.description !== undefined) updateData.description = hu.description;
    if (hu.storyPoints !== undefined) updateData.story_points = hu.storyPoints;
    if (hu.priority !== undefined) updateData.priority = hu.priority;
    if (hu.status !== undefined) updateData.status = hu.status;
    if ("sprintId" in hu) updateData.sprint_id = hu.sprintId ?? null;
    if ("epicId" in hu) updateData.epic_id = hu.epicId ?? null;
    if (hu.customFields !== undefined) updateData.custom_fields = hu.customFields;
    if ("startDate" in hu) updateData.start_date = hu.startDate || null;
    if ("endDate" in hu) updateData.end_date = hu.endDate || null;
    if ((hu as any).sizeReference !== undefined) updateData.size_reference = (hu as any).sizeReference ?? null;
    if ((hu as any).estimatedHours !== undefined) updateData.estimated_hours = (hu as any).estimatedHours ?? null;
    if ((hu as any).planningStatus !== undefined) updateData.planning_status = (hu as any).planningStatus;
    if ((hu as any).votedAt !== undefined) updateData.voted_at = (hu as any).votedAt;
    if ((hu as any).votedBy !== undefined) updateData.voted_by = (hu as any).votedBy;
    if ((hu as any).functionPoints !== undefined) updateData.function_points = (hu as any).functionPoints ?? null;
    if ("assigneeId" in hu) updateData.assignee_id = (hu as any).assigneeId ?? null;
    const { data, error } = await supabase.from("user_stories").update(updateData).eq("id", id).select();
    if (error) { toast.error("Erro ao atualizar HU: " + error.message); return; }
    if (!data || data.length === 0) { toast.error("Erro ao atualizar HU: nenhuma linha afetada"); return; }
    setUserStories((prev) => prev.map((h) => h.id === id ? mapUserStory(data[0], impediments.filter((imp) => imp.huId === id)) : h));
  }, [impediments]);

  const removeUserStory = useCallback(async (id: string) => {
    const { error } = await supabase.from("user_stories").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover HU"); return; }
    setUserStories((prev) => prev.filter((h) => h.id !== id));
    setImpediments((prev) => prev.filter((imp) => imp.huId !== id));
    setActivities((prev) => prev.filter((a) => a.huId !== id));
  }, []);

  const updateUserStoryStatus = useCallback(async (id: string, status: KanbanStatus) => {
    const hu = userStories.find((h) => h.id === id);
    if (!hu) return;
    const oldStatus = hu.status;
    if (oldStatus === status) return;
    const now = new Date().toISOString();
    const lastPosition = userStories
      .filter((h) => h.status === status)
      .reduce((max, h) => Math.max(max, h.position ?? 0), -1) + 1;
    setUserStories((prev) =>
      prev.map((h) => h.id === id ? { ...h, status, position: lastPosition, statusChangedAt: now } as any : h),
    );
    try {
      const { error } = await supabase
        .from("user_stories")
        .update({ status, position: lastPosition, status_changed_at: now })
        .eq("id", id);
      if (error) throw error;
      if (oldStatus !== status) await runAutomations(id, oldStatus, status);
    } catch (err: any) {
      setUserStories((prev) =>
        prev.map((h) => h.id === id ? { ...h, status: oldStatus } as any : h),
      );
      toast.error("Erro ao mover card: " + (err?.message ?? "tente novamente"));
    }
  }, [userStories, runAutomations]);

  const reorderUserStories = useCallback(async (updates: { id: string; position: number }[]) => {
    setUserStories((prev) => prev.map((hu) => {
      const upd = updates.find((u) => u.id === hu.id);
      return upd ? { ...hu, position: upd.position } : hu;
    }));
    await Promise.all(updates.map(({ id, position }) =>
      supabase.from("user_stories").update({ position }).eq("id", id)
    ));
  }, []);

  // ── ACTIVITIES ────────────────────────────────────────────────────────────────
  const addActivity = useCallback(async (act: Omit<Activity, "id" | "endDate" | "createdAt">) => {
    if (!teamId) return;
    const safeHours = toDecimalHours(act.hours);
    const { data, error } = await supabase
      .from("activities")
      .insert({
        team_id: teamId, hu_id: act.huId, title: act.title, description: act.description,
        activity_type: act.activityType, assignee_id: act.assigneeId || null,
        hours: safeHours, start_date: act.startDate, end_date: act.startDate,
      })
      .select()
      .single();
    if (error) { toast.error("Erro ao criar atividade"); return; }
    if (data) setActivities((prev) =>
      prev.some((a) => a.id === data.id) ? prev : [...prev, mapActivity(data)]
    );
    if (act.activityType === "bug") {
      const hu = userStories.find((h) => h.id === act.huId);
      const bugCol = workflowColumns.find((c) => c.key === "bug");
      if (hu && bugCol && hu.status !== "bug") {
        const { error: huError } = await supabase.from("user_stories").update({ status: "bug" }).eq("id", act.huId);
        if (!huError) {
          setUserStories((prev) => prev.map((h) => h.id === act.huId ? { ...h, status: "bug" as KanbanStatus } : h));
          toast.info(`🐛 HU movida para "${bugCol.label}"`);
        }
      }
    }
  }, [teamId, userStories, workflowColumns]);

  const updateActivity = useCallback(async (id: string, act: Partial<Omit<Activity, "id" | "createdAt">>) => {
    const existing = activities.find((a) => a.id === id);
    if (!existing) return;
    const updateData: any = {};
    if (act.title !== undefined) updateData.title = act.title;
    if (act.description !== undefined) updateData.description = act.description;
    if (act.activityType !== undefined) updateData.activity_type = act.activityType;
    if (act.assigneeId !== undefined) updateData.assignee_id = act.assigneeId || null;
    if (act.hours !== undefined) updateData.hours = toDecimalHours(act.hours);
    if (act.startDate !== undefined) {
      updateData.start_date = act.startDate;
      if (!existing.isClosed) updateData.end_date = act.startDate;
    }
    const { error } = await supabase.from("activities").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar atividade"); return; }
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, ...act } : a));
  }, [activities]);

  const removeActivity = useCallback(async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover atividade"); return; }
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const closeActivity = useCallback(async (id: string) => {
    const act = activities.find((a) => a.id === id);
    if (!act) return;
    const today = new Date().toISOString().slice(0, 10);
    const closedAt = new Date().toISOString();
    const hu = userStories.find((h) => h.id === act.huId);
    const remainingOpenBugs = activities.filter(
      (a) => a.huId === act.huId && a.id !== id && a.activityType === "bug" && !a.isClosed
    );
    const shouldMoveHuToTeste =
      act.activityType === "bug" && hu?.status === "bug" && remainingOpenBugs.length === 0;
    const targetCol = shouldMoveHuToTeste ? workflowColumns.find((c) => c.key === "em_teste") : null;
    const ops: PromiseLike<any>[] = [
      supabase.from("activities").update({ is_closed: true, closed_at: closedAt, end_date: today }).eq("id", id),
    ];
    if (shouldMoveHuToTeste && targetCol) {
      ops.push(supabase.from("user_stories").update({ status: "em_teste" }).eq("id", act.huId));
    }
    const results = await Promise.all(ops);
    const hasError = results.some((r) => r.error);
    if (hasError) { toast.error("Erro ao fechar atividade"); return; }
    setActivities((prev) => prev.map((a) =>
      a.id === id ? { ...a, isClosed: true, closedAt, endDate: today } : a
    ));
    if (shouldMoveHuToTeste && targetCol) {
      setUserStories((prev) => prev.map((h) =>
        h.id === act.huId ? { ...h, status: "em_teste" as KanbanStatus } : h
      ));
      toast.success(`✅ Bug resolvido! HU retornou para "${targetCol.label}"`);
    }
  }, [activities, userStories, workflowColumns]);

  const reopenActivity = useCallback(async (id: string) => {
    const { error } = await supabase.from("activities").update({ is_closed: false, closed_at: null, end_date: null }).eq("id", id);
    if (error) { toast.error("Erro ao reabrir atividade"); return; }
    setActivities((prev) => prev.map((a) =>
      a.id === id ? { ...a, isClosed: false, closedAt: null, endDate: null } : a
    ));
  }, []);

  // ── IMPEDIMENTS ───────────────────────────────────────────────────────────────
  const addImpediment = useCallback(async (target: ImpedimentTarget | string, data: AddImpedimentData) => {
    if (!teamId) return;
    const huId     = typeof target === "string" ? target : (target.huId    ?? null);
    const sprintId = typeof target === "string" ? null   : (target.sprintId ?? null);
    if (!huId && !sprintId) { toast.error("Informe uma HU ou Sprint para o impedimento"); return; }
    const { data: row, error } = await supabase
      .from("impediments")
      .insert({
        team_id: teamId, hu_id: huId, sprint_id: sprintId,
        reason: data.reason, type: data.type, criticality: data.criticality,
        has_ticket: data.hasTicket, ticket_url: data.ticketUrl ?? null,
        ticket_id: data.ticketId ?? null, started_at: data.startedAt ?? null,
      })
      .select()
      .single();
    if (error) { toast.error("Erro ao adicionar impedimento: " + error.message); return; }
    if (row) {
      const newImp = mapImpediment(row);
      setImpediments((prev) => prev.some((imp) => imp.id === row.id) ? prev : [...prev, newImp]);
      if (huId) {
        setUserStories((prev) => prev.map((h) =>
          h.id === huId && !h.impediments.some((i) => i.id === row.id)
            ? { ...h, impediments: [...h.impediments, newImp] }
            : h,
        ));
      }
    }
  }, [teamId]);

  const addSprintImpediment = useCallback(
    async (sprintId: string, data: AddImpedimentData) => addImpediment({ sprintId }, data),
    [addImpediment],
  );

  const resolveImpediment = useCallback(async (_: string | null, impedimentId: string, resolution?: string) => {
    const resolvedAt = new Date().toISOString();
    const { error } = await supabase.from("impediments").update({ resolved_at: resolvedAt, resolution: resolution || null }).eq("id", impedimentId);
    if (error) { toast.error("Erro ao resolver impedimento"); return; }
    setImpediments((prev) => prev.map((imp) => imp.id === impedimentId ? { ...imp, resolvedAt, resolution: resolution || null } : imp));
    setUserStories((prev) => prev.map((h) => ({
      ...h,
      impediments: h.impediments.map((imp) =>
        imp.id === impedimentId ? { ...imp, resolvedAt, resolution: resolution || null } : imp
      ),
    })));
  }, []);

  // ── SPRINTS ───────────────────────────────────────────────────────────────────
  const addSprint = useCallback(async (sprint: Omit<Sprint, "id" | "createdAt" | "isActive">) => {
    if (!teamId) return;
    const { error } = await supabase.from("sprints").insert({
      team_id: teamId, name: sprint.name, start_date: sprint.startDate,
      end_date: sprint.endDate, goal: sprint.goal, is_active: false,
      closed_at: null, delay_days: null,
    });
    if (error) { toast.error("Erro ao criar sprint"); return; }
    // Realtime INSERT cuidará da atualização local — sem refreshAll() aqui
  }, [teamId]);

  const updateSprint = useCallback(async (id: string, sprint: Partial<Omit<Sprint, "id" | "createdAt">>) => {
    const updateData: any = {};
    if (sprint.name !== undefined) updateData.name = sprint.name;
    if (sprint.startDate !== undefined) updateData.start_date = sprint.startDate;
    if (sprint.endDate !== undefined) updateData.end_date = sprint.endDate;
    if (sprint.goal !== undefined) updateData.goal = sprint.goal;
    if (sprint.isActive !== undefined) updateData.is_active = sprint.isActive;
    const { error } = await supabase.from("sprints").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar sprint"); return; }
    setSprints((prev) => prev.map((s) => s.id === id ? { ...s, ...sprint } : s));
  }, []);

  const removeSprint = useCallback(async (id: string) => {
    const { error } = await supabase.from("sprints").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover sprint"); return; }
    setSprints((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const closeSprint = useCallback(async (id: string) => {
    const sprint = sprints.find((s) => s.id === id);
    if (!sprint) { toast.error("Sprint não encontrada"); return; }
    const closedAt  = new Date().toISOString();
    const delayDays = calcDelayDays(sprint.endDate ?? null, closedAt);
    const { error } = await supabase.from("sprints").update({ is_active: false, closed_at: closedAt, delay_days: delayDays }).eq("id", id);
    if (error) { toast.error("Erro ao encerrar sprint: " + error.message); return; }
    setSprints((prev) => prev.map((s) => s.id === id ? { ...s, isActive: false, closedAt, delayDays } : s));
    if (delayDays > 0) {
      toast.warning(`⚠️ Sprint encerrada com ${delayDays} dia${delayDays > 1 ? "s" : ""} de atraso.`);
    } else {
      toast.success("✅ Sprint encerrada dentro do prazo!");
    }
  }, [sprints]);

  const setActiveSprintFn = useCallback(async (id: string) => {
    if (!teamId) return;
    const currentActive = sprints.find((s) => s.isActive);
    const ops: PromiseLike<any>[] = [];
    if (currentActive && currentActive.id !== id) {
      ops.push(supabase.from("sprints").update({ is_active: false }).eq("id", currentActive.id));
    }
    ops.push(supabase.from("sprints").update({ is_active: true }).eq("id", id));
    await Promise.all(ops);
    setSprints((prev) => prev.map((s) => ({ ...s, isActive: s.id === id })));
  }, [teamId, sprints]);

  // ── EPICS ──────────────────────────────────────────────────────────────────────
  const addEpic = useCallback(async (epic: Omit<Epic, "id" | "createdAt">) => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("epics")
      .insert({ team_id: teamId, name: epic.name, description: epic.description, color: epic.color })
      .select().single();
    if (error) { toast.error("Erro ao criar épico"); return; }
    if (data) setEpics((prev) =>
      prev.some((e) => e.id === data.id) ? prev : [...prev, { id: data.id, name: data.name, description: data.description || "", color: data.color, createdAt: data.created_at }]
    );
  }, [teamId]);

  const updateEpic = useCallback(async (id: string, epic: Partial<Omit<Epic, "id" | "createdAt">>) => {
    const { error } = await supabase.from("epics").update(epic).eq("id", id);
    if (error) { toast.error("Erro ao atualizar épico"); return; }
    setEpics((prev) => prev.map((e) => e.id === id ? { ...e, ...epic } : e));
  }, []);

  const removeEpic = useCallback(async (id: string) => {
    const { error } = await supabase.from("epics").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover épico"); return; }
    setEpics((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── CUSTOM FIELDS ─────────────────────────────────────────────────────────────
  const addCustomField = useCallback(async (field: Omit<CustomFieldDefinition, "id">) => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("custom_field_definitions")
      .insert({ team_id: teamId, name: field.name, field_type: field.type, options: field.options || null, required: field.required })
      .select().single();
    if (error) { toast.error("Erro ao criar campo"); return; }
    if (data) setCustomFields((prev) =>
      prev.some((f) => f.id === data.id) ? prev : [...prev, {
        id: data.id, key: (data as any).key || data.id, name: data.name || "",
        label: (data as any).label || data.name || "", type: data.field_type as any,
        options: data.options ?? null, required: data.required ?? false,
      }]
    );
  }, [teamId]);

  const updateCustomField = useCallback(async (id: string, field: Partial<Omit<CustomFieldDefinition, "id">>) => {
    const updateData: any = {};
    if (field.name !== undefined) updateData.name = field.name;
    if (field.type !== undefined) updateData.field_type = field.type;
    if (field.options !== undefined) updateData.options = field.options;
    if (field.required !== undefined) updateData.required = field.required;
    const { error } = await supabase.from("custom_field_definitions").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar campo"); return; }
    setCustomFields((prev) => prev.map((f) => f.id === id ? { ...f, ...field } : f));
  }, []);

  const removeCustomField = useCallback(async (id: string) => {
    const { error } = await supabase.from("custom_field_definitions").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover campo"); return; }
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ── AUTOMATION RULES ──────────────────────────────────────────────────────────
  const addAutomationRule = useCallback(async (rule: Omit<AutomationRule, "id" | "createdAt">) => {
    if (!teamId) return;
    const { data, error } = await supabase
      .from("automation_rules")
      .insert({
        team_id: teamId, name: rule.name,
        enabled: rule.enabled ?? (rule as any).isActive ?? true,
        trigger_type: rule.trigger.type, trigger_from_status: rule.trigger.fromStatus || null,
        trigger_to_status: rule.trigger.toStatus, action_type: rule.action.type,
        action_target_status: rule.action.targetStatus || null, action_message: rule.action.message || null,
      })
      .select().single();
    if (error) { toast.error("Erro ao criar automação"); return; }
    if (data) setAutomationRules((prev) =>
      prev.some((r) => r.id === data.id) ? prev : [...prev, {
        id: data.id, name: data.name, enabled: data.enabled ?? false,
        isActive: data.enabled ?? false,
        trigger: { type: data.trigger_type, fromStatus: data.trigger_from_status ?? null, toStatus: data.trigger_to_status },
        action: { type: data.action_type, targetStatus: data.action_target_status ?? null, message: data.action_message ?? null },
        createdAt: data.created_at,
      }]
    );
  }, [teamId]);

  const updateAutomationRule = useCallback(async (id: string, rule: Partial<Omit<AutomationRule, "id" | "createdAt">>) => {
    const updateData: any = {};
    if (rule.name !== undefined) updateData.name = rule.name;
    if (rule.enabled !== undefined) { updateData.enabled = rule.enabled; updateData.is_active = rule.enabled; }
    if ((rule as any).isActive !== undefined && rule.enabled === undefined) { updateData.enabled = (rule as any).isActive; updateData.is_active = (rule as any).isActive; }
    if (rule.trigger) {
      if (rule.trigger.type !== undefined) updateData.trigger_type = rule.trigger.type;
      if (rule.trigger.fromStatus !== undefined) updateData.trigger_from_status = rule.trigger.fromStatus;
      if (rule.trigger.toStatus !== undefined) updateData.trigger_to_status = rule.trigger.toStatus;
    }
    if (rule.action) {
      if (rule.action.type !== undefined) updateData.action_type = rule.action.type;
      if (rule.action.targetStatus !== undefined) updateData.action_target_status = rule.action.targetStatus;
      if (rule.action.message !== undefined) updateData.action_message = rule.action.message;
    }
    const { error } = await supabase.from("automation_rules").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar automação"); return; }
    setAutomationRules((prev) => prev.map((r) => r.id === id ? { ...r, ...rule } : r));
  }, []);

  const removeAutomationRule = useCallback(async (id: string) => {
    const { error } = await supabase.from("automation_rules").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover automação"); return; }
    setAutomationRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── WORKFLOW COLUMNS ──────────────────────────────────────────────────────────
  const setWorkflowColumns = useCallback(
    (columns: WorkflowColumn[]) => setWorkflowColumnsState(normalizeWorkflowColumns(columns)),
    [],
  );

  const addWorkflowColumn = useCallback(async (col: WorkflowColumn) => {
    if (!teamId) return;
    const normalized = normalizeWorkflowColumns([col])[0];
    const { error } = await supabase.from("workflow_columns").insert({
      team_id: teamId, key: normalized.key, label: normalized.label,
      color_class: normalized.colorClass || "", dot_color: normalized.dotColor || "",
      hex: normalized.hex, sort_order: workflowColumns.length,
    });
    if (error) { toast.error("Erro ao adicionar coluna"); return; }
    setWorkflowColumnsState((prev) => normalizeWorkflowColumns([...prev, normalized]));
  }, [teamId, workflowColumns.length]);

  const removeWorkflowColumn = useCallback(async (key: string) => {
    if (!teamId) return;
    const { error } = await supabase.from("workflow_columns").delete().eq("team_id", teamId).eq("key", key);
    if (error) { toast.error("Erro ao remover coluna"); return; }
    setWorkflowColumnsState((prev) => prev.filter((c) => c.key !== key));
  }, [teamId]);

  const updateWorkflowColumn = useCallback(async (key: string, col: Partial<WorkflowColumn>) => {
    if (!teamId) return;
    const updateData: any = {};
    if (col.label !== undefined) updateData.label = col.label;
    if (col.colorClass !== undefined) updateData.color_class = col.colorClass;
    if (col.dotColor !== undefined) { updateData.dot_color = col.dotColor; updateData.hex = getColumnHex({ key, label: "", colorClass: "", dotColor: col.dotColor, hex: col.hex } as WorkflowColumn); }
    if (col.hex !== undefined) updateData.hex = col.hex;
    if (col.wipLimit !== undefined) updateData.wip_limit = col.wipLimit;
    const { error } = await supabase.from("workflow_columns").update(updateData).eq("team_id", teamId).eq("key", key);
    if (error) { toast.error("Erro ao atualizar coluna"); return; }
    setWorkflowColumnsState((prev) => prev.map((c) => c.key === key ? { ...c, ...col } : c));
  }, [teamId]);

  const reorderWorkflowColumns = useCallback(async (columns: WorkflowColumn[]) => {
    if (!teamId) return;
    const normalized = normalizeWorkflowColumns(columns);
    const { data: existing, error: fetchErr } = await supabase
      .from("workflow_columns").select("key").eq("team_id", teamId);
    if (fetchErr) { toast.error("Erro ao sincronizar fluxo: " + fetchErr.message); return; }
    const existingKeys = new Set((existing ?? []).map((r: any) => r.key));
    const incomingKeys = new Set(normalized.map(c => c.key));
    const toInsert = normalized.filter(c => !existingKeys.has(c.key));
    const toUpdate = normalized.filter(c =>  existingKeys.has(c.key));
    const toDelete = [...existingKeys].filter(k => !incomingKeys.has(k));
    const ops: PromiseLike<any>[] = [];
    if (toInsert.length > 0) {
      const rows = toInsert.map((c) => ({
        team_id: teamId, key: c.key, label: c.label,
        color_class: c.colorClass || "", dot_color: c.dotColor || "",
        hex: c.hex || null, wip_limit: (c as any).wipLimit ?? null,
        sort_order: normalized.indexOf(c),
      }));
      ops.push(supabase.from("workflow_columns").insert(rows).then(({ error }) => { if (error) console.error(error); }));
    }
    for (const c of toUpdate) {
      ops.push(supabase.from("workflow_columns").update({
        sort_order: normalized.indexOf(c), label: c.label,
        color_class: c.colorClass || "", dot_color: c.dotColor || "",
        hex: c.hex || null, wip_limit: (c as any).wipLimit ?? null,
      }).eq("team_id", teamId).eq("key", c.key).then(({ error }) => { if (error) console.error(error); }));
    }
    for (const key of toDelete) {
      ops.push(supabase.from("workflow_columns").delete().eq("team_id", teamId).eq("key", key).then(({ error }) => { if (error) console.error(error); }));
    }
    await Promise.all(ops);
    setWorkflowColumnsState(normalized);
  }, [teamId]);

  return (
    <SprintContext.Provider value={{
      developers, userStories, activities, sprints, epics, customFields, automationRules,
      workflowColumns, activeSprint, loading, impediments,
      addDeveloper, updateDeveloper, removeDeveloper,
      addUserStory, updateUserStory, removeUserStory, updateUserStoryStatus, reorderUserStories,
      addActivity, updateActivity, removeActivity, closeActivity, reopenActivity,
      addImpediment, addSprintImpediment, resolveImpediment,
      addSprint, updateSprint, removeSprint, closeSprint, setActiveSprint: setActiveSprintFn,
      addEpic, updateEpic, removeEpic,
      addCustomField, updateCustomField, removeCustomField,
      addAutomationRule, updateAutomationRule, removeAutomationRule,
      setWorkflowColumns, addWorkflowColumn, removeWorkflowColumn, updateWorkflowColumn, reorderWorkflowColumns,
      refreshAll,
    }}>
      {children}
    </SprintContext.Provider>
  );
}

export function useSprint() {
  const ctx = useContext(SprintContext);
  if (!ctx) throw new Error("useSprint must be used within SprintProvider");
  return ctx;
}

// ─── PROBLEMA 3: Selectors — hooks granulares para evitar re-renders globais ──
//
// Uso: em vez de const { activities } = useSprint() em todo componente,
// use o selector específico. O componente só re-renderiza quando aquele
// slice de estado muda — não quando outros arrays do contexto mudam.
//
// Exemplo de migração em KanbanCard:
//   ANTES: const { developers, epics, activities, workflowColumns } = useSprint();
//   DEPOIS: const developers     = useDevelopers();
//           const epics          = useEpics();
//           const huActivities   = useActivitiesForHU(hu.id);  // já filtrado!
//           const workflowCols   = useWorkflowColumns();
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna apenas o sprint ativo. Re-renderiza só quando o sprint ativo muda. */
export function useActiveSprint() {
  const { sprints } = useSprint();
  return useMemo(() => sprints.find((s) => s.isActive) ?? null, [sprints]);
}

/** Retorna a lista de developers. Re-renderiza só quando developers muda. */
export function useDevelopers() {
  const { developers } = useSprint();
  return developers;
}

/** Retorna a lista de epics. Re-renderiza só quando epics muda. */
export function useEpics() {
  const { epics } = useSprint();
  return epics;
}

/** Retorna a lista de workflow columns. Re-renderiza só quando workflowColumns muda. */
export function useWorkflowColumns() {
  const { workflowColumns } = useSprint();
  return workflowColumns;
}

/**
 * Retorna activities filtradas por HU.
 * Re-renderiza APENAS quando activities da HU específica mudam.
 * Ideal para KanbanCard — evita re-render de todos os cards quando
 * uma atividade de outra HU é atualizada.
 */
export function useActivitiesForHU(huId: string): Activity[] {
  const { activities } = useSprint();
  return useMemo(
    () => activities.filter((a) => a.huId === huId),
    [activities, huId],
  );
}

/**
 * Retorna métricas computadas do sprint ativo.
 * Evita que MetricsDashboard re-execute cálculos pesados a cada re-render.
 */
export function useSprintMetrics() {
  const { userStories, activities, sprints } = useSprint();
  return useMemo(() => {
    const activeSprint = sprints.find((s) => s.isActive) ?? null;
    const totalHUs       = userStories.length;
    const completedHUs   = userStories.filter((h) => h.status === "concluido").length;
    const inProgressHUs  = userStories.filter((h) => h.status !== "concluido" && h.status !== "aguardando_desenvolvimento").length;
    const totalHours     = activities.reduce((s, a) => s + (a.hours ?? 0), 0);
    const closedHours    = activities.filter((a) => a.isClosed).reduce((s, a) => s + (a.hours ?? 0), 0);
    const openBugs       = activities.filter((a) => a.activityType === "bug" && !a.isClosed).length;
    const completionPct  = totalHUs > 0 ? Math.round((completedHUs / totalHUs) * 100) : 0;
    return {
      activeSprint,
      totalHUs,
      completedHUs,
      inProgressHUs,
      totalHours,
      closedHours,
      openBugs,
      completionPct,
    };
  }, [userStories, activities, sprints]);
}
