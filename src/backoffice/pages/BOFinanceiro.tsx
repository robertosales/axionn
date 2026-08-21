import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Plus, Receipt, RefreshCw, Save, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBillingRecord, generateMonthlyBilling, listBackofficePlanPrices,
  listBillingCustomers, listBillingRecords, markOverdueInvoices, updateBackofficePlanPrice, updateBillingStatus,
} from "@/backoffice/services/backoffice.service";
import { billingReasonSchema, invoiceFormSchema, planPriceSchema } from "@/backoffice/schemas/billing.schema";
import {
  BILLING_STATUSES, BILLING_STATUS_LABELS, BILLING_STATUS_TRANSITIONS,
  type BackofficePlanPrice, type BillingCustomer, type BillingRecord, type BillingStatus,
} from "@/backoffice/types/backoffice.types";
import { exportToCsv } from "@/lib/exportToCsv";
import { formatCurrencyBRL, parseBRLInput } from "@/lib/currency";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 10;

type PeriodFilter = "all" | "month" | "next30";

const statusVariant: Record<BillingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  pending: "secondary",
  overdue: "destructive",
  cancelled: "outline",
  refunded: "outline",
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const today = () => isoDate(new Date());

function withinPeriod(dueDate: string, period: PeriodFilter) {
  if (period === "all") return true;
  if (period === "month") return dueDate.startsWith(today().slice(0, 7));
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return dueDate >= today() && dueDate <= isoDate(end);
}

export default function BOFinanceiro() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [plans, setPlans] = useState<BackofficePlanPrice[]>([]);
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [page, setPage] = useState(1);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [invoice, setInvoice] = useState({ tenantId: "", billingPeriod: "monthly", dueDate: today(), amount: "", notes: "" });
  const [pendingStatus, setPendingStatus] = useState<{ record: BillingRecord; status: BillingStatus } | null>(null);
  const [reason, setReason] = useState("");
  const priceBaseline = useRef<BackofficePlanPrice[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await markOverdueInvoices().catch(() => undefined);
      const [billing, prices, organizations] = await Promise.all([listBillingRecords(), listBackofficePlanPrices(), listBillingCustomers()]);
      setRecords(billing);
      setPlans(prices);
      priceBaseline.current = prices;
      setCustomers(organizations);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return records.filter((record) =>
      (filter === "all" || record.status === filter) &&
      withinPeriod(record.dueDate, period) &&
      record.tenantName.toLocaleLowerCase("pt-BR").includes(term));
  }, [records, filter, period, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totals = useMemo(() => ({
    paid: formatCurrencyBRL(records.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0)),
    pending: formatCurrencyBRL(records.filter((r) => r.status === "pending" && r.dueDate >= today()).reduce((sum, r) => sum + r.amount, 0)),
    overdue: formatCurrencyBRL(records.filter((r) => r.status === "overdue" || (r.status === "pending" && r.dueDate < today())).reduce((sum, r) => sum + r.amount, 0)),
  }), [records]);

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

  const exportCsv = () => exportToCsv({
    filename: "faturas-backoffice",
    rows: visible.map((record) => ({
      Cliente: record.tenantName,
      Valor: formatCurrencyBRL(record.amount),
      Status: BILLING_STATUS_LABELS[record.status],
      Plano: record.planType,
      Periodo: record.billingPeriod,
      Vencimento: new Date(`${record.dueDate}T12:00:00`).toLocaleDateString("pt-BR"),
    })),
  });

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Financeiro</h1><p className="text-sm text-muted-foreground">Faturas, receitas e inadimplência.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPricesOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Preços</Button>
        <Button variant="outline" onClick={() => void generate()} disabled={saving}><RefreshCw className="mr-2 h-4 w-4" />Gerar mensalidade</Button>
        <Button onClick={() => setInvoiceOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova fatura</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      {[["Receita paga", totals.paid], ["Pendente", totals.pending], ["Vencida", totals.overdue]].map(([label, value]) =>
        <div key={label} className="rounded-lg border bg-white p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
    </div>
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
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Plano</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{paged.map((record) => <TableRow key={record.id}>
              <TableCell className="font-medium">{record.tenantName}</TableCell>
              <TableCell>{record.planType}</TableCell>
              <TableCell>{formatCurrencyBRL(record.amount)}</TableCell>
              <TableCell>{new Date(`${record.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell>
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
    <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogContent><DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="space-y-2"><Label>Cliente</Label><Select value={invoice.tenantId} onValueChange={(tenantId) => setInvoice((v) => ({ ...v, tenantId }))}><SelectTrigger><SelectValue placeholder="Selecione uma assinatura" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.orgId} value={c.orgId}>{c.orgName} · {c.planName}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Período</Label><Select value={invoice.billingPeriod} onValueChange={(billingPeriod) => setInvoice((v) => ({ ...v, billingPeriod }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="quarterly">Trimestral</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={invoice.dueDate} onChange={(e) => setInvoice((v) => ({ ...v, dueDate: e.target.value }))} /></div></div>
        <div className="space-y-2"><Label>Valor personalizado (opcional)</Label><Input inputMode="decimal" placeholder="Vazio usa o preço do plano" value={invoice.amount} onChange={(e) => setInvoice((v) => ({ ...v, amount: e.target.value }))} /></div>
        <div className="space-y-2"><Label>Observações</Label><Textarea value={invoice.notes} onChange={(e) => setInvoice((v) => ({ ...v, notes: e.target.value }))} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancelar</Button><Button onClick={() => void saveInvoice()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={pricesOpen} onOpenChange={setPricesOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Preços dos planos</DialogTitle></DialogHeader>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">{plans.map((plan, index) => <div key={plan.id} className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto]">
        <div><p className="font-medium">{plan.name}</p><p className="text-xs text-muted-foreground">{plan.code}{priceBaseline.current.find((item) => item.id === plan.id) && (() => {
          const base = priceBaseline.current.find((item) => item.id === plan.id)!;
          const changed = base.monthlyPrice !== plan.monthlyPrice || base.annualPrice !== plan.annualPrice || base.currency !== plan.currency;
          return changed ? <span className="ml-2 font-medium text-cyan-700">alterado</span> : null;
        })()}</p></div>
        <div className="space-y-1"><Label>Mensal (R$)</Label><Input type="number" min="0" step="0.01" className="w-32" value={plan.monthlyPrice} onChange={(e) => setPlans((items) => items.map((item, i) => i === index ? { ...item, monthlyPrice: Number(e.target.value) } : item))} /></div>
        <div className="space-y-1"><Label>Anual (R$)</Label><Input type="number" min="0" step="0.01" className="w-32" value={plan.annualPrice} onChange={(e) => setPlans((items) => items.map((item, i) => i === index ? { ...item, annualPrice: Number(e.target.value) } : item))} /></div>
      </div>)}</div>
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
  </div>;
}
