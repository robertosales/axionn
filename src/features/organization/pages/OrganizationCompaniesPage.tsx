import { useEffect, useState } from "react";
import { Building2, Loader2, Pencil, Plus, ShieldCheck } from "lucide-react";
import { useCompanies, type Company, type CompanyFormData, EMPTY_COMPANY_FORM } from "@/features/admin/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  trial: "Em avaliação",
  suspended: "Suspensa",
  inactive: "Inativa",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

function formatCnpj(value: string) {
  return onlyDigits(value)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length === 0) return true;
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

  const calculate = (length: number) => {
    let sum = 0;
    let weight = length - 7;
    for (let index = length; index >= 1; index -= 1) {
      sum += Number(digits[length - index]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

function CompanyDialog({
  open,
  company,
  onClose,
  onSave,
}: {
  open: boolean;
  company: Company | null;
  onClose: () => void;
  onSave: (data: CompanyFormData) => Promise<boolean>;
}) {
  const [form, setForm] = useState<CompanyFormData>(EMPTY_COMPANY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      company
        ? {
            name: company.name,
            cnpj: company.cnpj ? formatCnpj(company.cnpj) : "",
            email: company.email ?? "",
            phone: company.phone ?? "",
            logo_url: company.logo_url ?? "",
            status: company.status,
          }
        : EMPTY_COMPANY_FORM,
    );
  }, [company, open]);

  const save = async () => {
    if (!form.name.trim() || !isValidCnpj(form.cnpj)) return;
    setSaving(true);
    const ok = await onSave({
      ...form,
      name: form.name.trim(),
      cnpj: onlyDigits(form.cnpj),
      email: form.email.trim(),
      phone: form.phone.trim(),
      logo_url: form.logo_url.trim(),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{company ? "Editar empresa cliente" : "Nova empresa cliente"}</DialogTitle>
          <DialogDescription>
            O cadastro será vinculado automaticamente à organização ativa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-name">Nome *</Label>
            <Input
              id="company-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-cnpj">CNPJ</Label>
            <Input
              id="company-cnpj"
              value={form.cnpj}
              maxLength={18}
              inputMode="numeric"
              onChange={(event) =>
                setForm((current) => ({ ...current, cnpj: formatCnpj(event.target.value) }))
              }
            />
            {!isValidCnpj(form.cnpj) && (
              <p className="text-xs text-destructive">Informe um CNPJ válido.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(status) =>
                setForm((current) => ({ ...current, status: status as CompanyFormData["status"] }))
              }
            >
              <SelectTrigger id="company-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="trial">Em avaliação</SelectItem>
                <SelectItem value="suspended">Suspensa</SelectItem>
                <SelectItem value="inactive">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email">E-mail</Label>
            <Input
              id="company-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-phone">Telefone</Label>
            <Input
              id="company-phone"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-logo">URL da logo</Label>
            <Input
              id="company-logo"
              type="url"
              placeholder="https://..."
              value={form.logo_url}
              onChange={(event) => setForm((current) => ({ ...current, logo_url: event.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !form.name.trim() || !isValidCnpj(form.cnpj)}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganizationCompaniesPage() {
  const { companies, loading, kpis, create, update, remove } = useCompanies();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Company | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const save = (data: CompanyFormData) =>
    editing ? update(editing.id, data) : create(data);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Empresas clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cadastros vinculados exclusivamente à organização ativa.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nova empresa
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total", kpis.total],
          ["Ativas", kpis.active],
          ["Em avaliação", kpis.trial],
          ["Suspensas", kpis.suspended],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Building2 className="h-9 w-9 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Nenhuma empresa cliente cadastrada</p>
              <p className="text-sm text-muted-foreground">Crie o primeiro cadastro dentro deste tenant.</p>
            </div>
            <Button variant="outline" onClick={openNew}>Criar empresa</Button>
          </div>
        ) : (
          <div className="divide-y">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{company.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {company.cnpj ? formatCnpj(company.cnpj) : "CNPJ não informado"}
                      {company.teamCount ? ` · ${company.teamCount} time(s)` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={company.status === "active" ? "secondary" : "outline"}>
                    {STATUS_LABELS[company.status] ?? company.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${company.name}`}
                    onClick={() => {
                      setEditing(company);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {company.status !== "inactive" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-muted-foreground"
                      onClick={() => setArchiveTarget(company)}
                    >
                      <ShieldCheck className="h-4 w-4" /> Inativar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Plano e cotas são administrados em <strong>Plano e uso</strong>. Este console não altera licenças legadas por empresa.
      </div>

      <CompanyDialog
        open={dialogOpen}
        company={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSave={save}
      />

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar empresa cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.name} deixará de aparecer como opção ativa. O cadastro e o histórico serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveTarget) void remove(archiveTarget.id);
                setArchiveTarget(null);
              }}
            >
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
