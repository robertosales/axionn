import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { listBillingRecords, updateBillingStatus } from "@/backoffice/services/backoffice.service";
import type { BillingRecord, BillingStatus } from "@/backoffice/types/backoffice.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statuses: BillingStatus[] = ["pending", "paid", "overdue", "cancelled", "refunded"];

export default function BOFinanceiro() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    void listBillingRecords().then(setRecords).catch(() => toast.error("Erro ao carregar faturas.")).finally(() => setLoading(false));
  }, []);

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
      <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        ["Receita paga", money.format(records.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0))],
        ["Pendente", money.format(records.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0))],
        ["Vencida", money.format(records.filter((r) => r.status === "overdue").reduce((sum, r) => sum + r.amount, 0))],
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
  </div>;
}
