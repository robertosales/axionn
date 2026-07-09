import { useEffect, useState } from "react";
import { Edit3, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import {
  listBackofficeStaffMembers,
  upsertBackofficeStaffMember,
} from "@/backoffice/services/backoffice.service";
import {
  BACKOFFICE_ROLES,
  type BackofficeRole,
  type BackofficeStaffMember,
} from "@/backoffice/types/backoffice.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StaffForm {
  userId: string;
  fullName: string;
  email: string;
  role: BackofficeRole;
  department: string;
  isActive: boolean;
}

const EMPTY_FORM: StaffForm = {
  userId: "",
  fullName: "",
  email: "",
  role: "suporte",
  department: "",
  isActive: true,
};

export default function BOEquipe() {
  const [staff, setStaff] = useState<BackofficeStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      setStaff(await listBackofficeStaffMembers());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao listar equipe");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (member: BackofficeStaffMember) => {
    setForm({
      userId: member.userId,
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      department: member.department ?? "",
      isActive: member.isActive,
    });
    setFormOpen(true);
  };

  const saveStaff = async () => {
    if (!form.userId.trim()) return toast.error("User ID e obrigatorio");
    if (!form.fullName.trim()) return toast.error("Nome e obrigatorio");
    if (!form.email.trim()) return toast.error("E-mail e obrigatorio");

    setSaving(true);
    try {
      await upsertBackofficeStaffMember({
        userId: form.userId.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        role: form.role,
        department: form.department.trim() || null,
        isActive: form.isActive,
      });
      toast.success("Membro da equipe salvo");
      setFormOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar equipe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipe Roberto Sales</h1>
          <p className="text-sm text-muted-foreground">
            Funcionarios internos autorizados a acessar o Backoffice.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo staff
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ultimo acesso</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="font-medium">{member.fullName}</div>
                    <div className="text-xs text-muted-foreground">{member.department ?? "-"}</div>
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{member.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.isActive ? "secondary" : "outline"}>
                      {member.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.lastLoginAt
                      ? new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(member.lastLoginAt))
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membro do Backoffice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>User ID Supabase</Label>
              <Input
                value={form.userId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, userId: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(role) =>
                    setForm((current) => ({ ...current, role: role as BackofficeRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKOFFICE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.isActive}
                onCheckedChange={(isActive) =>
                  setForm((current) => ({ ...current, isActive }))
                }
              />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveStaff()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
