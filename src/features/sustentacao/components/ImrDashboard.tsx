import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { useImrPeriodo, inicioDeMes } from "../hooks/useImrPeriodo";
import { INDICADORES_GRUPO2, getIndicadorFaixa, EVENTOS_CONFIG } from "../types/imr";
import { Target, Shield, TestTube, Star, DollarSign, Clock, AlertTriangle, ChevronDown, ChevronUp, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

const INDICATOR_ICONS: Record<string, LucideIcon> = {
  IAP: Target,
  IQS: Shield,
  ICT: TestTube,
  ISS: Star,
};
const COR_MAP: Record<string, string> = {
  green:  "text-emerald-600",
  yellow: "text-yellow-600",
  orange: "text-orange-600",
  red:    "text-destructive",
};
const COR_BG_MAP: Record<string, string> = {
  green:  "bg-emerald-500/10 border-emerald-500/30",
  yellow: "bg-yellow-500/10 border-yellow-500/30",
  orange: "bg-orange-500/10 border-orange-500/30",
  red:    "bg-destructive/10 border-destructive/30",
};
// ─── Period helpers ───────────────────────────────────────────────────────────

interface PeriodOption {
  value: string; // "YYYY-MM"
  label: string;
  start: Date;
  end:   Date;
}

function buildPeriodOptions(monthsBack = 6): PeriodOption[] {
  const opts: PeriodOption[] = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ value, label, start, end });
  }
  return opts;
}

function defaultPeriod(opts: PeriodOption[]): string {
  const now  = new Date();
  const day  = now.getDate();
  const cur  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (day >= 11) return cur;
  // Antes do dia 11 usa o mês anterior
  return opts[1]?.value ?? cur;
}

// ─── ImrDashboard ─────────────────────────────────────────────────────────────

