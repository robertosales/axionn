/**
 * ApfKnowledgeLibrary
 * --------------------
 * Página principal da Biblioteca APF (Stage 4).
 * Compõe: KnowledgeStatsBar + AccuracyChart + filtros + grid de PatternCards.
 *
 * Uso: adicionar como nova aba na ApfGeneratorPage ou como rota dedicada.
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
import { KnowledgeStatsBar } from "./KnowledgeStatsBar";
import { PatternCard } from "./PatternCard";
import { AccuracyChart } from "./AccuracyChart";

export function ApfKnowledgeLibrary() {
  const {
    patterns,
    metrics,
    stats,
    loading,
    updating,
    lastRefresh,
    statusFilter,
    setStatusFilter,
    domainFilter,
    setDomainFilter,
    domains,
    refresh,
    approvePattern,
    rejectPattern,
  } = useKnowledgeLibrary();

  return (
    <div className="space-y-6">
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
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Atualizado {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <KnowledgeStatsBar stats={stats} loading={loading} />

      {/* Gráfico de acurácia */}
      <AccuracyChart metrics={metrics} loading={loading} />

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Filtrar:</span>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
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

        {domains.length > 0 && (
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Domínio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os domínios</SelectItem>
              {domains.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground">
          {loading ? "..." : `${patterns.length} padrão${patterns.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Grid de padrões */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-16" />
            </div>
          ))}
        </div>
      ) : patterns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-2">
          <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">
            {statusFilter === "auto"
              ? "Nenhum padrão pendente de revisão"
              : "Nenhum padrão encontrado com esses filtros"}
          </p>
          <p className="text-xs text-muted-foreground">
            Os padrões são gerados automaticamente pelo cron semanal após validações de especialistas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              isUpdating={updating === pattern.id}
              onApprove={approvePattern}
              onReject={rejectPattern}
            />
          ))}
        </div>
      )}
    </div>
  );
}
