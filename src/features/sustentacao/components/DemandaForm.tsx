import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useProjetos } from "../hooks/useProjetos";
import type { Demanda } from "../types/demanda";
import {
  TIPOS_DEMANDA_IMR,
  getPrazoRegra,
  calcPrazoInicio,
  calcPrazoSolucao,
  isSolucaoDefinidaNaOS,
} from "../types/imr";
import { searchProfilesByName } from "../services/profiles.service";

const SITUACAO_LABELS: Record<string, string> = {
  fila_atendimento: "Fila Atendimento",
  planejamento_elaboracao: "Em Elaboração",
  planejamento_ag_aprovacao: "Ag. Aprovação",
  planejamento_aprovada: "Aprovada p/ Exec",
  em_execucao: "Em Execução",
  bloqueada: "Bloqueada",
  hom_ag_homologacao: "Ag. Homologação",
  hom_homologada: "Homologada",
  rejeitada: "Rejeitada",
  fila_producao: "Fila Produção",
  ag_aceite_final: "Ag. Aceite Final",
  cancelada: "Cancelada",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  /** Situação pré-selecionada quando o form é aberto pelo botão + de uma coluna do board */
  situacaoInicial?: string;
  /** Demanda existente — quando fornecida, o form opera em modo EDIÇÃO */
  demanda?: Demanda | null;
}

