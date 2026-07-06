import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Crown,
  Loader2,
  MailPlus,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useOrganizationMembers,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationModuleKey,
} from "@/features/organization/hooks/useOrganizationMembers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const MODULES: Array<{
  key: OrganizationModuleKey;
  label: string;
}> = [
  { key: "sala_agil", label: "Sala Ágil" },
  { key: "sustentacao", label: "Sustentação" },
  { key: "rdm", label: "RDM" },
];

const ROLE_LABELS = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
} as const;

const INVITATION_STATUS_LABELS = {
  pending: "Pendente",
  accepted: "Aceito",
  expired: "Expirado",
  revoked: "Revogado",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function ModuleSelector({
  value,
  onChange,
  disabled,
}: {
  value: OrganizationModuleKey[];
  onChange: (value: OrganizationModuleKey[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {MODULES.map((module) => {
        const checked = value.includes(module.key);
        return (
          <label
            key={module.key}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(nextChecked) => {
                if (disabled) return;
                onChange(
                  nextChecked
                    ? [...value, module.key]
                    : value.filter((item) => item !== module.key),
                );
              }}
            />
            {module.label}
          </label>
        );
      })}
    </div>
  );
}

// ─── BUG-003: Transfer Ownership Confirmation Dialog ────────────────────────
function TransferOwnershipConfirmDialog({
  open,
  memberName,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  memberName: string;
  busy: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Transferir propriedade
          </DialogTitle>
          <DialogDescription>
            Você está prestes a transferir a propriedade da organização para{" "}
            <strong>{memberName}</strong>. Esta ação é{" "}
            <strong>irreversível</strong> — você perderá o papel de Proprietário
            e não poderá desfazê-la sem a ajuda do novo proprietário.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteMemberDialog({
  open,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    email: string;
    role: "admin" | "member";
    moduleKeys: OrganizationModuleKey[];
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [moduleKeys, setModuleKeys] = useState<OrganizationModuleKey[]>([
    "sala_agil",
  ]);

  const reset = () => {
    setEmail("");
    setRole("member");
    setModuleKeys(["sala_agil"]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            O usuário receberá um link de autenticação e entrada na organização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="organization-invite-email">E-mail</Label>
            <Input
              id="organization-invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@empresa.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label>Papel na organização</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "admin" | "member")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Módulos iniciais</Label>
            <ModuleSelector value={moduleKeys} onChange={setModuleKeys} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !email.trim()}
            onClick={async () => {
              await onSubmit({ email: email.trim(), role, moduleKeys });
              reset();
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── BUG-001, BUG-002, BUG-004, BUG-005: EditMemberDialog ──────────────────
function EditMemberDialog({
  member,
  busy,
  currentUserId,
  canTransferOwnership,
  onClose,
  onSave,
  onDeactivate,
  onTransferOwnership,
}: {
  member: OrganizationMember | null;
  busy: boolean;
  currentUserId?: string;
  canTransferOwnership: boolean;
  onClose: () => void;
  onSave: (input: {
    role: "admin" | "member";
    isActive: boolean;
    moduleKeys: OrganizationModuleKey[];
    newEmail?: string;
  }) => Promise<void>;
  onDeactivate: () => Promise<void>;
  onTransferOwnership: () => Promise<void>;
}) {
  const [role, setRole] = useState<"admin" | "member">("member");
  const [isActive, setIsActive] = useState(true);
  const [moduleKeys, setModuleKeys] = useState<OrganizationModuleKey[]>([]);
  // BUG-004: email migration state
  const [newEmail, setNewEmail] = useState("");
  const [showEmailField, setShowEmailField] = useState(false);
  // BUG-002: transfer ownership confirmation
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  const memberKey = member?.userId;
  useMemo(() => {
    if (!member) return;
    setRole(member.membershipRole === "admin" ? "admin" : "member");
    setIsActive(member.isActive);
    setModuleKeys(member.moduleKeys);
    setNewEmail("");
    setShowEmailField(false);
    setTransferConfirmOpen(false);
  }, [memberKey]);

  const isOwner = member?.membershipRole === "owner";
  const isSelf = member?.userId === currentUserId;
  // BUG-003: warn if member is inactive
  const isInactive = member && !member.isActive;

  return (
    <>
      {/* BUG-005: max-height + overflow for small viewports */}
      <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            {/* BUG-005: dynamic subtitle */}
            <DialogTitle>Gerenciar membro</DialogTitle>
            <DialogDescription>
              {member?.displayName} · {member?.email}
            </DialogDescription>
          </DialogHeader>

          {member && (
            <div className="space-y-4 py-2">
              {/* BUG-003: alert when member is inactive */}
              {isInactive && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Este membro está <strong>inativo</strong>. Reset de senha
                    não será possível até que o acesso seja reativado.
                  </AlertDescription>
                </Alert>
              )}

              {/* Papel */}
              <div className="space-y-2">
                <Label>Papel</Label>
                {isOwner ? (
                  // BUG-005: use Badge component for owner — consistent with design system
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">Proprietário da organização</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      read-only
                    </Badge>
                  </div>
                ) : (
                  <Select
                    value={role}
                    onValueChange={(value) =>
                      setRole(value as "admin" | "member")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Módulos — BUG-001: owner modules are read-only, not editable */}
              <div className="space-y-2">
                <Label>Módulos</Label>
                <ModuleSelector
                  value={moduleKeys}
                  onChange={setModuleKeys}
                  disabled={isOwner}
                />
              </div>

              {/* BUG-005: Separator between modules and active toggle */}
              <Separator />

              {/* BUG-002: "Acesso ativo" shown for ALL roles (read-only for owner) */}
              <label
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isOwner || isSelf ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
              >
                <Checkbox
                  checked={isOwner ? true : isActive}
                  disabled={isOwner || isSelf}
                  onCheckedChange={(checked) => {
                    if (!isOwner && !isSelf) setIsActive(Boolean(checked));
                  }}
                />
                Acesso ativo
                {isOwner && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Proprietário sempre ativo
                  </span>
                )}
              </label>

              {/* BUG-004: Email migration — shown for non-owner, non-self members */}
              {!isOwner && !isSelf && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Migração de e-mail</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setShowEmailField((prev) => !prev)}
                      >
                        {showEmailField ? "Cancelar" : "Alterar e-mail"}
                      </Button>
                    </div>
                    {showEmailField && (
                      <>
                        <Input
                          type="email"
                          placeholder="novo@email.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          autoComplete="email"
                        />
                        <p className="text-xs text-muted-foreground">
                          Um e-mail de confirmação será enviado para o endereço
                          atual e o novo. Sessões existentes serão invalidadas.
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* BUG-005: Footer reorganized — destructive actions left, positive right */}
          <DialogFooter className="mt-auto gap-2 sm:justify-between">
            <div className="flex gap-2">
              {member && !isOwner && !isSelf && member.isActive && (
                // BUG-005: destructive uses outline variant to reduce visual weight
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  disabled={busy}
                  onClick={onDeactivate}
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Desativar
                </Button>
              )}
              {/* BUG-002: Transfer ownership now opens confirmation dialog */}
              {member && !isOwner && canTransferOwnership && member.isActive && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setTransferConfirmOpen(true)}
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Tornar proprietário
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                disabled={busy || isOwner}
                onClick={() =>
                  onSave({
                    role,
                    isActive,
                    moduleKeys,
                    newEmail: showEmailField && newEmail.trim() ? newEmail.trim() : undefined,
                  })
                }
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BUG-002: Transfer ownership confirmation dialog */}
      <TransferOwnershipConfirmDialog
        open={transferConfirmOpen}
        memberName={member?.displayName ?? ""}
        busy={busy}
        onConfirm={async () => {
          setTransferConfirmOpen(false);
          await onTransferOwnership();
        }}
        onCancel={() => setTransferConfirmOpen(false)}
      />
    </>
  );
}

export default function OrganizationMembersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    organization,
    members,
    invitations,
    loading,
    mutating,
    error,
    refresh,
    inviteMember,
    resendInvitation,
    revokeInvitation,
    updateMember,
    deactivateMember,
    transferOwnership,
  } = useOrganizationMembers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(
    null,
  );

  const currentMembership = useMemo(
    () => members.find((member) => member.userId === user?.id),
    [members, user?.id],
  );
  const canTransferOwnership =
    organization?.isPlatformAdmin === true ||
    currentMembership?.membershipRole === "owner";
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.invitationStatus === "pending",
  );

  const handleInvite = async (input: {
    email: string;
    role: "admin" | "member";
    moduleKeys: OrganizationModuleKey[];
  }) => {
    try {
      await inviteMember(input);
      toast.success("Convite enviado com sucesso.");
      setInviteOpen(false);
    } catch (inviteError) {
      const message =
        inviteError instanceof Error ? inviteError.message : "Erro ao enviar convite.";
      toast.error(message);
    }
  };

  const handleInvitationAction = async (
    invitation: OrganizationInvitation,
    action: "resend" | "revoke",
  ) => {
    try {
      if (action === "resend") {
        await resendInvitation(invitation.invitationId);
        toast.success("Convite reenviado.");
      } else {
        await revokeInvitation(invitation.invitationId);
        toast.success("Convite revogado.");
      }
    } catch (invitationError) {
      toast.error(
        invitationError instanceof Error
          ? invitationError.message
          : "Não foi possível atualizar o convite.",
      );
    }
  };

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Alert className="max-w-xl">
          <AlertDescription>
            Selecione uma organização para gerenciar seus membros.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">Membros da organização</h1>
              <p className="truncate text-sm text-muted-foreground">
                {organization.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <MailPlus className="mr-2 h-4 w-4" />
              Convidar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Membros cadastrados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <UserCheck className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-semibold">
                  {members.filter((member) => member.isActive).length}
                </p>
                <p className="text-xs text-muted-foreground">Acessos ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <MailPlus className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-semibold">{pendingInvitations.length}</p>
                <p className="text-xs text-muted-foreground">Convites pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Membros</TabsTrigger>
            <TabsTrigger value="invitations">
              Convites
              {pendingInvitations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingInvitations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acessos da organização</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Módulos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.userId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{member.displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {member.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                member.membershipRole === "owner"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {member.membershipRole === "owner" && (
                                <Crown className="mr-1 h-3 w-3" />
                              )}
                              {member.membershipRole === "admin" && (
                                <ShieldCheck className="mr-1 h-3 w-3" />
                              )}
                              {ROLE_LABELS[member.membershipRole]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {member.moduleKeys.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  Nenhum módulo
                                </span>
                              ) : (
                                member.moduleKeys.map((moduleKey) => (
                                  <Badge key={moduleKey} variant="outline">
                                    {MODULES.find((module) => module.key === moduleKey)
                                      ?.label ?? moduleKey}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={member.isActive ? "secondary" : "destructive"}
                            >
                              {member.isActive ? "Ativo" : "Desativado"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => setEditingMember(member)}
                                >
                                  Gerenciar acesso
                                </DropdownMenuItem>
                                {member.userId !== user?.id &&
                                  member.membershipRole !== "owner" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => {
                                          void deactivateMember(member.userId)
                                            .then(() =>
                                              toast.success("Membro desativado."),
                                            )
                                            .catch((memberError) =>
                                              toast.error(
                                                memberError instanceof Error
                                                  ? memberError.message
                                                  : "Falha ao desativar membro.",
                                              ),
                                            );
                                        }}
                                      >
                                        Desativar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de convites</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center">
                          <span className="text-sm text-muted-foreground">
                            Nenhum convite criado.
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((invitation) => (
                        <TableRow key={invitation.invitationId}>
                          <TableCell>
                            <p className="font-medium">{invitation.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Enviado por {invitation.invitedByName} · tentativa{" "}
                              {invitation.sendCount}
                            </p>
                          </TableCell>
                          <TableCell>
                            {ROLE_LABELS[invitation.invitationRole]}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                invitation.invitationStatus === "pending"
                                  ? "secondary"
                                  : invitation.invitationStatus === "accepted"
                                    ? "default"
                                    : "outline"
                              }
                            >
                              {
                                INVITATION_STATUS_LABELS[
                                  invitation.invitationStatus
                                ]
                              }
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                          <TableCell>
                            {invitation.invitationStatus !== "accepted" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void handleInvitationAction(
                                        invitation,
                                        "resend",
                                      )
                                    }
                                  >
                                    Reenviar convite
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() =>
                                      void handleInvitationAction(
                                        invitation,
                                        "revoke",
                                      )
                                    }
                                  >
                                    Revogar convite
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <InviteMemberDialog
        open={inviteOpen}
        busy={mutating}
        onOpenChange={setInviteOpen}
        onSubmit={handleInvite}
      />

      <EditMemberDialog
        member={editingMember}
        busy={mutating}
        currentUserId={user?.id}
        canTransferOwnership={canTransferOwnership}
        onClose={() => setEditingMember(null)}
        onSave={async (input) => {
          if (!editingMember) return;
          try {
            await updateMember({ userId: editingMember.userId, ...input });
            toast.success("Acesso atualizado.");
            setEditingMember(null);
          } catch (memberError) {
            toast.error(
              memberError instanceof Error
                ? memberError.message
                : "Não foi possível atualizar o membro.",
            );
          }
        }}
        onDeactivate={async () => {
          if (!editingMember) return;
          try {
            await deactivateMember(editingMember.userId);
            toast.success("Membro desativado.");
            setEditingMember(null);
          } catch (memberError) {
            toast.error(
              memberError instanceof Error
                ? memberError.message
                : "Não foi possível desativar o membro.",
            );
          }
        }}
        onTransferOwnership={async () => {
          if (!editingMember) return;
          try {
            await transferOwnership(editingMember.userId);
            toast.success("Propriedade transferida.");
            setEditingMember(null);
          } catch (memberError) {
            toast.error(
              memberError instanceof Error
                ? memberError.message
                : "Não foi possível transferir a propriedade.",
            );
          }
        }}
      />
    </div>
  );
}
