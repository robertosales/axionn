import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Bell, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, Link2, Pencil, Plus, Receipt, RefreshCw, Save, Search, Settings2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  createBillingRecord, generateMonthlyBilling, linkApfBillingRequest, listApfBillingRequests,
  listBackofficePlanPrices, listBillingCustomers, listBillingRecords, listPlanPriceHistory, markOverdueInvoices,
  recordBillingReminder, updateBackofficePlanPrice, updateBillingDetails, updateBillingStatus,
} from "@/backoffice/services/backoffice.service";
import { exportInvoicesToPdf } from "@/backoffice/utils/exportInvoicesPdf";
import { billingReasonSchema, invoiceFormSchema, planPriceSchema } from "@/backoffice/schemas/billing.schema";
import {
  APF_BILLING_STATUS_LABELS, BILLING_STATUSES, BILLING_STATUS_LABELS, BILLING_STATUS_TRANSITIONS,
  type ApfBillingRequest, type ApfBillingRequestStatus, type BackofficePlanPrice,
  type BillingCustomer, type BillingRecord, type BillingStatus, type PlanPriceHistoryEntry,
} from "@/backoffice/types/backoffice.types";
import { exportToCsv } from "@/lib/exportToCsv";
import { formatCurrencyBRL, parseBRLInput } from "@/lib/currency";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 10;

type PeriodFilter = "all" | "month" | "next30";
type SortKey = "tenantName" | "amount" | "dueDate" | "status";

const statusVariant: Record<BillingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  pending: "secondary",
  overdue: "destructive",
  cancelled: "outline",
  refunded: "outline",
};

const apfStatusVariant: Record<ApfBillingRequestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  linked: "secondary",
  invoiced: "default",
  cancelled: "destructive",
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const today = () => isoDate(new Date());
const dueDateBR = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const competenceBR = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

function withinPeriod(dueDate: string, period: PeriodFilter) {
  if (period === "all") return true;
  if (period === "month") return dueDate.startsWith(today().slice(0, 7));
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return dueDate >= today() && dueDate <= isoDate(end);
}

function compareRows(a: BillingRecord, b: BillingRecord, key: SortKey, dir: "asc" | "desc") {
  const mult = dir === "asc" ? 1 : -1;
  if (key === "tenantName") return mult * a.tenantName.localeCompare(b.tenantName, "pt-BR");
  if (key === "amount") return mult * (a.amount - b.amount);
  if (key === "dueDate") return mult * (a.dueDate.localeCompare(b.dueDate));
  if (key === "status") return mult * a.status.localeCompare(b.status, "pt-BR");
  return 0;
}

