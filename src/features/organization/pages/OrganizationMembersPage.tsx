import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MailPlus,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Constantes ───────────────────────────────────────────────────────────────
const MODULES: Array<{ key: OrganizationModuleKey; label: string; badgeClass: string }> = [
  {
    key: "sala_agil",
    label: "Sala Ágil",
    badgeClass: "bg-violet-600/15 text-violet-700 border-violet-400/30 dark:text-violet-300",
  },
  {
    key: "sustentacao",
    label: "Sustentação",
    badgeClass: "bg-blue-600/15 text-blue-700 border-blue-400/30 dark:text-blue-300",
  },
  {
    key: "rdm",
    label: "RDM",
    badgeClass: "bg-purple-600/15 text-purple-700 border-purple-400/30 dark:text-purple-300",
  },
];

const ROLE_LABELS = {
  owner:  "Proprietário",
  admin:  "Administrador",
  member: "Membro",
} as const;

const INVITATION_STATUS_LABELS = {
  pending:  "Pendente",
  accepted: "Aceito",
  expired:  "Expirado",
  revoked:  "Revogado",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/** Gera senha temporária legível: 12 chars, letras + dígitos + símbolo */
function generateTempPassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const syms   = "@#!$";
  const pool   = upper + lower + digits + syms;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    syms[Math.floor(Math.random() * syms.length)],
  ];
  for (let i = 4; i < 12; i++) {
    pwd.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return pwd.sort(() => Math.random() - 0.5).join("");
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

// ─── ModuleSelector ───────────────────────────────────────────────────────────
function ModuleSelector({
  value,
  onChange,
  disabled,
}: {
  value: OrganizationModuleKey[];
  onChange: (v: OrganizationModuleKey[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {MODULES.map((mod) => {
        const checked = value.includes(mod.key);
        return (
          <div
            key={mod.key}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-colors",
              disabled ? "opacity-50" : checked ? "border-primary/40 bg-primary/[.03]" : "border-border",
            )}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              id={`mod-${mod.key}`}
              onCheckedChange={(next) => {
                if (disabled) return;
                onChange(next ? [...value, mod.key] : value.filter((k) => k !== mod.key));
              }}
            />
            <label
              htmlFor={`mod-${mod.key}`}
              className={cn("cursor-pointer text-xs font-medium", disabled && "cursor-not-allowed")}
            >
              <Badge className={cn("text-[9px] gap-1 px-1.5 py-0", mod.badgeClass)}>
                <Zap className="h-2.5 w-2.5" />
                {mod.label}
              </Badge>
            </label>
          </div>
        );
      })}
    </div>
  );
}

// ─── TransferOwnershipConfirmDialog ───────────────────────────────────────────
function TransferOwnershipConfirmDialog({
  open, memberName, busy, onConfirm, onCancel,
}: {
  open: boolean; memberName: string; busy: boolean;
  onConfirm: () => Promise<void>; onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Transferir propriedade
          </DialogTitle>
          <DialogDescription>
            Você está prestes a transferir a propriedade para <strong>{memberName}</strong>.
            Esta ação é <strong>irreversível</strong> — você perderá o papel de Proprietário.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── InviteMemberDialog ───────────────────────────────────────────────────────
function InviteMemberDialog({
  open, busy, onOpenChange, onSubmit,
}: {
  open: boolean; busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { email: string; role: "admin" | "member"; moduleKeys: OrganizationModuleKey[] }) => Promise<void>;
}) {
  const [email, setEmail]           = useState("");
  const [role, setRole]             = useState<"admin" | "member">("member");
  const [moduleKeys, setModuleKeys] = useState<OrganizationModuleKey[]>(["sala_agil"]);

  const reset = () => { setEmail(""); setRole("member"); setModuleKeys(["sala_agil"]); };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            O usuário receberá um link de autenticação e entrada na organização.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Papel na organização</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Módulos iniciais</Label>
            <ModuleSelector value={moduleKeys} onChange={setModuleKeys} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={busy || !email.trim()} onClick={async () => { await onSubmit({ email: email.trim(), role, moduleKeys }); reset(); }}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EditMemberDialog ─────────────────────────────────────────────────────────
function EditMemberDialog({
  member, busy, currentUserId, canTransferOwnership,
  onClose, onSave, onDeactivate, onTransferOwnership,
}: {
  member: OrganizationMember | null;
  busy: boolean;
  currentUserId?: string;
  canTransferOwnership: boolean;
  onClose: () => void;
  onSave: (input: { role: "admin" | "member"; isActive: boolean; moduleKeys: OrganizationModuleKey[]; newEmail?: string }) => Promise<void>;
  onDeactivate: () => Promise<void>;
  onTransferOwnership: () => Promise<void>;
}) {
  const [role, setRole]               = useState<"admin" | "member">("member");
  const [isActive, setIsActive]       = useState(true);
  const [moduleKeys, setModuleKeys]   = useState<OrganizationModuleKey[]>([]);
  const [newEmail, setNewEmail]       = useState("");
  const [showEmailField, setShowEmailField]         = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  // Senha
  type ResetMode = "idle" | "email" | "temp";
  const [resetMode, setResetMode]     = useState<ResetMode>("idle");
  const [tempPwd, setTempPwd]         = useState("");
  const [showTempPwd, setShowTempPwd] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const memberKey = member?.userId;
  useMemo(() => {
    if (!member) return;
    setRole(member.membershipRole === "admin" ? "admin" : "member");
    setIsActive(member.isActive);
    setModuleKeys(member.moduleKeys);
    setNewEmail("");
    setShowEmailField(false);
    setTransferConfirmOpen(false);
    setResetMode("idle");
    setTempPwd("");
    setShowTempPwd(false);
    setCopied(false);
    setSendingReset(false);
  }, [memberKey]);

  const isOwner    = member?.membershipRole === "owner";
  const isSelf     = member?.userId === currentUserId;
  const isInactive = member != null && !member.isActive;

  // ── Enviar link por e-mail ──────────────────────────────────────────────────
  const handleSendEmailReset = async () => {
    if (!member?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error("Não foi possível enviar o link. Tente novamente.");
    } else {
      toast.success(`Link de redefinição enviado para ${member.email}.`);
      setResetMode("idle");
    }
  };

  // ── Gerar senha temporária ──────────────────────────────────────────────────
  const handleGenerateTemp = useCallback(async () => {
    if (!member?.userId) return;
    setSendingReset(true);
    const pwd = generateTempPassword();

    // Atualiza senha via admin-user-management edge function
    const { error: fnError } = await supabase.functions.invoke("admin-user-management", {
      body: { action: "set_temp_password", userId: member.userId, password: pwd },
    });

    if (fnError) {
      // fallback: apenas exibe para o admin copiar e informar manualmente
      toast.warning("Senha gerada localmente. Copie e envie ao usuário manualmente.");
    } else {
      // Marca must_change_password = true no perfil
      await supabase.from("profiles").update({ must_change_password: true }).eq("user_id", member.userId);
    }

    setTempPwd(pwd);
    setShowTempPwd(true);
    setSendingReset(false);
  }, [member?.userId]);

  const handleCopyTempPwd = () => {
    void navigator.clipboard.writeText(tempPwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">

          {/* ── Cabeçalho ── */}
          <DialogHeader className="px-6 pb-4 pt-6">
            <div className="flex items-center gap-3">
              {/* Avatar iniciais */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {member?.displayName?.slice(0, 2).toUpperCase() ?? "??"}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold leading-tight">
                  {member?.displayName}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {member?.email}
                </DialogDescription>
              </div>
            </div>
            {/* Badges de status */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {isOwner && (
                <Badge className="gap-1 bg-amber-500/15 text-[10px] text-amber-700 border-amber-400/30">
                  <Crown className="h-3 w-3" /> Proprietário
                </Badge>
              )}
              {!isOwner && member?.membershipRole === "admin" && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <ShieldCheck className="h-3 w-3" /> Administrador
                </Badge>
              )}
              {isInactive && (
                <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-500">inativo</Badge>
              )}
              {member?.moduleKeys.map((k) => {
                const mod = MODULES.find((m) => m.key === k);
                return mod ? (
                  <Badge key={k} className={cn("text-[9px] gap-1 px-1.5 py-0", mod.badgeClass)}>
                    {mod.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </DialogHeader>

          <Separator />

          {/* ── Corpo rolável ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {member && (
              <div className="space-y-6">

                {/* PAPEL */}
                <div className="space-y-2">
                  <SectionLabel>Papel</SectionLabel>
                  {isOwner ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                      <Crown className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="font-medium">Proprietário da organização</span>
                      <Badge variant="secondary" className="ml-auto text-[10px]">read-only</Badge>
                    </div>
                  ) : (
                    <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Membro</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Separator />

                {/* MÓDULOS */}
                <div className="space-y-2">
                  <SectionLabel>Módulos</SectionLabel>
                  <ModuleSelector value={moduleKeys} onChange={setModuleKeys} disabled={isOwner} />
                </div>

                <Separator />

                {/* STATUS DE ACESSO */}
                <div className="space-y-2">
                  <SectionLabel>Status de acesso</SectionLabel>
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition-colors",
                      isOwner || isSelf ? "opacity-60" : isActive ? "border-primary/40 bg-primary/[.03]" : "border-border",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isOwner ? true : isActive}
                        disabled={isOwner || isSelf}
                        id="chk-active"
                        onCheckedChange={(c) => { if (!isOwner && !isSelf) setIsActive(Boolean(c)); }}
                      />
                      <label htmlFor="chk-active" className={cn("cursor-pointer text-sm", (isOwner || isSelf) && "cursor-not-allowed")}>
                        Acesso ativo
                      </label>
                    </div>
                    {isOwner && <span className="text-xs text-muted-foreground">Sempre ativo</span>}
                  </div>
                </div>

                {/* SEGURANÇA — reset de senha */}
                {!isOwner && !isSelf && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <SectionLabel>Segurança</SectionLabel>

                      {isInactive && (
                        <Alert variant="destructive" className="py-2 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <AlertDescription>
                            Membro <strong>inativo</strong>. Reative o acesso antes de redefinir a senha.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Seleção de modo */}
                      {resetMode === "idle" && (
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <p className="mb-2 text-xs font-medium">Redefinir senha</p>
                          <p className="mb-3 text-[11px] text-muted-foreground">
                            Escolha como deseja redefinir o acesso do membro.
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start gap-2 text-xs h-9"
                              disabled={Boolean(isInactive)}
                              onClick={() => setResetMode("email")}
                            >
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              Enviar link por e-mail
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start gap-2 text-xs h-9"
                              disabled={Boolean(isInactive)}
                              onClick={() => setResetMode("temp")}
                            >
                              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                              Gerar senha temporária
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Modo: link por e-mail */}
                      {resetMode === "email" && (
                        <div className="space-y-2 rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">Enviar link por e-mail</p>
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground" onClick={() => setResetMode("idle")}>Cancelar</Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Um link de redefinição será enviado para <strong>{member.email}</strong>.
                            O usuário precisará clicar no link para criar uma nova senha.
                          </p>
                          <Button
                            size="sm"
                            className="w-full gap-2 text-xs h-9"
                            disabled={sendingReset}
                            onClick={handleSendEmailReset}
                          >
                            {sendingReset
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Mail className="h-3.5 w-3.5" />}
                            {sendingReset ? "Enviando..." : "Confirmar envio"}
                          </Button>
                        </div>
                      )}

                      {/* Modo: senha temporária */}
                      {resetMode === "temp" && (
                        <div className="space-y-3 rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">Senha temporária</p>
                            <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground" onClick={() => { setResetMode("idle"); setTempPwd(""); }}>Cancelar</Button>
                          </div>

                          {!tempPwd ? (
                            <>
                              <p className="text-[11px] text-muted-foreground">
                                Uma senha forte será gerada. O usuário deverá trocá-la no próximo login.
                              </p>
                              <Button
                                size="sm"
                                className="w-full gap-2 text-xs h-9"
                                disabled={sendingReset}
                                onClick={handleGenerateTemp}
                              >
                                {sendingReset
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <KeyRound className="h-3.5 w-3.5" />}
                                {sendingReset ? "Gerando..." : "Gerar senha"}
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300">
                                ⚠️ Copie agora — esta senha não será exibida novamente.
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <Input
                                    readOnly
                                    type={showTempPwd ? "text" : "password"}
                                    value={tempPwd}
                                    className="h-9 pr-9 font-mono text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowTempPwd((p) => !p)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  >
                                    {showTempPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 shrink-0"
                                  onClick={handleCopyTempPwd}
                                >
                                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                O usuário será obrigado a trocar a senha no próximo login.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* MIGRAÇÃO DE E-MAIL */}
                {!isOwner && !isSelf && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <SectionLabel>Migração de e-mail</SectionLabel>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px]"
                          onClick={() => setShowEmailField((p) => !p)}
                        >
                          {showEmailField ? "Cancelar" : "Alterar e-mail"}
                        </Button>
                      </div>
                      {showEmailField && (
                        <div className="space-y-2">
                          <Input
                            type="email"
                            placeholder="novo@email.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="h-9 text-sm"
                            autoComplete="email"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Confirmação enviada para o e-mail antigo e o novo. Sessões existentes serão invalidadas.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

              </div>
            )}
          </div>

          <Separator />

          {/* ── Rodapé ── */}
          <DialogFooter className="flex-row items-center justify-between gap-2 px-6 py-4">
            {/* Ações destrutivas */}
            <div className="flex gap-2">
              {member && !isOwner && !isSelf && member.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-destructive text-destructive hover:bg-destructive/10 text-xs gap-1.5"
                  disabled={busy}
                  onClick={onDeactivate}
                >
                  <UserMinus className="h-3.5 w-3.5" /> Desativar
                </Button>
              )}
              {member && !isOwner && canTransferOwnership && member.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={busy}
                  onClick={() => setTransferConfirmOpen(true)}
                >
                  <Crown className="h-3.5 w-3.5" /> Tornar proprietário
                </Button>
              )}
            </div>
            {/* Ações positivas */}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>Cancelar</Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={busy || isOwner}
                onClick={() =>
                  onSave({
                    role, isActive, moduleKeys,
                    newEmail: showEmailField && newEmail.trim() ? newEmail.trim() : undefined,
                  })
                }
              >
                {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransferOwnershipConfirmDialog
        open={transferConfirmOpen}
        memberName={member?.displayName ?? ""}
        busy={busy}
        onConfirm={async () => { setTransferConfirmOpen(false); await onTransferOwnership(); }}
        onCancel={() => setTransferConfirmOpen(false)}
      />
    </>
  );
}

// ─── OrganizationMembersPage ───────────────────────────────────────────────────
export default function OrganizationMembersPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const {
    organization, members, invitations, loading, mutating, error,
    refresh, inviteMember, resendInvitation, revokeInvitation,
    updateMember, deactivateMember, transferOwnership,
  } = useOrganizationMembers();

  const [inviteOpen, setInviteOpen]       = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);

  const currentMembership  = useMemo(() => members.find((m) => m.userId === user?.id), [members, user?.id]);
  const canTransferOwnership = organization?.isPlatformAdmin === true || currentMembership?.membershipRole === "owner";
  const pendingInvitations   = invitations.filter((inv) => inv.invitationStatus === "pending");

  const handleInvite = async (input: { email: string; role: "admin" | "member"; moduleKeys: OrganizationModuleKey[] }) => {
    try {
      await inviteMember(input);
      toast.success("Convite enviado com sucesso.");
      setInviteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar convite.");
    }
  };

  const handleInvitationAction = async (invitation: OrganizationInvitation, action: "resend" | "revoke") => {
    try {
      if (action === "resend") {
        await resendInvitation(invitation.invitationId);
        toast.success("Convite reenviado.");
      } else {
        await revokeInvitation(invitation.invitationId);
        toast.success("Convite revogado.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o convite.");
    }
  };

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Alert className="max-w-xl">
          <AlertDescription>Selecione uma organização para gerenciar seus membros.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
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
              <p className="truncate text-sm text-muted-foreground">{organization.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <MailPlus className="mr-2 h-4 w-4" /> Convidar
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {/* KPI cards */}
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
                <p className="text-2xl font-semibold">{members.filter((m) => m.isActive).length}</p>
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

        {/* Tabs */}
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Membros</TabsTrigger>
            <TabsTrigger value="invitations">
              Convites
              {pendingInvitations.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pendingInvitations.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab Membros */}
          <TabsContent value="members">
            <Card>
              <CardHeader><CardTitle className="text-base">Acessos da organização</CardTitle></CardHeader>
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
                            <p className="font-medium">{member.displayName}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "gap-1 text-[10px]",
                                member.membershipRole === "owner"
                                  ? "bg-amber-500/15 text-amber-700 border-amber-400/30"
                                  : "",
                              )}
                              variant={member.membershipRole === "owner" ? "outline" : "secondary"}
                            >
                              {member.membershipRole === "owner" && <Crown className="h-3 w-3" />}
                              {member.membershipRole === "admin" && <ShieldCheck className="h-3 w-3" />}
                              {ROLE_LABELS[member.membershipRole]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {member.moduleKeys.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                member.moduleKeys.map((k) => {
                                  const mod = MODULES.find((m) => m.key === k);
                                  return mod ? (
                                    <Badge key={k} className={cn("text-[9px] gap-1 px-1.5 py-0", mod.badgeClass)}>
                                      {mod.label}
                                    </Badge>
                                  ) : null;
                                })
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.isActive ? "secondary" : "destructive"} className="text-[10px]">
                              {member.isActive ? "Ativo" : "Desativado"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                  Gerenciar acesso
                                </DropdownMenuItem>
                                {member.userId !== user?.id && member.membershipRole !== "owner" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() =>
                                        void deactivateMember(member.userId)
                                          .then(() => toast.success("Membro desativado."))
                                          .catch((err) => toast.error(err instanceof Error ? err.message : "Falha ao desativar membro."))
                                      }
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

          {/* Tab Convites */}
          <TabsContent value="invitations">
            <Card>
              <CardHeader><CardTitle className="text-base">Histórico de convites</CardTitle></CardHeader>
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
                          <span className="text-sm text-muted-foreground">Nenhum convite criado.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((invitation) => (
                        <TableRow key={invitation.invitationId}>
                          <TableCell>
                            <p className="font-medium">{invitation.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Enviado por {invitation.invitedByName} · tentativa {invitation.sendCount}
                            </p>
                          </TableCell>
                          <TableCell>{ROLE_LABELS[invitation.invitationRole]}</TableCell>
                          <TableCell>
                            <Badge
                              variant={invitation.invitationStatus === "pending" ? "secondary" : invitation.invitationStatus === "accepted" ? "default" : "outline"}
                              className="text-[10px]"
                            >
                              {INVITATION_STATUS_LABELS[invitation.invitationStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(invitation.expiresAt)}</TableCell>
                          <TableCell>
                            {invitation.invitationStatus !== "accepted" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => void handleInvitationAction(invitation, "resend")}>Reenviar convite</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => void handleInvitationAction(invitation, "revoke")}>Revogar convite</DropdownMenuItem>
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

      <InviteMemberDialog open={inviteOpen} busy={mutating} onOpenChange={setInviteOpen} onSubmit={handleInvite} />

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
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o membro.");
          }
        }}
        onDeactivate={async () => {
          if (!editingMember) return;
          try {
            await deactivateMember(editingMember.userId);
            toast.success("Membro desativado.");
            setEditingMember(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível desativar o membro.");
          }
        }}
        onTransferOwnership={async () => {
          if (!editingMember) return;
          try {
            await transferOwnership(editingMember.userId);
            toast.success("Propriedade transferida.");
            setEditingMember(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível transferir a propriedade.");
          }
        }}
      />
    </div>
  );
}
