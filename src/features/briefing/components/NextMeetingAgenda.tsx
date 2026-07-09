import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  SkipForward,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateBriefingAgenda, type AgendaItem } from "../services/briefing.service";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Acoes abertas": <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  "Impedimentos pendentes": <XCircle className="h-4 w-4 text-rose-500" />,
  "Itens vencidos": <AlertTriangle className="h-4 w-4 text-amber-500" />,
  "Decisoes pendentes": <Lightbulb className="h-4 w-4 text-violet-500" />,
  "Perguntas em aberto": <HelpCircle className="h-4 w-4 text-sky-500" />,
  "Candidatos ao backlog": <MessageSquare className="h-4 w-4 text-indigo-500" />,
};

const PRIORITY_BADGE: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  low: "secondary",
  medium: "default",
  high: "destructive",
  urgent: "destructive",
};

interface NextMeetingAgendaProps {
  teamId: string | null;
  onOpenBriefing: (briefingId: string) => void;
}

export function NextMeetingAgenda({ teamId, onOpenBriefing }: NextMeetingAgendaProps) {
  const [agenda, setAgenda] = useState<AgendaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [briefingType, setBriefingType] = useState("daily");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!teamId) {
      setAgenda(null);
      return;
    }
    setLoading(true);
    generateBriefingAgenda(teamId, briefingType)
      .then(setAgenda)
      .catch(() => setAgenda(null))
      .finally(() => setLoading(false));
  }, [teamId, briefingType]);

  if (!teamId) return null;

  const sectionOrder = [
    "Acoes abertas",
    "Impedimentos pendentes",
    "Itens vencidos",
    "Decisoes pendentes",
    "Perguntas em aberto",
    "Candidatos ao backlog",
  ];

  const grouped = sectionOrder
    .map((section) => ({
      section,
      items: (agenda ?? []).filter((item) => item.section === section),
    }))
    .filter((group) => group.items.length > 0);

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  return (
    <Card className="border-indigo-500/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SkipForward className="h-5 w-5 text-indigo-500" />
              Preparacao da proxima reuniao
            </CardTitle>
            <CardDescription>
              Itens de reunioes anteriores que podem precisar de atencao.
            </CardDescription>
          </div>
          <Select value={briefingType} onValueChange={setBriefingType}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="retro">Retrospectiva</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && agenda !== null && grouped.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum item pendente encontrado. A equipe esta em dia.
          </p>
        )}

        {!loading &&
          grouped.map((group) => {
            const collapsed = collapsedSections.has(group.section);
            return (
              <div key={group.section} className="rounded-lg border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => toggleSection(group.section)}
                >
                  <div className="flex items-center gap-2">
                    {SECTION_ICONS[group.section]}
                    <span className="text-sm font-medium">{group.section}</span>
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {group.items.length}
                    </Badge>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      collapsed ? "" : "rotate-90"
                    }`}
                  />
                </button>
                {!collapsed && (
                  <div className="divide-y border-t">
                    {group.items.map((item) => (
                      <div
                        key={`${item.sourceBriefingId}-${item.ordinal}`}
                        className="flex items-start justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm">{item.title}</span>
                            {item.priorityHint && (
                              <Badge
                                variant={PRIORITY_BADGE[item.priorityHint] ?? "outline"}
                                className="shrink-0 text-[10px]"
                              >
                                {item.priorityHint}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {item.dueDate && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            <span>{item.sourceBriefingTitle}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0"
                          onClick={() => onOpenBriefing(item.sourceBriefingId)}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
