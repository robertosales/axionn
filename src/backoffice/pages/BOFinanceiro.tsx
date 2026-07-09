import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, RefreshCw, Save, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBillingRecord, generateMonthlyBilling, listBackofficePlanPrices,
  listBillingCustomers, listBillingRecords, updateBackofficePlanPrice, updateBillingStatus,
} from "@/backoffice/services/backoffice.service";
import type { BackofficePlanPrice, BillingCustomer, BillingRecord, BillingStatus } from "@/backoffice/types/backoffice.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statuses: BillingStatus[] = ["pending", "paid", "overdue", "cancelled", "refunded"];
const today = () => new Date().toISOString().slice(0, 10);

export default function BOFinanceiro() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [plans, setPlans] = useState<BackofficePlanPrice[]>([]);
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [saving, setSaving] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [invoice, setInvoice] = useState({ tenantId: "", billingPeriod: "monthly", dueDate: today(), amount: "", notes: "" });

  useEffect(() => {
    void Promise.all([listBillingRecords(), listBackofficePlanPrices(), listBillingCustomers()])
      .then(([billing, prices, organizations]) => { setRecords(billing); setPlans(prices); setCustomers(organizations); })
      .catch(() => toast.error("Erro ao carregar o financeiro.")).finally(() => setLoading(false));
  }, []);

  const reloadBilling = async () => setRecords(await listBillingRecords());

  const saveInvoice = async () => {
    if (!invoice.tenantId || !invoice.dueDate) return toast.error("Cliente e vencimento são obrigatórios.");
    setSaving(true);
    try {
      await createBillingRecord({ tenantId: invoice.tenantId, billingPeriod: invoice.billingPeriod,
        dueDate: invoice.dueDate, amount: invoice.amount ? Number(invoice.amount.replace(",", ".")) : null,
        notes: invoice.notes || null });
      toast.success("Fatura criada."); setInvoiceOpen(false); await reloadBilling();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao criar fatura."); }
    finally { setSaving(false); }
  };

  const savePrices = async () => {
    setSaving(true);
    try { await Promise.all(plans.map(updateBackofficePlanPrice)); toast.success("Preços atualizados."); setPricesOpen(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar preços."); }
    finally { setSaving(false); }
  };

  const generate = async () => {
    setSaving(true);
    try { const count = await generateMonthlyBilling(today(), 10); toast.success(`${count} fatura(s) gerada(s).`); await reloadBilling(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Erro na geração mensal."); }
    finally { setSaving(false); }
  };

  const visible = useMemo(() => records.filter((record) =>
    (filter === "all" || record.status === filter) &&
    record.tenantName.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))), [records, filter, search]);

  const changeStatus = async (record: BillingRecord, status: BillingStatus) => {
    try {
      await updateBillingStatus(record.id, status);
      setRecords((current) => current.map((item) => item.id === record.id
        ? { ...item, status, paidAt: status === "paid" ? item.paidAt ?? new Date().toISOString() : item.paidAt } : item));
      toast.success("Status da fatura atualizado.");
    } catch { toast.error("Não foi possível atualizar a fatura."); }
  };

  const exportCsv = () => {
    const rows = [["Cliente", "Valor", "Status", "Plano", "Vencimento"], ...visible.map((r) =>
      [r.tenantName, String(r.amount), r.status, r.planType, r.dueDate])];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "faturas-backoffice.csv"; link.click();
    URL.revokeObjectURL(link.href);
  };

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
      {[
        ["Receita paga", money.format(records.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0))],
        ["Pendente", money.format(records.filter((r) => r.status === "pending" && r.dueDate >= today()).reduce((sum, r) => sum + r.amount, 0))],
        ["Vencida", money.format(records.filter((r) => r.status === "overdue" || (r.status === "pending" && r.dueDate < today())).reduce((sum, r) => sum + r.amount, 0))],
      ].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
    </div>
    <div className="rounded-lg border bg-white">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" /></div>
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
      </div>
      {loading ? <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin" /> :
        <Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Plano</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{visible.map((record) => <TableRow key={record.id}><TableCell className="font-medium">{record.tenantName}</TableCell><TableCell>{record.planType}</TableCell><TableCell>{money.format(record.amount)}</TableCell><TableCell>{new Date(`${record.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell><TableCell><Select value={record.status} onValueChange={(value) => void changeStatus(record, value as BillingStatus)}><SelectTrigger className="w-36"><Badge variant="outline">{record.status}</Badge></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></TableCell></TableRow>)}</TableBody>
        </Table>}
      {!loading && visible.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>}
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
      <div className="space-y-3">{plans.map((plan, index) => <div key={plan.id} className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-3"><div><p className="font-medium">{plan.name}</p><p className="text-xs text-muted-foreground">{plan.code}</p></div><div className="space-y-1"><Label>Mensal (R$)</Label><Input type="number" min="0" step="0.01" value={plan.monthlyPrice} onChange={(e) => setPlans((items) => items.map((item, i) => i === index ? { ...item, monthlyPrice: Number(e.target.value) } : item))} /></div><div className="space-y-1"><Label>Anual (R$)</Label><Input type="number" min="0" step="0.01" value={plan.annualPrice} onChange={(e) => setPlans((items) => items.map((item, i) => i === index ? { ...item, annualPrice: Number(e.target.value) } : item))} /></div></div>)}</div>
      <DialogFooter><Button variant="outline" onClick={() => setPricesOpen(false)}>Cancelar</Button><Button onClick={() => void savePrices()} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
