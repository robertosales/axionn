import { useEffect, useMemo, useState } from "react";
import { Clock3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listSupportTickets, updateSupportTicketStatus } from "@/backoffice/services/backoffice.service";
import type { SupportStatus, SupportTicket } from "@/backoffice/types/backoffice.types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const columns: Array<{ status: SupportStatus; label: string }> = [
  { status: "open", label: "Aberto" }, { status: "in_progress", label: "Em progresso" },
  { status: "waiting_client", label: "Aguardando cliente" }, { status: "resolved", label: "Resolvido" },
];

export default function BOSuporte() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void listSupportTickets().then(setTickets).catch(() => toast.error("Erro ao carregar tickets.")).finally(() => setLoading(false)); }, []);
  const grouped = useMemo(() => Object.fromEntries(columns.map(({ status }) => [status, tickets.filter((ticket) => ticket.status === status)])), [tickets]);
  const move = async (ticket: SupportTicket, status: SupportStatus) => {
    try { await updateSupportTicketStatus(ticket.id, status); setTickets((items) => items.map((item) => item.id === ticket.id ? { ...item, status } : item)); toast.success("Ticket atualizado."); }
    catch { toast.error("Não foi possível atualizar o ticket."); }
  };
  return <div className="space-y-5">
    <div><h1 className="text-xl font-semibold">Suporte</h1><p className="text-sm text-muted-foreground">Fila central de atendimento e acompanhamento de SLA.</p></div>
    {loading ? <Loader2 className="mx-auto my-16 h-6 w-6 animate-spin" /> :
      <div className="grid gap-4 xl:grid-cols-4">{columns.map((column) => <section key={column.status} className="rounded-lg border bg-slate-50">
        <header className="flex items-center justify-between border-b p-3"><h2 className="text-sm font-semibold">{column.label}</h2><Badge variant="secondary">{grouped[column.status].length}</Badge></header>
        <div className="space-y-3 p-3">{grouped[column.status].map((ticket) => {
          const overdue = ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date();
          return <article key={ticket.id} className="space-y-3 rounded-md border bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium text-cyan-700">{ticket.ticketNumber}</span><Badge variant={ticket.priority === "critical" ? "destructive" : "outline"}>{ticket.priority}</Badge></div>
            <div><p className="text-sm font-medium">{ticket.subject}</p><p className="mt-1 text-xs text-muted-foreground">{ticket.tenantName} · {ticket.reporterName}</p></div>
            {ticket.slaDeadline && <p className={`flex items-center gap-1 text-xs ${overdue ? "text-red-600" : "text-muted-foreground"}`}><Clock3 className="h-3 w-3" />{overdue ? "SLA vencido" : new Date(ticket.slaDeadline).toLocaleString("pt-BR")}</p>}
            <Select value={ticket.status} onValueChange={(value) => void move(ticket, value as SupportStatus)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{columns.map((item) => <SelectItem key={item.status} value={item.status}>{item.label}</SelectItem>)}<SelectItem value="closed">Fechado</SelectItem></SelectContent></Select>
          </article>;
        })}{grouped[column.status].length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Sem tickets</p>}</div>
      </section>)}</div>}
  </div>;
}