export function ImrDashboard() {
  const periodOptions = useMemo(() => buildPeriodOptions(6), []);
  const [selectedPeriod, setSelectedPeriod] = useState(() => defaultPeriod(periodOptions));
  const [atrasadosPage, setAtrasadosPage] = useState(1);

  const activePeriod = useMemo(
    () => periodOptions.find((p) => p.value === selectedPeriod) ?? periodOptions[0],
    [selectedPeriod, periodOptions],
  );

  // ── Dados do banco via RPC calc_imr_periodo ───────────────────────────────
  const { iap, iqs, ict, iss, glosas, e8Alerts, loading } = useImrPeriodo({
    inicio:   activePeriod?.start ?? inicioDeMes(),
    fim:      activePeriod?.end   ?? new Date(),
    e8Alerta: 45,
    e8Glosa:  60,
  });

  // ── Atraso E8 (substitui countAtraso60Dias + atrasadosList locais) ────────
  const atrasadosGlosa  = useMemo(() => e8Alerts.filter(a => a.tipo_alerta === "glosa"),  [e8Alerts]);
  const atrasadosAlerta = useMemo(() => e8Alerts.filter(a => a.tipo_alerta === "alerta"), [e8Alerts]);
  const atrasadosList   = useMemo(
    () => [...atrasadosGlosa, ...atrasadosAlerta].sort((a, b) => b.diasAtraso - a.diasAtraso),
    [atrasadosGlosa, atrasadosAlerta],
  );

  const atrasadosVisiveis = atrasadosList.slice(0, atrasadosPage * PAGE_SIZE);
  const temMais = atrasadosVisiveis.length < atrasadosList.length;

  // ── Glosa IAP (tabela contratual) ─────────────────────────────────────────
  function getIAPGlosa(valor: number): number {
    if (valor >= 90) return 0;
    if (valor >= 80) return 5;
    if (valor >= 70) return 10;
    return 20;
  }

  const glosa60      = atrasadosGlosa.length * 0.2;
  const iapGlosa     = getIAPGlosa(iap.valor);
  const glosaTotalCalc = iapGlosa + glosa60;

  if (loading) return <SkeletonList count={4} />;

  const indicatorValues = { IAP: iap.valor, IQS: iqs.valor, ICT: ict.valor, ISS: iss.valor };
  const indicatorDetails: Record<string, string> = {
    IAP: `${iap.qdap} de ${iap.qdtot} no prazo`,
    IQS: `${iqs.qde - iqs.qdr} de ${iqs.qde} sem rejeição`,
    ICT: `${ict.total} demandas avaliadas`,
    ISS: `${iss.total} demandas avaliadas`,
  };

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Indicadores Grupo 2 — IMR
          </h3>
          <p className="text-xs text-muted-foreground">Instrumento de Medição de Resultados</p>
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="imr-period" className="sr-only">Período de apuração</label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger id="imr-period" className="min-h-11 w-full sm:min-h-9 sm:w-[180px]" aria-label="Selecionar período de apuração">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Period info ───────────────────────────────────────── */}
      {activePeriod && (
        <p className="text-xs text-muted-foreground px-1">
          Período de apuração: {activePeriod.start.toLocaleDateString("pt-BR")} —{" "}
          {activePeriod.end.toLocaleDateString("pt-BR")}
        </p>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do IMR">
        {INDICADORES_GRUPO2.map((ind) => {
          const valor = indicatorValues[ind.sigla as keyof typeof indicatorValues];
          const faixa = getIndicadorFaixa(ind, valor);
          const Icon  = INDICATOR_ICONS[ind.sigla] || Target;
          const hasData =
            ind.sigla === "ISS" ? iss.total > 0
            : ind.sigla === "ICT" ? ict.total > 0
            : ind.sigla === "IQS" ? iqs.qde  > 0
            : iap.qdtot > 0;

          return (
            <Card key={ind.sigla} className={`${COR_BG_MAP[faixa.cor]} shadow-sm transition-colors`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Circle className={`h-3 w-3 fill-current ${COR_MAP[faixa.cor]}`} aria-hidden="true" />
                      <span className="text-xs font-bold uppercase tracking-wide">{ind.sigla}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{ind.nome}</p>
                    <p className={`text-2xl font-bold ${COR_MAP[faixa.cor]}`}>
                      {!hasData ? "N/A" : ind.sigla === "ISS" ? valor.toFixed(1) : `${valor.toFixed(1)}%`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Meta: ≥ {ind.meta}{ind.unidade}
                    </p>
                    {ind.sigla === "IAP" && activePeriod && (
                      <p className="text-[10px] text-muted-foreground italic">Período: {activePeriod.label}</p>
                    )}
                    {hasData && faixa.glosa > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        Glosa: {faixa.glosa}%
                      </Badge>
                    )}
                  </div>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-background/50 ${COR_MAP[faixa.cor]}`} aria-hidden="true">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                {hasData && (
                  <p className="text-[10px] text-muted-foreground mt-1">{indicatorDetails[ind.sigla]}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Atraso E8: contador + lista paginada ──────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        {/* Contador — 2/5 */}
        <Card className={`lg:col-span-2 ${atrasadosGlosa.length > 0 ? "border-destructive/30" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">
                  Atraso &gt; 60 dias (E8)
                </p>
                <p className={`text-5xl font-bold mt-2 ${atrasadosGlosa.length > 0 ? "text-destructive" : ""}`}>
                  {atrasadosGlosa.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">demandas em atraso crítico</p>
                {atrasadosAlerta.length > 0 && (
                  <p className="text-[11px] text-yellow-600 mt-0.5">
                    {atrasadosAlerta.length} em alerta (&gt;45 dias)
                  </p>
                )}
                {glosa60 > 0 && (
                  <Badge variant="destructive" className="mt-3 text-[11px] px-2">
                    Glosa acumulada: {glosa60.toFixed(2)}%
                  </Badge>
                )}
              </div>
              <div
                className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${
                  atrasadosGlosa.length > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                }`}
              >
                <Clock className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista paginada — 3/5 */}
        <Card className="flex min-h-[280px] flex-col shadow-sm lg:col-span-3">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Demandas com atraso E8
              </span>
              {atrasadosList.length > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-bold">
                  {atrasadosList.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
            {atrasadosList.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma demanda com atraso E8</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-muted">
                  {atrasadosVisiveis.map((a) => (
                    <div
                      key={a.demandaId}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                        a.tipo_alerta === "glosa"
                          ? "border-destructive/20 bg-destructive/5"
                          : "border-yellow-500/20 bg-yellow-500/5"
                      }`}
                      aria-label={`${a.rhm}, ${a.diasAtraso} dias de atraso, ${a.tipo_alerta === "glosa" ? "com glosa" : "em alerta"}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          a.tipo_alerta === "glosa" ? "bg-destructive" : "bg-yellow-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{a.rhm}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.projeto}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-[11px] font-bold rounded px-1.5 py-0.5 ${
                            a.tipo_alerta === "glosa"
                              ? "text-destructive bg-destructive/10"
                              : "text-yellow-700 bg-yellow-500/10"
                          }`}
                        >
                          {a.diasAtraso}d
                        </span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {a.tipo_alerta === "glosa" ? "Glosa 0,2%" : "Alerta"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-1 flex flex-col gap-2 border-t border-border/40 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Exibindo <strong>{atrasadosVisiveis.length}</strong> de <strong>{atrasadosList.length}</strong>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {temMais && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 gap-1 text-xs sm:min-h-9"
                        onClick={() => setAtrasadosPage((p) => p + 1)}
                      >
                        Ver mais <ChevronDown className="h-3 w-3" />
                      </Button>
                    )}
                    {atrasadosPage > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 gap-1 text-xs sm:min-h-9"
                        onClick={() => setAtrasadosPage(1)}
                      >
                        Recolher <ChevronUp className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Resumo de Glosas ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-destructive" />
            Resumo de Glosas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumo percentual de glosas">
            <GlosaCell
              label="Glosa IAP"
              value={`${iapGlosa.toFixed(2)}%`}
              sub={`IAP: ${iap.qdtot > 0 ? `${iap.valor.toFixed(1)}%` : "N/A"}`}
              active={iapGlosa > 0}
            />
            <GlosaCell
              label="Glosa E8 (+60d)"
              value={`${glosa60.toFixed(2)}%`}
              sub={`${atrasadosGlosa.length} demandas`}
              active={glosa60 > 0}
            />
            <GlosaCell
              label="Glosa Total"
              value={`${glosaTotalCalc.toFixed(2)}%`}
              active={glosaTotalCalc > 0}
            />
          </div>

          {Object.keys(glosas.byEvento).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Eventos Registrados</p>
              {Object.entries(glosas.byEvento).map(([ev, data]) => {
                const cfg = EVENTOS_CONFIG.find((e) => e.codigo === ev);
                return (
                  <div key={ev} className="flex flex-col gap-2 rounded bg-muted/50 p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 font-medium sm:mr-2 sm:truncate">
                      {ev} — {cfg?.descricao.slice(0, 40)}...
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">{data.count}x</Badge>
                      <span className="text-destructive font-medium">{data.total.toFixed(2)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(glosas.byEvento).length === 0 && glosas.totalIntegral === 0 && glosas.totalLimitada === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum evento de glosa registrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── GlosaCell ────────────────────────────────────────────────────────────────

function GlosaCell({ label, value, sub, active }: { label: string; value: string; sub?: string; active: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${active ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
      <p className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</p>
      <p className={`text-xl font-bold ${active ? "text-destructive" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
