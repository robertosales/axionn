import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, Loader2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  listPlatformOrganizationSubscriptions,
  type PlatformOrganizationSubscription,
} from "@/features/platform/services/plans.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

export default function BOClientes() {
  const [clientes, setClientes] = useState<PlatformOrganizationSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void listPlatformOrganizationSubscriptions()
      .then(setClientes)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar clientes"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return clientes;
    return clientes.filter((cliente) =>
      [cliente.orgName, cliente.orgSlug, cliente.planName, cliente.subscriptionStatus]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [clientes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Selecione uma organização para consultar e editar sua assinatura.
        </p>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Buscar por nome, slug ou plano"
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((cliente) => (
                <TableRow key={cliente.orgId}>
                  <TableCell>
                    <div className="font-medium">{cliente.orgName}</div>
                    <div className="text-xs text-muted-foreground">
                      {cliente.orgSlug || cliente.orgId}
                    </div>
                  </TableCell>
                  <TableCell>{cliente.planName ?? "Sem assinatura"}</TableCell>
                  <TableCell>
                    <Badge variant={cliente.subscriptionStatus === "active" ? "secondary" : "outline"}>
                      {cliente.subscriptionStatus ?? cliente.orgStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cliente.usersUsed} usuários · {cliente.projectsUsed} projetos
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" className="gap-2">
                      <Link to={`/backoffice/assinaturas?organization=${cliente.orgId}`}>
                        <CreditCard className="h-4 w-4" />
                        Abrir assinatura
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Próxima <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
