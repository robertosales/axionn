import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CalendarDays,
  Check,
  FileText,
  ExternalLink,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSprint } from "@/contexts/SprintContext";
import { useOrganizationUsage } from "@/features/organization/hooks/useOrganizationUsage";
import { useBriefing } from "../hooks/useBriefing";
import type { BriefingSuggestionRecord } from "../services/briefing.service";
import {
  getTeamBriefingFollowup,
  listTeamBriefings,
  type BriefingFollowup,
  type BriefingHistoryItem,
} from "../services/briefing.service";
import type { BriefingSuggestionType, BriefingType } from "../types/briefing";

const TYPE_LABELS: Record<BriefingType, string> = {
  daily: "Daily",
  planning: "Planning",
  review: "Review",
  retro: "Retrospectiva",
  discovery: "Discovery",
  free: "Reunião livre",
};

const SUGGESTION_LABELS: Record<BriefingSuggestionType, string> = {
  decision: "Decisão",
  action: "Ação",
  impediment: "Impedimento",
  risk: "Risco",
  open_question: "Pergunta em aberto",
  backlog_candidate: "Candidato ao backlog",
};

const MIN_SOURCE_LENGTH = 20;

export default function BriefingPage() {
  const navigate = useNavigate();
  const { currentTeamId, currentTeam } = useAuth();
  const { currentOrganizationId } = useOrganization();
  const { activeSprint } = useSprint();
  const { entitlements, loading: entitlementLoading } = useOrganizationUsage();
  const {
    briefing,
    creating,
    reviewingId,
    applyingId,
    error,
    createAndProcess,
    review,
    apply,
    reset,
    open,
  } = useBriefing();

  const [type, setType] = useState<BriefingType>("daily");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [sourceContent, setSourceContent] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<
    string | null
  >(null);
  const [editingSuggestion, setEditingSuggestion] =
    useState<BriefingSuggestionRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [history, setHistory] = useState<BriefingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [followup, setFollowup] = useState<BriefingFollowup | null>(null);

  const enabled = entitlements.some(
    (entitlement) =>
      entitlement.featureKey === "ai.briefing.enabled" && entitlement.enabled,
  );
  const canApply = entitlements.some(
    (entitlement) =>
      entitlement.featureKey === "ai.briefing.apply_actions" &&
      entitlement.enabled,
  );
  const maxChars =
    entitlements.find(
      (entitlement) =>
        entitlement.featureKey === "ai.briefing.max_input_chars",
    )?.limitValue ?? 30_000;
  const selectedSuggestion = useMemo(
    () =>
      briefing?.suggestions.find(
        (suggestion) => suggestion.id === selectedSuggestionId,
      ) ?? briefing?.suggestions[0] ?? null,
    [briefing, selectedSuggestionId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!currentTeamId) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    Promise.all([
      listTeamBriefings(currentTeamId),
      getTeamBriefingFollowup(currentTeamId),
    ])
      .then(([items, followupData]) => {
        if (!cancelled) {
          setHistory(items);
          setFollowup(followupData);
        }
      })
      .catch((cause) => {
        console.error("[BriefingPage] history load failed", cause);
        if (!cancelled) {
          setHistory([]);
          setFollowup(null);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentTeamId, briefing?.status]);

  const openBriefing = async (briefingId: string) => {
    setOpeningId(briefingId);
    try {
      const loaded = await open(briefingId);
      setSelectedSuggestionId(loaded.suggestions[0]?.id ?? null);
    } catch {
      toast.error("Não foi possível abrir o briefing.");
    } finally {
      setOpeningId(null);
    }
  };

  const submit = async () => {
    if (!currentOrganizationId || !currentTeamId) {
      toast.error("Selecione uma organização e uma equipe.");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("Informe um título para a reunião.");
      return;
    }
    if (sourceContent.trim().length < MIN_SOURCE_LENGTH) {
      toast.error("A transcrição precisa ter pelo menos 20 caracteres.");
      return;
    }
    if (sourceContent.trim().length > maxChars) {
      toast.error(`O plano permite até ${maxChars} caracteres.`);
      return;
    }

    try {
      const result = await createAndProcess({
        organizationId: currentOrganizationId,
        teamId: currentTeamId,
        sprintId: activeSprint?.id ?? null,
        type,
        title,
        sourceContent,
        meetingDate: meetingDate
          ? new Date(`${meetingDate}T12:00:00`).toISOString()
          : null,
      });
      setSelectedSuggestionId(result.suggestions[0]?.id ?? null);
      toast.success(
        `${result.suggestions.length} sugestão(ões) pronta(s) para revisão.`,
      );
    } catch {
      toast.error("Não foi possível processar o briefing.");
    }
  };

  const handleReview = async (
    suggestionId: string,
    status: "approved" | "rejected",
  ) => {
    try {
      await review(suggestionId, status);
      toast.success(
        status === "approved" ? "Sugestão aprovada." : "Sugestão descartada.",
      );
    } catch {
      toast.error("Não foi possível registrar a revisão.");
    }
  };

  const openEditor = (suggestion: BriefingSuggestionRecord) => {
    setEditingSuggestion(suggestion);
    setEditTitle(suggestion.title);
    setEditDescription(suggestion.description);
    setEditAssignee(suggestion.assigneeName ?? "");
    setEditDueDate(suggestion.dueDate ?? "");
  };

  const saveEditedSuggestion = async () => {
    if (!editingSuggestion || editTitle.trim().length < 3) {
      toast.error("Informe um título válido.");
      return;
    }

    try {
      await review(editingSuggestion.id, "edited", {
        type: editingSuggestion.type,
        title: editTitle.trim(),
        description: editDescription.trim(),
        assigneeName: editAssignee.trim() || null,
        dueDate: editDueDate || null,
        dateSource: editDueDate
          ? editingSuggestion.dateSource === "absent"
            ? "inferred"
            : editingSuggestion.dateSource
          : "absent",
        priority: editingSuggestion.priority,
      });
      setEditingSuggestion(null);
      toast.success("Sugestão editada e aprovada para a próxima etapa.");
    } catch {
      toast.error("Não foi possível salvar a edição.");
    }
  };

  const applicableSuggestions =
    briefing?.suggestions.filter(
      (suggestion) =>
        ["action", "backlog_candidate", "impediment"].includes(
          suggestion.type,
        ) &&
        ["approved", "edited"].includes(suggestion.reviewStatus),
    ) ?? [];

  const handleApply = async (suggestionId: string) => {
    try {
      const result = await apply(suggestionId);
      toast.success(
        result?.target_type === "impediment"
          ? "Impedimento criado na sprint."
          : "Item criado no backlog da sprint.",
      );
    } catch {
      toast.error("Não foi possível aplicar a sugestão.");
    }
  };

  const applyAll = async () => {
    for (const suggestion of applicableSuggestions) {
      try {
        await apply(suggestion.id);
      } catch {
        toast.error(`Falha ao aplicar “${suggestion.title}”.`);
        return;
      }
    }
    toast.success("Todas as sugestões aprovadas foram aplicadas.");
  };

  if (!entitlementLoading && !enabled) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Axionn Briefing
          </CardTitle>
          <CardDescription>
            Este recurso não está habilitado no plano atual da organização.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (briefing) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <h1 className="text-2xl font-semibold">{briefing.title}</h1>
              <Badge variant="secondary">{TYPE_LABELS[briefing.type]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Revise cada item. Nada será criado no projeto sem uma etapa
              posterior de aplicação.
            </p>
          </div>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Novo briefing
          </Button>
          {canApply && applicableSuggestions.length > 0 && (
            <Button onClick={() => void applyAll()}>
              <Check className="mr-2 h-4 w-4" />
              Aplicar aprovadas ({applicableSuggestions.length})
            </Button>
          )}
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {briefing.summary && (
          <Card className="border-indigo-500/20 bg-indigo-500/[0.03]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-indigo-500" />
                Resumo executivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {briefing.summary}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcrição</CardTitle>
              <CardDescription>
                A evidência selecionada aparece destacada abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[620px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-6">
                {briefing.sourceContent}
              </div>
              {selectedSuggestion?.evidence.map((evidence) => (
                <blockquote
                  key={evidence.id}
                  className="mt-3 border-l-4 border-indigo-500 bg-indigo-500/5 p-3 text-sm"
                >
                  “{evidence.quoteText}”
                  {evidence.speakerName && (
                    <footer className="mt-1 text-xs text-muted-foreground">
                      — {evidence.speakerName}
                    </footer>
                  )}
                </blockquote>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {briefing.suggestions.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma sugestão verificável foi encontrada.
                </CardContent>
              </Card>
            )}

            {briefing.suggestions.map((suggestion) => {
              const busy = reviewingId === suggestion.id;
              const applying = applyingId === suggestion.id;
              const reviewed = suggestion.reviewStatus !== "pending";
              const applicable = [
                "action",
                "backlog_candidate",
                "impediment",
              ].includes(suggestion.type);
              return (
                <Card
                  key={suggestion.id}
                  className={
                    selectedSuggestion?.id === suggestion.id
                      ? "border-indigo-500/60"
                      : ""
                  }
                  onClick={() => setSelectedSuggestionId(suggestion.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge variant="outline">
                          {SUGGESTION_LABELS[suggestion.type]}
                        </Badge>
                        <CardTitle className="mt-2 text-base">
                          {suggestion.title}
                        </CardTitle>
                      </div>
                      <Badge
                        variant={
                          suggestion.reviewStatus === "approved"
                            ? "default"
                            : suggestion.reviewStatus === "applied"
                              ? "default"
                            : suggestion.reviewStatus === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {suggestion.reviewStatus === "pending"
                          ? "Pendente"
                          : suggestion.reviewStatus === "approved"
                            ? "Aprovada"
                            : suggestion.reviewStatus === "applied"
                              ? "Aplicada"
                            : suggestion.reviewStatus === "edited"
                              ? "Editada"
                            : suggestion.reviewStatus === "rejected"
                              ? "Descartada"
                              : suggestion.reviewStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {suggestion.description && (
                      <p className="text-sm text-muted-foreground">
                        {suggestion.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {suggestion.assigneeName && (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {suggestion.assigneeName}
                        </span>
                      )}
                      {suggestion.dueDate && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(
                            `${suggestion.dueDate}T12:00:00`,
                          ).toLocaleDateString("pt-BR")}
                          {suggestion.dateSource === "inferred" &&
                            " (sugerida)"}
                        </span>
                      )}
                      <span>
                        {suggestion.evidence.length} evidência(s)
                      </span>
                    </div>
                    {!reviewed && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleReview(suggestion.id, "approved");
                          }}
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditor(suggestion);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleReview(suggestion.id, "rejected");
                          }}
                        >
                          <X className="mr-2 h-4 w-4" /> Descartar
                        </Button>
                      </div>
                    )}
                    {canApply &&
                      applicable &&
                      ["approved", "edited"].includes(
                        suggestion.reviewStatus,
                      ) && (
                        <Button
                          size="sm"
                          disabled={applying}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleApply(suggestion.id);
                          }}
                        >
                          {applying && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Aplicar no projeto
                        </Button>
                      )}
                    {suggestion.application && (
                      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
                        <div className="text-xs">
                          <span className="font-medium text-foreground">
                            {suggestion.application.targetType === "impediment"
                              ? "Impedimento criado"
                              : "HU criada"}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {new Date(
                              suggestion.application.appliedAt,
                            ).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(
                              suggestion.application?.targetType ===
                                "impediment"
                                ? "/sala-agil/impedimentos"
                                : "/sala-agil/backlog",
                            );
                          }}
                        >
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Abrir
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Dialog
          open={Boolean(editingSuggestion)}
          onOpenChange={(open) => !open && setEditingSuggestion(null)}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar sugestão</DialogTitle>
              <DialogDescription>
                O conteúdo original e suas evidências permanecerão preservados
                para auditoria.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={editTitle}
                  maxLength={240}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editDescription}
                  rows={5}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Responsável mencionado</Label>
                  <Input
                    value={editAssignee}
                    onChange={(event) => setEditAssignee(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(event) => setEditDueDate(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingSuggestion(null)}
              >
                Cancelar
              </Button>
              <Button
                disabled={reviewingId === editingSuggestion?.id}
                onClick={() => void saveEditedSuggestion()}
              >
                {reviewingId === editingSuggestion?.id && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar revisão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-500" />
          <h1 className="text-2xl font-semibold">Axionn Briefing</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Transforme uma reunião em decisões, ações e impedimentos com
          evidências verificáveis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova análise</CardTitle>
          <CardDescription>
            Equipe: {currentTeam?.name ?? "não selecionada"}
            {activeSprint ? ` · Sprint: ${activeSprint.name}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo da reunião</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as BriefingType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Título</Label>
              <Input
                value={title}
                maxLength={200}
                placeholder="Ex.: Daily do time Core"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data da reunião</Label>
            <Input
              type="date"
              className="max-w-xs"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Transcrição ou ata</Label>
              <span className="text-xs text-muted-foreground">
                {sourceContent.length.toLocaleString("pt-BR")} /{" "}
                {maxChars.toLocaleString("pt-BR")}
              </span>
            </div>
            <Textarea
              value={sourceContent}
              maxLength={maxChars}
              rows={16}
              placeholder="Cole aqui a transcrição da reunião..."
              onChange={(event) => setSourceContent(event.target.value)}
            />
          </div>

          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              A IA apenas criará rascunhos para sua revisão.
            </p>
            <Button
              size="lg"
              disabled={
                creating ||
                entitlementLoading ||
                !enabled ||
                !currentOrganizationId ||
                !currentTeamId
              }
              onClick={() => void submit()}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {creating ? "Analisando..." : "Analisar briefing"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {followup && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Briefings", followup.totalBriefings],
              ["Aguardando revisão", followup.pendingReview],
              ["Prontos para aplicar", followup.readyToApply],
              ["Itens aplicados", followup.appliedItems],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="pt-5">
                  <div className="text-2xl font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {followup.overdueItems > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/[0.03]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {followup.overdueItems} compromisso(s) vencido(s)
                </CardTitle>
                <CardDescription>
                  Datas extraídas das reuniões que ainda exigem revisão ou
                  aplicação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {followup.attentionItems.map((item) => (
                  <button
                    key={item.suggestionId}
                    type="button"
                    className="flex w-full items-center justify-between gap-4 rounded-md border bg-background p-3 text-left hover:bg-muted/40"
                    onClick={() => void openBriefing(item.briefingId)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {item.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.briefingTitle}
                      </div>
                    </div>
                    <Badge variant="destructive">
                      {new Date(
                        `${item.dueDate}T12:00:00`,
                      ).toLocaleDateString("pt-BR")}
                    </Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" /> Histórico da equipe
          </CardTitle>
          <CardDescription>
            Reabra análises anteriores para concluir revisões e aplicações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum briefing processado para esta equipe.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40"
                  disabled={openingId === item.id}
                  onClick={() => void openBriefing(item.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {item.title}
                      </span>
                      <Badge variant="outline">
                        {TYPE_LABELS[item.type]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                      {item.suggestionCount} sugestão(ões)
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{item.status}</Badge>
                    {openingId === item.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