export function DemandaForm({ open, onClose, onSubmit, situacaoInicial, demanda }: Props) {
  // allTeams=true para garantir que o projeto da demanda aparece mesmo sendo de outro time
  const { projetos, loading: loadingProjetos } = useProjetos({ allTeams: true });
  const isEdit = !!demanda;

  const [form, setForm] = useState({
    rhm: "",
    projeto: "",
    tipo: "manutencao_corretiva",
    descricao: "",
    sla: "padrao",
    demandante: "",
    tipo_defeito: "nao_impeditivo",
    originada_diagnostico: false,
    data_previsao_encerramento: null as Date | null,
  });
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dataInicio] = useState(() => new Date());

  const [demandanteSearch, setDemandanteSearch] = useState("");
  const [demandanteResults, setDemandanteResults] = useState<
    Array<{ id: string; user_id: string; display_name: string }>
  >([]);
  const [selectedDemandante, setSelectedDemandante] = useState<{ id: string; display_name: string } | null>(null);

  // ── Inicializa os campos quando estiver em modo edição ──────────────────────
  useEffect(() => {
    if (!open) return;

    if (demanda) {
      // Modo edição: popula com os dados da demanda existente
      setForm({
        rhm: demanda.rhm ?? "",
        projeto: demanda.projeto ?? "",
        tipo: demanda.tipo ?? "manutencao_corretiva",
        descricao: demanda.titulo ?? demanda.descricao ?? "",
        sla: demanda.sla ?? "padrao",
        demandante: demanda.demandante ?? "",
        tipo_defeito: (demanda as any).tipo_defeito ?? "nao_impeditivo",
        originada_diagnostico: (demanda as any).originada_diagnostico ?? false,
        data_previsao_encerramento: demanda.data_previsao_encerramento
          ? typeof demanda.data_previsao_encerramento === "string"
            ? parseISO(demanda.data_previsao_encerramento)
            : demanda.data_previsao_encerramento
          : null,
      });
      // Se tiver nome do demandante salvo na demanda, pré-preenche
      if (demanda.demandante) {
        setSelectedDemandante({ id: demanda.demandante, display_name: (demanda as any).demandante_nome ?? demanda.demandante });
      }
    } else {
      // Modo criação: reseta o form
      setForm({
        rhm: "",
        projeto: "",
        tipo: "manutencao_corretiva",
        descricao: "",
        sla: "padrao",
        demandante: "",
        tipo_defeito: "nao_impeditivo",
        originada_diagnostico: false,
        data_previsao_encerramento: null,
      });
      setSelectedDemandante(null);
    }
    setTouched({});
    setDemandanteSearch("");
    setDemandanteResults([]);
  }, [open, demanda]);

  const markTouched = (field: string) => setTouched((p) => ({ ...p, [field]: true }));

  const isCorretiva = form.tipo === "manutencao_corretiva";

  useEffect(() => {
    if (!isCorretiva) {
      setForm((p) => ({ ...p, sla: "padrao", tipo_defeito: "nao_impeditivo", originada_diagnostico: false }));
    }
  }, [isCorretiva]);

  const prazoInfo = useMemo(() => {
    if (isEdit) return null; // não recalcula prazos em modo edição
    const regime = isCorretiva ? form.sla : undefined;
    const defeito = isCorretiva ? form.tipo_defeito : undefined;
    const regra = getPrazoRegra(form.tipo, regime, defeito);
    if (!regra) return null;
    const prazoInicio = calcPrazoInicio(dataInicio, form.tipo, regime, defeito);
    const prazoSolucao = calcPrazoSolucao(dataInicio, form.tipo, regime, defeito);
    const isOS = isSolucaoDefinidaNaOS(form.tipo, regime, defeito);
    return { regra, prazoInicio, prazoSolucao, isOS };
  }, [form.tipo, form.sla, form.tipo_defeito, isCorretiva, dataInicio, isEdit]);

  useEffect(() => {
    if (!isEdit && prazoInfo?.prazoSolucao) {
      setForm((p) => ({ ...p, data_previsao_encerramento: prazoInfo.prazoSolucao }));
    }
  }, [prazoInfo?.prazoSolucao, isEdit]);

  const searchDemandante = async (q: string) => {
    setDemandanteSearch(q);
    if (q.length < 2) { setDemandanteResults([]); return; }
    const results = await searchProfilesByName(q, 5);
    setDemandanteResults(results as any[]);
  };

  const rhmError = touched.rhm && (!form.rhm.trim() || !/^\d+$/.test(form.rhm.trim()));
  const projetoError = touched.projeto && !form.projeto;
  const demandanteError = touched.demandante && !selectedDemandante;
  const previsaoError = touched.data_previsao_encerramento && !form.data_previsao_encerramento;

  const handle = async () => {
    setTouched({ rhm: true, projeto: true, demandante: true, data_previsao_encerramento: true });
    if (
      !form.rhm.trim() ||
      !/^\d+$/.test(form.rhm.trim()) ||
      !form.projeto ||
      (!isEdit && !selectedDemandante) || // demandante só obrigatório na criação
      !form.data_previsao_encerramento
    ) {
      toast.error("Preencha os campos obrigatórios: #, Projeto, Autor e Data de Previsão.");
      return;
    }
    setLoading(true);
    const regime = isCorretiva ? form.sla : "padrao";
    const defeito = isCorretiva ? form.tipo_defeito : undefined;
    const situacao = situacaoInicial || demanda?.situacao || "fila_atendimento";

    const payload: Record<string, any> = {
      situacao,
      rhm: form.rhm,
      projeto: form.projeto,
      tipo: form.tipo,
      descricao: form.descricao,
      titulo: form.descricao,
      sla: regime,
      tipo_defeito: isCorretiva ? form.tipo_defeito : null,
      originada_diagnostico: isCorretiva ? form.originada_diagnostico : false,
      data_previsao_encerramento: form.data_previsao_encerramento
        ? format(form.data_previsao_encerramento, "yyyy-MM-dd")
        : null,
    };

    // Só sobrescreve demandante se for selecionado novo (criação ou troca)
    if (selectedDemandante) {
      payload.demandante = selectedDemandante.id;
    }

    // Prazos calculados: só na criação
    if (!isEdit) {
      payload.prazo_inicio_atendimento = calcPrazoInicio(dataInicio, form.tipo, regime, defeito)?.toISOString() || null;
      payload.prazo_solucao = calcPrazoSolucao(dataInicio, form.tipo, regime, defeito)?.toISOString() || null;
    }

    await onSubmit(payload);

    if (!isEdit) {
      setForm({
        rhm: "", projeto: "", tipo: "manutencao_corretiva", descricao: "",
        sla: "padrao", demandante: "", tipo_defeito: "nao_impeditivo",
        originada_diagnostico: false, data_previsao_encerramento: null,
      });
      setSelectedDemandante(null);
    }
    setTouched({});
    setLoading(false);
    onClose();
  };

  const situacaoLabel = situacaoInicial ? SITUACAO_LABELS[situacaoInicial] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEdit ? `Editar Demanda #${demanda?.rhm}` : "Nova Demanda"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? (
              <span>Atualize os dados da demanda. Situação atual: <span className="font-medium text-foreground">{SITUACAO_LABELS[demanda?.situacao ?? ""] || demanda?.situacao}</span></span>
            ) : situacaoLabel ? (
              <>Preencha os dados para cadastrar uma nova demanda.{" "}<span className="font-medium text-foreground">Situação inicial: {situacaoLabel}</span></>
            ) : (
              "Preencha os dados para cadastrar uma nova demanda de sustentação."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* LINHA 1: # + Projeto */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs"># <span className="text-destructive">*</span></Label>
              <Input
                value={form.rhm}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setForm((p) => ({ ...p, rhm: val }));
                }}
                onBlur={() => markTouched("rhm")}
                placeholder="81"
                inputMode="numeric"
                className={cn("h-8 text-sm", rhmError && "border-destructive focus-visible:ring-destructive")}
              />
              {rhmError && <p className="text-[11px] text-destructive mt-0.5">Informe um número válido.</p>}
            </div>
            <div>
              <Label className="text-xs">Projeto <span className="text-destructive">*</span></Label>
              <Select
                value={form.projeto || "_none"}
                onValueChange={(v) => {
                  setForm((p) => ({ ...p, projeto: v === "_none" ? "" : v }));
                  markTouched("projeto");
                }}
              >
                <SelectTrigger className={cn("h-8 text-sm", projetoError && "border-destructive")}>
                  <SelectValue placeholder={loadingProjetos ? "Carregando..." : "Selecione..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none" disabled>Selecione...</SelectItem>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projetoError && <p className="text-[11px] text-destructive mt-0.5">Selecione um projeto.</p>}
            </div>
          </div>

          {/* LINHA 2: Tipo + Demandante */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DEMANDA_IMR.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Autor {!isEdit && <span className="text-destructive">*</span>}</Label>
              {selectedDemandante ? (
                <div className="flex items-center gap-1 h-8 px-2 border rounded-md bg-muted/30">
                  <span className="text-sm flex-1 truncate">{selectedDemandante.display_name}</span>
                  <button
                    onClick={() => { setSelectedDemandante(null); setForm((p) => ({ ...p, demandante: "" })); }}
                    className="text-muted-foreground hover:text-foreground text-xs ml-1"
                  >✕</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={demandanteSearch}
                    onChange={(e) => searchDemandante(e.target.value)}
                    onBlur={() => markTouched("demandante")}
                    placeholder="Buscar..."
                    className={cn("pl-7 h-8 text-sm", demandanteError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {demandanteResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
                      {demandanteResults.map((r) => (
                        <button
                          key={r.id}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50"
                          onClick={() => {
                            setSelectedDemandante({ id: r.id, display_name: r.display_name });
                            setForm((p) => ({ ...p, demandante: r.id }));
                            setDemandanteSearch("");
                            setDemandanteResults([]);
                          }}
                        >{r.display_name}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {demandanteError && <p className="text-[11px] text-destructive mt-0.5">Selecione um autor.</p>}
            </div>
            <div />
          </div>

          {/* BLOCO CONDICIONAL — Manutenção Corretiva */}
          {isCorretiva && (
            <div className="rounded-md border p-2.5 space-y-2" style={{ backgroundColor: "#e8f2fa", borderColor: "#b3d4ed" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#1a6fa8" }}>Campos exclusivos — Manutenção Corretiva</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Regime de Atendimento</Label>
                  <Select value={form.sla} onValueChange={(v) => setForm((p) => ({ ...p, sla: v, data_previsao_encerramento: isEdit ? p.data_previsao_encerramento : null }))}>
                    <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Padrão</SelectItem>
                      <SelectItem value="continuo">Contínuo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Defeito Impeditivo</Label>
                  <div className="flex gap-1 mt-1.5">
                    <Button type="button" variant={form.tipo_defeito === "impeditivo" ? "default" : "outline"} size="sm"
                      className={cn("h-7 text-xs flex-1", form.tipo_defeito === "impeditivo" && "bg-info hover:bg-info/90 text-info-foreground")}
                      onClick={() => setForm((p) => ({ ...p, tipo_defeito: "impeditivo", data_previsao_encerramento: isEdit ? p.data_previsao_encerramento : null }))}>
                      Sim
                    </Button>
                    <Button type="button" variant={form.tipo_defeito === "nao_impeditivo" ? "default" : "outline"} size="sm"
                      className={cn("h-7 text-xs flex-1", form.tipo_defeito === "nao_impeditivo" && "bg-info hover:bg-info/90 text-info-foreground")}
                      onClick={() => setForm((p) => ({ ...p, tipo_defeito: "nao_impeditivo", data_previsao_encerramento: isEdit ? p.data_previsao_encerramento : null }))}>
                      Não
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox checked={form.originada_diagnostico} onCheckedChange={(v) => setForm((p) => ({ ...p, originada_diagnostico: !!v }))} id="diag" className="h-3.5 w-3.5" />
                <Label htmlFor="diag" className="font-normal text-xs">Originada de diagnóstico de incidente?</Label>
                {form.originada_diagnostico && (
                  <span className="text-[10px] font-medium ml-1" style={{ color: "#1a6fa8" }}>→ Prazo de início: IMEDIATO</span>
                )}
              </div>
            </div>
          )}

          {/* Prazos + Data Previsão */}
          <div className="grid grid-cols-2 gap-2">
            {prazoInfo && !isEdit && (
              <div className="rounded-md border p-2" style={{ backgroundColor: "#e8f2fa", borderColor: "#b3d4ed" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#1a6fa8" }}>Prazos Calculados</p>
                <div className="space-y-0.5 text-xs">
                  <div>
                    <span style={{ color: "#4a6278" }}>Início: </span>
                    <span className="font-medium" style={{ color: "#0f1e2d" }}>
                      {form.originada_diagnostico && isCorretiva ? "IMEDIATO" : prazoInfo.prazoInicio ? format(prazoInfo.prazoInicio, "dd/MM/yyyy HH:mm") : "—"}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#4a6278" }}>Solução: </span>
                    <span className="font-medium" style={{ color: "#0f1e2d" }}>
                      {prazoInfo.isOS ? "Definido na OS" : prazoInfo.prazoSolucao ? format(prazoInfo.prazoSolucao, "dd/MM/yyyy HH:mm") : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className={prazoInfo && !isEdit ? "" : "col-span-2"}>
              <Label className="text-xs">Data de Previsão de Encerramento <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-8 text-sm", !form.data_previsao_encerramento && "text-muted-foreground", previsaoError && "border-destructive")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {form.data_previsao_encerramento ? format(form.data_previsao_encerramento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.data_previsao_encerramento || undefined}
                    onSelect={(d) => { setForm((p) => ({ ...p, data_previsao_encerramento: d || null })); markTouched("data_previsao_encerramento"); }}
                    className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
              {previsaoError && <p className="text-[11px] text-destructive mt-0.5">Informe a data de previsão.</p>}
            </div>
          </div>

          {/* Título */}
          <div>
            <Label className="text-xs">Título</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} rows={2} className="text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button style={{ backgroundColor: "#1a6fa8" }} className="hover:opacity-90 text-white" onClick={handle} disabled={loading}>
            {loading ? (isEdit ? "Salvando..." : "Criando...") : (isEdit ? "Salvar Alterações" : "Criar Demanda")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
