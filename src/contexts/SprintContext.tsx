import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
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

// ─── Guard: converte qualquer valor para número decimal seguro ────────────────
// Aceita: 4 | 4.0 | "4" | "4:00" | "1:30" | "0:45"
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
  /** Data em que o impedimento começou (yyyy-MM-dd). Opcional — se omitido usa a data atual. */
  startedAt?: string;
}

/** Target do impedimento: HU ou Sprint (pelo menos um deve estar preenchido) */
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

  const refreshAll = useCallback(async () => {
    if (!teamId) {
      setDevelopers([]); setUserStories([]); setActivities([]); setSprints([]);
      setEpics([]); setCustomFields([]); setAutomationRules([]);
      setWorkflowColumnsState(DEFAULT_KANBAN_COLUMNS); setImpediments([]);
      return;
    }
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

      setDevelopers((devRes.data || []).map((d: any) => ({ id: d.id, name: d.name, email: d.email, role: d.role, avatar: d.avatar })));

      setSprints((sprintRes.data || []).map((s: any) => ({
        id: s.id, name: s.name, startDate: s.start_date, endDate: s.end_date,
        goal: s.goal || "", isActive: s.is_active, createdAt: s.created_at,
      })));

      setEpics((epicRes.data || []).map((e: any) => ({
        id: e.id, name: e.name, description: e.description || "", color: e.color, createdAt: e.created_at,
      })));

      const impData = (impRes.data || []) as any[];
      const mapImp = (imp: any) => ({
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
      setImpediments(impData.map(mapImp));

      const huData = (huRes.data || []) as any[];
      setUserStories(huData.map((h: any) => ({
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
        impediments: impData.filter((imp: any) => imp.hu_id === h.id).map(mapImp),
        customFields: h.custom_fields || {}, createdAt: h.created_at,
      })));

      setActivities((actRes.data || []).map((a: any) => ({
        id: a.id, huId: a.hu_id, title: a.title, description: a.description || "",
        activityType: a.activity_type, assigneeId: a.assignee_id || "",
        hours: Number(a.hours), startDate: a.start_date, endDate: a.end_date,
        createdAt: a.created_at, isClosed: a.is_closed, closedAt: a.closed_at,
      })));

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
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

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

  // ── DEVELOPERS ────────────────────────────────────────────────────────────
  const addDeveloper = async (dev: Omit<Developer, "id">) => {
    if (!teamId) return;
    const { error } = await supabase.from("developers").insert({ team_id: teamId, name: dev.name, email: dev.email, role: dev.role, avatar: dev.avatar });
    if (error) { toast.error("Erro ao adicionar desenvolvedor"); return; }
    await refreshAll();
  };
  const updateDeveloper = async (id: string, dev: Partial<Omit<Developer, "id">>) => {
    const { error } = await supabase.from("developers").update(dev).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    await refreshAll();
  };
  const removeDeveloper = async (id: string) => { await supabase.from("developers").delete().eq("id", id); await refreshAll(); };

  // ── USER STORIES ──────────────────────────────────────────────────────────
  const addUserStory = async (hu: Omit<UserStory, "id" | "code" | "createdAt" | "impediments"> & { status?: string }) => {
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
  };

  const updateUserStory = async (id: string, hu: Partial<Omit<UserStory, "id" | "code" | "createdAt">>) => {
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
    await refreshAll();
  };

  const removeUserStory = async (id: string) => { await supabase.from("user_stories").delete().eq("id", id); await refreshAll(); };

  const updateUserStoryStatus = async (id: string, status: KanbanStatus) => {
    const hu = userStories.find((h) => h.id === id);
    if (hu) {
      const oldStatus = hu.status;
      const lastPosition = userStories.filter((h) => h.status === status).reduce((max, h) => Math.max(max, h.position ?? 0), -1) + 1;
      await supabase.from("user_stories").update({ status, position: lastPosition }).eq("id", id);
      if (oldStatus !== status) await runAutomations(id, oldStatus, status);
      await refreshAll();
    }
  };

  const reorderUserStories = async (updates: { id: string; position: number }[]) => {
    setUserStories((prev) => prev.map((hu) => { const upd = updates.find((u) => u.id === hu.id); return upd ? { ...hu, position: upd.position } : hu; }));
    await Promise.all(updates.map(({ id, position }) => supabase.from("user_stories").update({ position }).eq("id", id)));
  };

  // ── ACTIVITIES ────────────────────────────────────────────────────────────
  const addActivity = async (act: Omit<Activity, "id" | "endDate" | "createdAt">) => {
    if (!teamId) return;
    const safeHours = toDecimalHours(act.hours);
    // end_date = startDate: atividade sempre ocorre no mesmo dia
    const { error } = await supabase.from("activities").insert({
      team_id: teamId, hu_id: act.huId, title: act.title, description: act.description,
      activity_type: act.activityType, assignee_id: act.assigneeId || null,
      hours: safeHours, start_date: act.startDate, end_date: act.startDate,
    });
    if (error) { toast.error("Erro ao criar atividade"); return; }
    if (act.activityType === "bug") {
      const hu = userStories.find((h) => h.id === act.huId);
      const bugCol = workflowColumns.find((c) => c.key === "bug");
      if (hu && bugCol && hu.status !== "bug") {
        await supabase.from("user_stories").update({ status: "bug" }).eq("id", act.huId);
        toast.info(`🐛 HU movida para "${bugCol.label}"`);
      }
    }
    await refreshAll();
  };

  const updateActivity = async (id: string, act: Partial<Omit<Activity, "id" | "createdAt">>) => {
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
      // Só atualiza end_date se a atividade ainda não foi encerrada
      if (!existing.isClosed) {
        updateData.end_date = act.startDate;
      }
    }
    const { error } = await supabase.from("activities").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar atividade"); return; }
    await refreshAll();
  };

  const removeActivity = async (id: string) => { await supabase.from("activities").delete().eq("id", id); await refreshAll(); };

  const closeActivity = async (id: string) => {
    // Grava is_closed, closed_at E end_date com a data real de encerramento
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("activities").update({
      is_closed: true,
      closed_at: new Date().toISOString(),
      end_date: today,
    }).eq("id", id);
    await refreshAll();
    const act = activities.find((a) => a.id === id);
    if (act && act.activityType === "bug") {
      const hu = userStories.find((h) => h.id === act.huId);
      const huActs = activities.filter((a) => a.huId === act.huId);
      if (hu && hu.status === "bug") {
        const remainingOpenBugs = huActs.filter((a) => a.id !== id && a.activityType === "bug" && !a.isClosed);
        if (remainingOpenBugs.length === 0) {
          const targetCol = workflowColumns.find((c) => c.key === "em_teste");
          if (targetCol) {
            await supabase.from("user_stories").update({ status: "em_teste" }).eq("id", act.huId);
            toast.success(`✅ Bug resolvido! HU retornou para "${targetCol.label}"`);
            await refreshAll();
          }
        }
      }
    }
  };

  const reopenActivity = async (id: string) => {
    // Ao reabrir, limpa end_date para indicar que está em andamento novamente
    await supabase.from("activities").update({ is_closed: false, closed_at: null, end_date: null }).eq("id", id);
    await refreshAll();
  };

  // ── IMPEDIMENTS ───────────────────────────────────────────────────────────
  const addImpediment = async (target: ImpedimentTarget | string, data: AddImpedimentData) => {
    if (!teamId) return;
    const huId    = typeof target === "string" ? target : (target.huId    ?? null);
    const sprintId = typeof target === "string" ? null   : (target.sprintId ?? null);
    if (!huId && !sprintId) { toast.error("Informe uma HU ou Sprint para o impedimento"); return; }
    const { error } = await supabase.from("impediments").insert({
      team_id:    teamId,
      hu_id:      huId,
      sprint_id:  sprintId,
      reason:     data.reason,
      type:       data.type,
      criticality: data.criticality,
      has_ticket:  data.hasTicket,
      ticket_url:  data.ticketUrl ?? null,
      ticket_id:   data.ticketId  ?? null,
      started_at:  data.startedAt ?? null,
    });
    if (error) { toast.error("Erro ao adicionar impedimento: " + error.message); return; }
    await refreshAll();
  };

  const addSprintImpediment = async (sprintId: string, data: AddImpedimentData) => addImpediment({ sprintId }, data);

  const resolveImpediment = async (_: string | null, impedimentId: string, resolution?: string) => {
    await supabase.from("impediments").update({ resolved_at: new Date().toISOString(), resolution: resolution || null }).eq("id", impedimentId);
    await refreshAll();
  };

  // ── SPRINTS ───────────────────────────────────────────────────────────────
  const addSprint = async (sprint: Omit<Sprint, "id" | "createdAt" | "isActive">) => {
    if (!teamId) return;
    await supabase.from("sprints").update({ is_active: false }).eq("team_id", teamId);
    const { error } = await supabase.from("sprints").insert({ team_id: teamId, name: sprint.name, start_date: sprint.startDate, end_date: sprint.endDate, goal: sprint.goal, is_active: true });
    if (error) { toast.error("Erro ao criar sprint"); return; }
    await refreshAll();
  };
  const updateSprint = async (id: string, sprint: Partial<Omit<Sprint, "id" | "createdAt">>) => {
    const updateData: any = {};
    if (sprint.name !== undefined) updateData.name = sprint.name;
    if (sprint.startDate !== undefined) updateData.start_date = sprint.startDate;
    if (sprint.endDate !== undefined) updateData.end_date = sprint.endDate;
    if (sprint.goal !== undefined) updateData.goal = sprint.goal;
    if (sprint.isActive !== undefined) updateData.is_active = sprint.isActive;
    const { error } = await supabase.from("sprints").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar sprint"); return; }
    await refreshAll();
  };
  const removeSprint = async (id: string) => { await supabase.from("sprints").delete().eq("id", id); await refreshAll(); };
  const setActiveSprintFn = async (id: string) => {
    if (!teamId) return;
    await supabase.from("sprints").update({ is_active: false }).eq("team_id", teamId);
    await supabase.from("sprints").update({ is_active: true }).eq("id", id);
    await refreshAll();
  };

  // ── EPICS ─────────────────────────────────────────────────────────────────
  const addEpic = async (epic: Omit<Epic, "id" | "createdAt">) => {
    if (!teamId) return;
    const { error } = await supabase.from("epics").insert({ team_id: teamId, name: epic.name, description: epic.description, color: epic.color });
    if (error) { toast.error("Erro ao criar épico"); return; }
    await refreshAll();
  };
  const updateEpic = async (id: string, epic: Partial<Omit<Epic, "id" | "createdAt">>) => {
    const { error } = await supabase.from("epics").update(epic).eq("id", id);
    if (error) { toast.error("Erro ao atualizar épico"); return; }
    await refreshAll();
  };
  const removeEpic = async (id: string) => { await supabase.from("epics").delete().eq("id", id); await refreshAll(); };

  // ── CUSTOM FIELDS ─────────────────────────────────────────────────────────
  const addCustomField = async (field: Omit<CustomFieldDefinition, "id">) => {
    if (!teamId) return;
    const { error } = await supabase.from("custom_field_definitions").insert({ team_id: teamId, name: field.name, field_type: field.type, options: field.options || null, required: field.required });
    if (error) { toast.error("Erro ao criar campo"); return; }
    await refreshAll();
  };
  const updateCustomField = async (id: string, field: Partial<Omit<CustomFieldDefinition, "id">>) => {
    const updateData: any = {};
    if (field.name !== undefined) updateData.name = field.name;
    if (field.type !== undefined) updateData.field_type = field.type;
    if (field.options !== undefined) updateData.options = field.options;
    if (field.required !== undefined) updateData.required = field.required;
    const { error } = await supabase.from("custom_field_definitions").update(updateData).eq("id", id);
    if (error) { toast.error("Erro ao atualizar campo"); return; }
    await refreshAll();
  };
  const removeCustomField = async (id: string) => { await supabase.from("custom_field_definitions").delete().eq("id", id); await refreshAll(); };

  // ── AUTOMATION RULES ──────────────────────────────────────────────────────
  const addAutomationRule = async (rule: Omit<AutomationRule, "id" | "createdAt">) => {
    if (!teamId) return;
    const { error } = await supabase.from("automation_rules").insert({
      team_id: teamId, name: rule.name,
      enabled: rule.enabled ?? (rule as any).isActive ?? true,
      is_active: rule.enabled ?? (rule as any).isActive ?? true,
      trigger_type: rule.trigger.type, trigger_from_status: rule.trigger.fromStatus || null,
      trigger_to_status: rule.trigger.toStatus, action_type: rule.action.type,
      action_target_status: rule.action.targetStatus || null, action_message: rule.action.message || null,
    });
    if (error) { toast.error("Erro ao criar automação"); return; }
    await refreshAll();
  };
  const updateAutomationRule = async (id: string, rule: Partial<Omit<AutomationRule, "id" | "createdAt">>) => {
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
    await refreshAll();
  };
  const removeAutomationRule = async (id: string) => { await supabase.from("automation_rules").delete().eq("id", id); await refreshAll(); };

  // ── WORKFLOW COLUMNS ──────────────────────────────────────────────────────
  const setWorkflowColumns = (columns: WorkflowColumn[]) => setWorkflowColumnsState(normalizeWorkflowColumns(columns));
  const addWorkflowColumn = async (col: WorkflowColumn) => {
    if (!teamId) return;
    const normalized = normalizeWorkflowColumns([col])[0];
    const { error } = await supabase.from("workflow_columns").insert({ team_id: teamId, key: normalized.key, label: normalized.label, color_class: normalized.colorClass || "", dot_color: normalized.dotColor || "", hex: normalized.hex, sort_order: workflowColumns.length });
    if (error) { toast.error("Erro ao adicionar coluna"); return; }
    await refreshAll();
  };
  const removeWorkflowColumn = async (key: string) => {
    if (!teamId) return;
    await supabase.from("workflow_columns").delete().eq("team_id", teamId).eq("key", key);
    await refreshAll();
  };
  const updateWorkflowColumn = async (key: string, col: Partial<WorkflowColumn>) => {
    if (!teamId) return;
    const updateData: any = {};
    if (col.label !== undefined) updateData.label = col.label;
    if (col.colorClass !== undefined) updateData.color_class = col.colorClass;
    if (col.dotColor !== undefined) { updateData.dot_color = col.dotColor; updateData.hex = getColumnHex({ key, label: "", colorClass: "", dotColor: col.dotColor, hex: col.hex } as WorkflowColumn); }
    if (col.hex !== undefined) updateData.hex = col.hex;
    if (col.wipLimit !== undefined) updateData.wip_limit = col.wipLimit;
    await supabase.from("workflow_columns").update(updateData).eq("team_id", teamId).eq("key", key);
    await refreshAll();
  };
  const reorderWorkflowColumns = async (columns: WorkflowColumn[]) => {
    if (!teamId) return;
    const normalized = normalizeWorkflowColumns(columns);
    for (let i = 0; i < columns.length; i++) {
      const c = normalized[i];
      await supabase.from("workflow_columns").update({ sort_order: i, label: c.label, color_class: c.colorClass || "", dot_color: c.dotColor || "", hex: c.hex || null }).eq("team_id", teamId).eq("key", c.key);
    }
    setWorkflowColumnsState(normalized);
  };

  return (
    <SprintContext.Provider value={{
      developers, userStories, activities, sprints, epics, customFields, automationRules,
      workflowColumns, activeSprint, loading, impediments,
      addDeveloper, updateDeveloper, removeDeveloper,
      addUserStory, updateUserStory, removeUserStory, updateUserStoryStatus, reorderUserStories,
      addActivity, updateActivity, removeActivity, closeActivity, reopenActivity,
      addImpediment, addSprintImpediment, resolveImpediment,
      addSprint, updateSprint, removeSprint, setActiveSprint: setActiveSprintFn,
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
