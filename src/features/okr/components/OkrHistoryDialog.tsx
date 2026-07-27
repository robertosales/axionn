import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OkrKeyResult, OkrSnapshot } from "../types";
import { fetchKrSnapshots } from "../services/okrFollowUp.service";
import { calculateOkrTrend } from "../domain/okrTrend";

const TREND_LABEL = { improving: "Melhorando", stable: "Estável", worsening: "Piorando", insufficient_data: "Sem dados suficientes" };

export function OkrHistoryDialog({ kr, onClose }: { kr: OkrKeyResult | null; onClose: () => void }) {
  const [snapshots, setSnapshots] = useState<OkrSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!kr) return;
    let cancelled = false; setLoading(true); setError("");
    fetchKrSnapshots(kr.id).then((data) => { if (!cancelled) setSnapshots(data); }).catch((cause) => { if (!cancelled) setError(cause?.message ?? "Erro ao carregar histórico"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kr]);
  const trend = calculateOkrTrend(snapshots);
  const chartPoints = [...snapshots].reverse().filter((snapshot) => snapshot.calculated_progress != null);
  const polyline = chartPoints.map((snapshot, index) => `${index / (chartPoints.length - 1) * 100},${100 - Number(snapshot.calculated_progress)}`).join(" ");
  return <Dialog open={!!kr} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Histórico e evidências</DialogTitle><DialogDescription>{kr?.title}</DialogDescription></DialogHeader>
    <div className="rounded-lg border bg-muted/30 p-3 text-sm"><strong>Tendência:</strong> {TREND_LABEL[trend.trend]}{trend.delta != null ? ` (${trend.delta >= 0 ? "+" : ""}${trend.delta.toFixed(1)} p.p.)` : ""}</div>
    {chartPoints.length > 1 && <figure className="rounded-lg border p-3"><svg viewBox="0 0 100 100" role="img" aria-label="Evolução percentual do Key Result" className="h-36 w-full" preserveAspectRatio="none"><line x1="0" y1="50" x2="100" y2="50" className="stroke-border" strokeWidth="0.5" /><polyline points={polyline} fill="none" className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" />{chartPoints.map((snapshot, index) => <circle key={snapshot.id} cx={index / (chartPoints.length - 1) * 100} cy={100 - Number(snapshot.calculated_progress)} r="1.5" className="fill-primary" />)}</svg><figcaption className="mt-2 text-[11px] text-muted-foreground">Evolução do progresso calculado; os dados brutos permanecem disponíveis abaixo.</figcaption></figure>}
    {loading ? <p className="text-sm text-muted-foreground">Carregando medições...</p> : error ? <p className="text-sm text-destructive">{error}</p> : snapshots.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma medição registrada.</p> : <div className="space-y-2">{snapshots.map((snapshot) => <div key={snapshot.id} className="space-y-1 rounded-lg border p-3 text-xs"><div className="flex justify-between"><strong>{snapshot.measured_value ?? "Sem dados"}</strong><span>{new Date(snapshot.measured_at).toLocaleString("pt-BR")}</span></div><p>Progresso: {snapshot.calculated_progress == null ? "Sem dados" : `${snapshot.calculated_progress.toFixed(1)}%`} · Qualidade: {snapshot.measurement_quality}</p><p>Fonte: {snapshot.source ?? "Não informada"} · Fórmula: {snapshot.formula_version ?? "—"} · Itens: {snapshot.items_considered ?? 0}</p>{snapshot.period_start && <p>Período: {snapshot.period_start} a {snapshot.period_end}</p>}<pre className="overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(snapshot.calculation_metadata, null, 2)}</pre></div>)}</div>}
  </DialogContent></Dialog>;
}
