/**
 * ApfKnowledgeLibrary
 * --------------------
 * Página principal da Biblioteca APF.
 * Stage 4: KPIs + Gráfico + Filtros + Grid de padrões
 * Stage 5: DriftAlert + AutomationPanel integrados
 */
import { RefreshCw, Filter, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useKnowledgeLibrary } from "../../hooks/useKnowledgeLibrary";
import { useAutomation } from "../../hooks/useAutomation";
import { KnowledgeStatsBar } from "./KnowledgeStatsBar";
import { PatternCard } from "./PatternCard";
import { AccuracyChart } from "./AccuracyChart";
import { DriftAlert } from "./DriftAlert";
import { AutomationPanel } from "./AutomationPanel";

export function ApfKnowledgeLibrary() {
  const library = useKnowledgeLibrary();
  const auto = useAutomation(library.patterns, library.refresh);

  return (
    <div className="space-y-6">
      {/* Alerta de drift — topo, visível imediatamente */}
      <DriftAlert drift={auto.drift} threshold={auto.config.driftThresholdPp} />

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">Biblioteca APF</h2>
            <p className="text-[11px] text-muted-foreground">
              Padrões consolidados automaticamente • valide para ativar no RAG
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {library.lastRefresh && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Atualizado {library.lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={library.refresh}
            disabled={library.loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${library.loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Layout de 2 colunas em telas grandes: padrões + configuração */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna principal (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPIs */}
          <KnowledgeStatsBar stats={library.stats} loading={library.loading} />

          {/* Gráfico */}
          <AccuracyChart metrics={library.metrics} loading={library.loading} />

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Filtrar:</span>

            <Select
              value={library.statusFilter}
              onValueChange={(v) => library.setStatusFilter(v as typeof library.statusFilter)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="auto">Pendentes</SelectItem>
                <SelectItem value="validated">Validados</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
              </SelectContent>
            </Select>

            {library.domains.length > 0 && (
              <Select value={library.domainFilter} onValueChange={library.setDomainFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Domínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os domínios</SelectItem>
                  {library.domains.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <span className="ml-auto text-[10px] text-muted-foreground">
              {library.loading ? "..." : `${library.patterns.length} padrão${library.patterns.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Grid de padrões */}
          {library.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-16" />
                </div>
              ))}
            </div>
          ) : library.patterns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">
                {library.statusFilter === "auto"
                  ? "Nenhum padrão pendente de revisão"
                  : "Nenhum padrão encontrado com esses filtros"}
              </p>
              <p className="text-xs text-muted-foreground">
                Os padrões são gerados automaticamente pelo cron semanal após validações de especialistas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {library.patterns.map((pattern) => (
                <PatternCard
                  key={pattern.id}
                  pattern={pattern}
                  isUpdating={library.updating === pattern.id}
                  onApprove={library.approvePattern}
                  onReject={library.rejectPattern}
                />
              ))}
            </div>
          )}
        </div>

        {/* Coluna lateral (1/3): Automação */}
        <div className="space-y-4">
          <AutomationPanel
            config={auto.config}
            onConfigChange={auto.updateConfig}
            candidateCount={auto.autoApproveCandidates.length}
            running={auto.running}
            lastRun={auto.lastRun}
            onRunNow={auto.executeAutoApprove}
          />
        </div>

      </div>
    </div>
  );
}
