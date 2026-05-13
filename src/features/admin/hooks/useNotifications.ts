import { useMemo } from "react";
import type { TeamKpis } from "./useAdminKpis";

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationCategory = "sprint" | "impedimento" | "sla" | "backlog" | "capacidade";

export interface AppNotification {
  id:         string;
  severity:   NotificationSeverity;
  category:   NotificationCategory;
  teamId:     string;
  teamName:   string;
  title:      string;
  description:string;
  value?:     number | string;
  createdAt:  Date;
}

// ── Thresholds ────────────────────────────────────────────────────────────────
const T = {
  sprintCriticalDays:  1,   // ≤ 1 dia restante → critical
  sprintWarningDays:   2,   // ≤ 2 dias restantes → warning
  impedCritical:       5,   // ≥ 5 impedimentos abertos
  impedWarning:        2,   // ≥ 2 impedimentos abertos
  slaCritical:         3,   // ≥ 3 demandas SLA em risco
  slaWarning:          1,   // ≥ 1 demanda SLA em risco
  backlogWarning:      20,  // backlog > 20 HUs sem sprint
  conclusaoBaixaCrit:  30,  // taxa de conclusão < 30% e sprint encerra em breve
  conclusaoBaixaWarn:  50,
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ── Hook ────────────────────────────────────────────────────────────────────────
export function useNotifications(byTeam: TeamKpis[]): {
  notifications: AppNotification[];
  criticalCount: number;
  warningCount:  number;
  totalCount:    number;
} {
  const notifications = useMemo<AppNotification[]>(() => {
    const result: AppNotification[] = [];
    const now = new Date();

    byTeam.forEach(team => {
      const diasRestantes = daysUntil(team.sprintEndDate);

      // ─ 1. Sprint expirando ──────────────────────────────────────────────
      if (diasRestantes !== null && diasRestantes >= 0 && team.sprintAtivo) {
        if (diasRestantes <= T.sprintCriticalDays) {
          result.push({
            id: `sprint-critical-${team.teamId}`,
            severity: "critical",
            category: "sprint",
            teamId: team.teamId,
            teamName: team.teamName,
            title: `Sprint encerrando hoje — ${team.teamName}`,
            description: `"${team.sprintAtivo}" encerra em menos de 1 dia. ${team.husConcluidasNoSprint}/${team.totalHUs} HUs concluídas.`,
            value: diasRestantes,
            createdAt: now,
          });
        } else if (diasRestantes <= T.sprintWarningDays) {
          result.push({
            id: `sprint-warning-${team.teamId}`,
            severity: "warning",
            category: "sprint",
            teamId: team.teamId,
            teamName: team.teamName,
            title: `Sprint expira em ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""} — ${team.teamName}`,
            description: `"${team.sprintAtivo}": ${team.husConcluidasNoSprint}/${team.totalHUs} HUs concluídas (${team.totalHUs > 0 ? Math.round(team.husConcluidasNoSprint / team.totalHUs * 100) : 0}%).`,
            value: diasRestantes,
            createdAt: now,
          });
        }
      }

      // ─ 2. Sprint encerrado sem ser fechado (endDate no passado mas ainda ativo) ──
      if (diasRestantes !== null && diasRestantes < 0 && team.sprintAtivo) {
        result.push({
          id: `sprint-overdue-${team.teamId}`,
          severity: "critical",
          category: "sprint",
          teamId: team.teamId,
          teamName: team.teamName,
          title: `Sprint expirado sem encerramento — ${team.teamName}`,
          description: `"${team.sprintAtivo}" deveria ter encerrado há ${Math.abs(diasRestantes)} dia${Math.abs(diasRestantes) !== 1 ? "s" : ""}. Encerre o sprint.`,
          value: diasRestantes,
          createdAt: now,
        });
      }

      // ─ 3. Taxa de conclusão baixa perto do fim ───────────────────────────
      if (diasRestantes !== null && diasRestantes <= 3 && team.totalHUs > 0 && team.sprintAtivo) {
        const taxa = Math.round(team.husConcluidasNoSprint / team.totalHUs * 100);
        if (taxa < T.conclusaoBaixaCrit) {
          result.push({
            id: `conclusao-critical-${team.teamId}`,
            severity: "critical",
            category: "sprint",
            teamId: team.teamId,
            teamName: team.teamName,
            title: `Taxa de conclusão crítica — ${team.teamName}`,
            description: `Apenas ${taxa}% das HUs concluídas com ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""} restante${diasRestantes !== 1 ? "s" : ""}.`,
            value: taxa,
            createdAt: now,
          });
        } else if (taxa < T.conclusaoBaixaWarn) {
          result.push({
            id: `conclusao-warning-${team.teamId}`,
            severity: "warning",
            category: "sprint",
            teamId: team.teamId,
            teamName: team.teamName,
            title: `Conclusão abaixo do esperado — ${team.teamName}`,
            description: `${taxa}% das HUs concluídas com ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""} restante${diasRestantes !== 1 ? "s" : ""}.`,
            value: taxa,
            createdAt: now,
          });
        }
      }

      // ─ 4. Impedimentos abertos ──────────────────────────────────────────────
      if (team.impedimentosAbertos >= T.impedCritical) {
        result.push({
          id: `impedit-critical-${team.teamId}`,
          severity: "critical",
          category: "impedimento",
          teamId: team.teamId,
          teamName: team.teamName,
          title: `${team.impedimentosAbertos} impedimentos abertos — ${team.teamName}`,
          description: `Volume crítico de impedimentos sem resolução. Intervenção imediata recomendada.`,
          value: team.impedimentosAbertos,
          createdAt: now,
        });
      } else if (team.impedimentosAbertos >= T.impedWarning) {
        result.push({
          id: `impedit-warning-${team.teamId}`,
          severity: "warning",
          category: "impedimento",
          teamId: team.teamId,
          teamName: team.teamName,
          title: `${team.impedimentosAbertos} impedimentos abertos — ${team.teamName}`,
          description: `Verifique os impedimentos abertos para não impactar a entrega do sprint.`,
          value: team.impedimentosAbertos,
          createdAt: now,
        });
      }

      // ─ 5. SLA em risco ─────────────────────────────────────────────────────────
      if (team.slaEmRisco >= T.slaCritical) {
        result.push({
          id: `sla-critical-${team.teamId}`,
          severity: "critical",
          category: "sla",
          teamId: team.teamId,
          teamName: team.teamName,
          title: `${team.slaEmRisco} demandas com SLA vencido — ${team.teamName}`,
          description: `Demandas abertas há mais de 5 dias sem resolução. Risco de violação de SLA.`,
          value: team.slaEmRisco,
          createdAt: now,
        });
      } else if (team.slaEmRisco >= T.slaWarning) {
        result.push({
          id: `sla-warning-${team.teamId}`,
          severity: "warning",
          category: "sla",
          teamId: team.teamId,
          teamName: team.teamName,
          title: `${team.slaEmRisco} demanda${team.slaEmRisco !== 1 ? "s" : ""} com SLA em risco — ${team.teamName}`,
          description: `Demanda${team.slaEmRisco !== 1 ? "s" : ""} aberta${team.slaEmRisco !== 1 ? "s" : ""} há mais de 5 dias sem resolução.`,
          value: team.slaEmRisco,
          createdAt: now,
        });
      }

      // ─ 6. Backlog excessivo ──────────────────────────────────────────────────
      if (team.backlogTotal > T.backlogWarning) {
        result.push({
          id: `backlog-warning-${team.teamId}`,
          severity: "info",
          category: "backlog",
          teamId: team.teamId,
          teamName: team.teamName,
          title: `Backlog alto — ${team.teamName}`,
          description: `${team.backlogTotal} HUs no backlog sem sprint atribuído. Considere priorizar no próximo planejamento.`,
          value: team.backlogTotal,
          createdAt: now,
        });
      }
    });

    // Ordenar: critical > warning > info, depois por teamName
    return result.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
      return a.teamName.localeCompare(b.teamName);
    });
  }, [byTeam]);

  const criticalCount = useMemo(() => notifications.filter(n => n.severity === "critical").length, [notifications]);
  const warningCount  = useMemo(() => notifications.filter(n => n.severity === "warning").length,  [notifications]);

  return { notifications, criticalCount, warningCount, totalCount: notifications.length };
}