export default function BOFinanceiro() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [plans, setPlans] = useState<BackofficePlanPrice[]>([]);
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [apfRequests, setApfRequests] = useState<ApfBillingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PlanPriceHistoryEntry[]>([]);
  const [invoice, setInvoice] = useState({ tenantId: "", billingPeriod: "monthly", dueDate: today(), amount: "", notes: "" });
  const [pendingStatus, setPendingStatus] = useState<{ record: BillingRecord; status: BillingStatus } | null>(null);
  const [reason, setReason] = useState("");
  const [detailsTarget, setDetailsTarget] = useState<BillingRecord | null>(null);
  const [detailsForm, setDetailsForm] = useState({ invoiceUrl: "", notes: "" });
  const [linkTarget, setLinkTarget] = useState<ApfBillingRequest | null>(null);
  const [linkForm, setLinkForm] = useState({ billingRecordId: "", note: "", markInvoiced: false });
  const [reminderTarget, setReminderTarget] = useState<BillingRecord | null>(null);
  const [reminderNote, setReminderNote] = useState("");
  const priceBaseline = useRef<BackofficePlanPrice[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await markOverdueInvoices().catch(() => undefined);
      const [billing, prices, organizations, apf] = await Promise.all([
        listBillingRecords(), listBackofficePlanPrices(), listBillingCustomers(), listApfBillingRequests(),
      ]);
      setRecords(billing);
      setPlans(prices);
      priceBaseline.current = prices;
      setCustomers(organizations);
      setApfRequests(apf);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    let filtered = records.filter((record) =>
      (filter === "all" || record.status === filter) &&
      withinPeriod(record.dueDate, period) &&
      record.tenantName.toLocaleLowerCase("pt-BR").includes(term));
    filtered = [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return filtered;
  }, [records, filter, period, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totals = useMemo(() => {
    const now = today();
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const upcoming = records.filter((r) => r.status === "pending" && r.dueDate >= now && r.dueDate <= isoDate(limit));
    return {
      paid: formatCurrencyBRL(records.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0)),
      pending: formatCurrencyBRL(records.filter((r) => r.status === "pending" && r.dueDate >= now).reduce((sum, r) => sum + r.amount, 0)),
      overdue: formatCurrencyBRL(records.filter((r) => r.status === "overdue" || (r.status === "pending" && r.dueDate < now)).reduce((sum, r) => sum + r.amount, 0)),
      upcomingTotal: formatCurrencyBRL(upcoming.reduce((sum, r) => sum + r.amount, 0)),
      upcomingCount: upcoming.length,
    };
  }, [records]);

  const apfPendingCount = useMemo(() => apfRequests.filter((request) => request.status === "submitted").length, [apfRequests]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ key }: { key: SortKey }) => {
    if (sortKey !== key) return <span className="ml-1 text-muted-foreground">⇅</span>;
    return sortDir === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  };

  const saveInvoice = async () => {
    const parsed = invoiceFormSchema.safeParse(invoice);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    setSaving(true);
    try {
      await createBillingRecord({
        tenantId: parsed.data.tenantId,
        billingPeriod: parsed.data.billingPeriod,
        dueDate: parsed.data.dueDate,
        amount: parsed.data.amount ? parseBRLInput(parsed.data.amount) : null,
        notes: parsed.data.notes || null,
      });
      toast.success("Fatura criada.");
      setInvoiceOpen(false);
      setInvoice({ tenantId: "", billingPeriod: "monthly", dueDate: today(), amount: "", notes: "" });
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao criar fatura."); }
    finally { setSaving(false); }
  };

  const priceChanges = useMemo(() => plans.filter((plan) => {
    const base = priceBaseline.current.find((item) => item.id === plan.id);
    return !base || base.monthlyPrice !== plan.monthlyPrice ||
      base.annualPrice !== plan.annualPrice || base.currency !== plan.currency;
  }), [plans]);

  const savePrices = async () => {
    if (priceChanges.some((plan) => !planPriceSchema.safeParse(plan).success)) {
      return toast.error("Verifique os preços e a moeda informados.");
    }
    setSaving(true);
    try {
      await Promise.all(priceChanges.map(updateBackofficePlanPrice));
      priceBaseline.current = plans.map((plan) => ({ ...plan }));
      toast.success(`${priceChanges.length} plano(s) atualizado(s).`);
      setPricesOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar preços."); }
    finally { setSaving(false); }
  };

  const generate = async () => {
    setSaving(true);
    try {
      const count = await generateMonthlyBilling(today(), 10);
      toast.success(`${count} fatura(s) gerada(s).`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro na geração mensal."); }
    finally { setSaving(false); }
  };

  const applyStatus = async (record: BillingRecord, status: BillingStatus, motive?: string) => {
    try {
      await updateBillingStatus(record.id, status, motive);
      setRecords((current) => current.map((item) => item.id === record.id
        ? {
            ...item,
            status,
            paidAt: status === "paid"
              ? item.paidAt ?? new Date().toISOString()
              : status === "refunded" ? item.paidAt : null,
          }
        : item));
      toast.success("Status da fatura atualizado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a fatura."); }
  };

  const requestStatus = (record: BillingRecord, status: BillingStatus) => {
    if (status === record.status) return;
    if (status === "cancelled" || status === "refunded") {
      setReason("");
      setPendingStatus({ record, status });
      return;
    }
    void applyStatus(record, status);
  };

  const confirmStatus = async () => {
    if (!pendingStatus) return;
    const parsed = billingReasonSchema.safeParse({ reason });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Informe o motivo.");
    const { record, status } = pendingStatus;
    setPendingStatus(null);
    await applyStatus(record, status, parsed.data.reason);
  };

  const openDetails = (record: BillingRecord) => {
    setDetailsForm({ invoiceUrl: record.invoiceUrl ?? "", notes: record.notes ?? "" });
    setDetailsTarget(record);
  };

  const saveDetails = async () => {
    if (!detailsTarget) return;
    const invoiceUrl = detailsForm.invoiceUrl.trim() || null;
    const notes = detailsForm.notes.trim() || null;
    setSaving(true);
    try {
      await updateBillingDetails(detailsTarget.id, invoiceUrl, notes);
      setRecords((current) => current.map((item) => item.id === detailsTarget.id
        ? { ...item, invoiceUrl, notes } : item));
      toast.success("Detalhes da fatura salvos.");
      setDetailsTarget(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar detalhes."); }
    finally { setSaving(false); }
  };

  const openPriceHistory = async () => {
    try { const hist = await listPlanPriceHistory(); setPriceHistory(hist); setPriceHistoryOpen(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao carregar histórico de preços."); }
  };

  const linkCandidates = useMemo(() =>
    linkTarget ? records.filter((r) => r.tenantId === linkTarget.organizationId && r.status === "pending") : [],
  [linkTarget, records]);

  const openLink = (request: ApfBillingRequest) => {
    setLinkForm({ billingRecordId: "", note: "", markInvoiced: false });
    setLinkTarget(request);
  };

  const confirmLink = async () => {
    if (!linkTarget || !linkForm.billingRecordId) return;
    setSaving(true);
    try {
      await linkApfBillingRequest({
        requestId: linkTarget.id,
        billingRecordId: linkForm.billingRecordId,
        note: linkForm.note.trim() || null,
        markInvoiced: linkForm.markInvoiced,
      });
      toast.success("Cobrança APF vinculada à fatura.");
      setLinkTarget(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao vincular cobrança APF."); }
    finally { setSaving(false); }
  };

  const openReminder = (record: BillingRecord) => {
    setReminderNote("");
    setReminderTarget(record);
  };

  const confirmReminder = async () => {
    if (!reminderTarget) return;
    setSaving(true);
    try {
      await recordBillingReminder(reminderTarget.id, reminderNote.trim() || null);
      toast.success("Lembrete registrado.");
      setReminderTarget(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao registrar lembrete."); }
    finally { setSaving(false); }
  };

  const exportCsv = () => exportToCsv({
    filename: "faturas-backoffice",
    rows: visible.map((record) => ({
      Cliente: record.tenantName,
      Valor: formatCurrencyBRL(record.amount),
      Status: BILLING_STATUS_LABELS[record.status],
      Plano: record.planType,
      Periodo: record.billingPeriod,
      Vencimento: dueDateBR(record.dueDate),
    })),
  });

  const exportPdf = () => exportInvoicesToPdf(
    visible.map((record) => ({
      cliente: record.tenantName,
      plano: record.planType,
      valor: formatCurrencyBRL(record.amount),
      vencimento: dueDateBR(record.dueDate),
      status: BILLING_STATUS_LABELS[record.status],
      periodo: record.billingPeriod,
    })),
    "faturas-backoffice"
  );

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Financeiro</h1><p className="text-sm text-muted-foreground">Faturas, receitas e inadimplência.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPricesOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Preços</Button>
        <Button variant="outline" onClick={() => void generate()} disabled={saving}><RefreshCw className="mr-2 h-4 w-4" />Gerar mensalidade</Button>
        <Button onClick={() => setInvoiceOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova fatura</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
        <Button variant="outline" onClick={exportPdf}><FileText className="mr-2 h-4 w-4" />PDF</Button>
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Receita paga", value: totals.paid },
        { label: "Pendente", value: totals.pending },
        { label: "Vencida", value: totals.overdue },
        { label: "Próximos 30 dias", value: totals.upcomingTotal, detail: `${totals.upcomingCount} fatura(s) a vencer` },
      ].map((card) => (
        <div key={card.label} className="rounded-lg border bg-white p-5">
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          {card.detail && <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>}
        </div>
      ))}
    </div>
    <Tabs defaultValue="faturas">
      <TabsList>
        <TabsTrigger value="faturas"><Receipt className="mr-2 h-4 w-4" />Faturas</TabsTrigger>
        <TabsTrigger value="apf"><Link2 className="mr-2 h-4 w-4" />Cobranças APF{apfPendingCount > 0 ? ` · ${apfPendingCount}` : ""}</TabsTrigger>
      </TabsList>
      <TabsContent value="faturas" className="mt-4 space-y-4">
    <div className="rounded-lg border bg-white">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar cliente" /></div>
        <Select value={period} onValueChange={(value) => { setPeriod(value as PeriodFilter); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="month">Vencimento no mês</SelectItem>
            <SelectItem value="next30">Próximos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(value) => { setFilter(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {BILLING_STATUSES.map((status) => <SelectItem key={status} value={status}>{BILLING_STATUS_LABELS[status]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loading ? <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin" /> :
        error ? <ErrorState message="Erro ao carregar o financeiro." onRetry={() => void load()} /> :
        visible.length === 0 ? <EmptyState icon={Receipt} variant="filtered-empty" title="Nenhuma fatura encontrada" description="Ajuste a busca, o status ou o período para ver outras faturas." /> :
        <>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cliente</TableHead><TableHead>Plano</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>{paged.map((record) => <TableRow key={record.id}>
              <TableCell className="font-medium">{record.tenantName}</TableCell>
              <TableCell>{record.planType}</TableCell>
              <TableCell>{formatCurrencyBRL(record.amount)}</TableCell>
              <TableCell>{dueDateBR(record.dueDate)}</TableCell>
              <TableCell>
                {BILLING_STATUS_TRANSITIONS[record.status].length === 0
                  ? <Badge variant={statusVariant[record.status]}>{BILLING_STATUS_LABELS[record.status]}</Badge>
                  : <Select value={record.status} onValueChange={(value) => requestStatus(record, value as BillingStatus)}>
                      <SelectTrigger className="w-40"><Badge variant={statusVariant[record.status]}>{BILLING_STATUS_LABELS[record.status]}</Badge></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={record.status} disabled>{BILLING_STATUS_LABELS[record.status]}</SelectItem>
                        {BILLING_STATUS_TRANSITIONS[record.status].map((status) => <SelectItem key={status} value={status}>{BILLING_STATUS_LABELS[status]}</SelectItem>)}
                      </SelectContent>
                    </Select>}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {BILLING_STATUS_TRANSITIONS[record.status].includes("paid") && (
                    <Button variant="ghost" size="sm" title="Marcar como pago" aria-label={`Marcar como pago ${record.tenantName}`} onClick={() => void applyStatus(record, "paid")}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" title="Editar detalhes" aria-label={`Editar detalhes ${record.tenantName}`} onClick={() => openDetails(record)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {visible.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} · {visible.length} faturas</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>}
    </div>
      </TabsContent>
      <TabsContent value="apf" className="mt-4 space-y-4">
        {loading ? <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin" /> :
          apfRequests.length === 0 ? <EmptyState icon={Link2} title="Nenhuma cobrança APF registrada" description="Lotes APF aprovados e enviados ao faturamento aparecem aqui para vínculo com as faturas." /> :
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Organização</TableHead><TableHead>Competência</TableHead><TableHead>PF aprovados</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead>
              </TableRow></TableHeader>
              <TableBody>{apfRequests.map((request) => {
                const linked = request.billingRecordId
                  ? records.find((r) => r.id === request.billingRecordId)
                  : undefined;
                return <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.organizationName}</TableCell>
                  <TableCell>{competenceBR(request.competence)}</TableCell>
                  <TableCell>{request.approvedPf.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell>{formatCurrencyBRL(request.grossAmount)}</TableCell>
                  <TableCell>{dueDateBR(request.dueDate)}</TableCell>
                  <TableCell><Badge variant={apfStatusVariant[request.status]}>{APF_BILLING_STATUS_LABELS[request.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    {request.status === "submitted"
                      ? <Button size="sm" variant="outline" onClick={() => openLink(request)}><Link2 className="mr-1 h-4 w-4" />Vincular fatura</Button>
                      : linked
                        ? <span className="text-xs text-muted-foreground">{dueDateBR(linked.dueDate)} · {formatCurrencyBRL(linked.amount)}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </div>}
      </TabsContent>
    </Tabs>
    <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogContent><DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="space-y-2"><Label>Cliente</Label><Select value={invoice.tenantId} onValueChange={(tenantId) => setInvoice((v) => ({ ...v, tenantId }))}><SelectTrigger><SelectValue placeholder="Selecione uma assinatura" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.orgId} value={c.orgId}>{c.orgName} · {c.planName}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Período</Label><Select value={invoice.billingPeriod} onValueChange={(billingPeriod) => setInvoice((v) => ({ ...v, billingPeriod }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="quarterly">Trimestral</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={invoice.dueDate} onChange={(e) => setInvoice((v) => ({ ...v, dueDate: e.target.value }))} /></div></div>
        <div className="space-y-2"><Label>Valor personalizado (opcional)</Label><Input inputMode="decimal" placeholder="Vazio usa o preço do plano" value={invoice.amount} onChange={(e) => setInvoice((v) => ({ ...v, amount: e.target.value }))} /></div>
        <div className="space-y-2"><Label>Observações</Label><Textarea value={invoice.notes} onChange={(e) => setInvoice((v) => ({ ...v, notes: e.target.value }))} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancelar</Button><Button onClick={() => void saveInvoice()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={pricesOpen} onOpenChange={setPricesOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Preços dos planos</DialogTitle></DialogHeader>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">{plans.map((plan, index) => {
        const base = priceBaseline.current.find((item) => item.id === plan.id);
        const changed = !!base && (base.monthlyPrice !== plan.monthlyPrice || base.annualPrice !== plan.annualPrice || base.currency !== plan.currency);
        return <div key={plan.id} className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto]">
        <div><p className="font-medium">{plan.name}{changed && <span className="ml-2 align-middle text-xs font-medium text-cyan-700">alterado</span>}</p><p className="text-xs text-muted-foreground">{plan.code}</p></div>
        <div className="space-y-1"><Label>Mensal (R$)</Label><Input type="number" min="0" step="0.01" className="w-32" value={plan.monthlyPrice} onChange={(e) => setPlans((items) => items.map((item, i) => i === index ? { ...item, monthlyPrice: Number(e.target.value) } : item))} /></div>
        <div className="space-y-1"><Label>Anual (R$)</Label><Input type="number" min="0" step="0.01" className="w-32" value={plan.annualPrice} onChange={(e) => setPlans((items) => items.map((item, i) => i === index ? { ...item, annualPrice: Number(e.target.value) } : item))} /></div>
      </div>;
      })}</div>
      <DialogFooter><Button variant="outline" onClick={() => { setPlans(priceBaseline.current.map((plan) => ({ ...plan }))); setPricesOpen(false); }}>Cancelar</Button><Button onClick={() => void savePrices()} disabled={saving || priceChanges.length === 0}><Save className="mr-2 h-4 w-4" />{priceChanges.length > 0 ? `Salvar ${priceChanges.length} alteração(ões)` : "Salvar"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!pendingStatus} onOpenChange={(open) => { if (!open) setPendingStatus(null); }}><DialogContent>
      <DialogHeader>
        <DialogTitle>{pendingStatus ? `${BILLING_STATUS_LABELS[pendingStatus.status]} fatura` : ""}</DialogTitle>
        <DialogDescription>Esta ação é definitiva e fica registrada na auditoria. Informe o motivo.</DialogDescription>
      </DialogHeader>
      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: cliente encerrou o contrato em 21/08/2026." />
      <DialogFooter>
        <Button variant="outline" onClick={() => setPendingStatus(null)}>Voltar</Button>
        <Button variant="destructive" onClick={() => void confirmStatus()}>Confirmar</Button>
      </DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!detailsTarget} onOpenChange={(open) => { if (!open) setDetailsTarget(null); }}><DialogContent>
      <DialogHeader>
        <DialogTitle>Detalhes da fatura</DialogTitle>
        <DialogDescription>{detailsTarget ? `${detailsTarget.tenantName} · vence em ${dueDateBR(detailsTarget.dueDate)} · ${formatCurrencyBRL(detailsTarget.amount)}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="space-y-2"><Label>URL da fatura / documento</Label><Input value={detailsForm.invoiceUrl} onChange={(e) => setDetailsForm((form) => ({ ...form, invoiceUrl: e.target.value }))} placeholder="https://..." /></div>
        <div className="space-y-2"><Label>Observações</Label><Textarea rows={3} value={detailsForm.notes} onChange={(e) => setDetailsForm((form) => ({ ...form, notes: e.target.value }))} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setDetailsTarget(null)}>Cancelar</Button>
        <Button onClick={() => void saveDetails()} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar detalhes</Button>
      </DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!linkTarget} onOpenChange={(open) => { if (!open) setLinkTarget(null); }}><DialogContent>
      <DialogHeader>
        <DialogTitle>Vincular cobrança APF à fatura</DialogTitle>
        <DialogDescription>{linkTarget ? `${linkTarget.organizationName} · competência ${competenceBR(linkTarget.competence)} · ${formatCurrencyBRL(linkTarget.grossAmount)}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="space-y-2"><Label>Fatura pendente da organização</Label>
          {linkCandidates.length === 0
            ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhuma fatura pendente para esta organização. Crie uma fatura na aba Faturas e volte aqui.</p>
            : <Select value={linkForm.billingRecordId} onValueChange={(value) => setLinkForm((form) => ({ ...form, billingRecordId: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a fatura" /></SelectTrigger>
                <SelectContent>{linkCandidates.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{dueDateBR(candidate.dueDate)} · {formatCurrencyBRL(candidate.amount)} · {candidate.planType}</SelectItem>)}</SelectContent>
              </Select>}
        </div>
        <div className="space-y-2"><Label>Nota do vínculo (opcional)</Label><Textarea rows={2} value={linkForm.note} onChange={(e) => setLinkForm((form) => ({ ...form, note: e.target.value }))} /></div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={linkForm.markInvoiced} onCheckedChange={(checked) => setLinkForm((form) => ({ ...form, markInvoiced: checked === true }))} />
          Marcar como faturada imediatamente
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setLinkTarget(null)}>Cancelar</Button>
        <Button onClick={() => void confirmLink()} disabled={saving || linkCandidates.length === 0 || !linkForm.billingRecordId}>Vincular</Button>
      </DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!reminderTarget} onOpenChange={(open) => { if (!open) setReminderTarget(null); }}><DialogContent>
      <DialogHeader>
        <DialogTitle>Registrar lembrete de cobrança</DialogTitle>
        <DialogDescription>{reminderTarget ? `${reminderTarget.tenantName} · vence em ${dueDateBR(reminderTarget.dueDate)} · ${reminderTarget.lastReminderAt ? `Último: ${dueDateBR(reminderTarget.lastReminderAt.slice(0,10))}` : "Nenhum lembrete anterior"}` : ""}</DialogDescription>
      </DialogHeader>
      <Textarea rows={3} value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} placeholder="Nota opcional para a equipe..." />
      <DialogFooter>
        <Button variant="outline" onClick={() => setReminderTarget(null)}>Cancelar</Button>
        <Button onClick={() => void confirmReminder()} disabled={saving}>Registrar lembrete</Button>
      </DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!priceHistoryOpen} onOpenChange={(open) => { if (!open) setPriceHistoryOpen(false); }}><DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Histórico de alteração de preços</DialogTitle>
        <DialogDescription>Registros de auditoria das alterações de preços dos planos (admin/financeiro).</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Plano</TableHead><TableHead>Mensal</TableHead><TableHead>Anual</TableHead><TableHead>Moeda</TableHead><TableHead>Responsável</TableHead>
          </TableRow></TableHeader>
          <TableBody>{priceHistory.map((entry, i) => <TableRow key={i}>
            <TableCell>{new Date(entry.actionAt).toLocaleString("pt-BR")}</TableCell>
            <TableCell>{entry.planName} <span className="text-xs text-muted-foreground">({entry.planCode})</span></TableCell>
            <TableCell>{formatCurrencyBRL(entry.monthlyPrice)}</TableCell>
            <TableCell>{formatCurrencyBRL(entry.annualPrice)}</TableCell>
            <TableCell>{entry.currency}</TableCell>
            <TableCell>{entry.actorName} <span className="text-xs text-muted-foreground">{entry.actorEmail && `<${entry.actorEmail}>`}</span></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setPriceHistoryOpen(false)}>Fechar</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
