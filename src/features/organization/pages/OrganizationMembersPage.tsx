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
  BookOpen,
  Shield,
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
import { Switch } from "@/components/ui/switch";
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

// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens (escala 8px)
// Modal width: 560px | Botões footer: h-11 (44px) px-5
// gap-2=8px | gap-3=12px | gap-4=16px | gap-6=24px
// ─────────────────────────────────────────────────────────────────────────────

const MODULES: Array<{
  key: OrganizationModuleKey;
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
  iconClass: string;
}> = [
  {
    key: "sala_agil",
    label: "Sala Ágil",
    icon: <Zap className="h-3 w-3" />,
    badgeClass: "bg-violet-600/15 text-violet-700 border-violet-400/30 dark:text-violet-300",
    iconClass: "text-violet-500",
  },
  {
    key: "sustentacao",
    label: "Sustentação",
    icon: <Shield className="h-3 w-3" />,
    badgeClass: "bg-blue-600/15 text-blue-700 border-blue-400/30 dark:text-blue-300",
    iconClass: "text-blue-500",
  },
  {
    key: "rdm",
    label: "RDM",
    icon: <BookOpen className="h-3 w-3" />,
    badgeClass: "bg-purple-600/15 text-purple-700 border-purple-400/30 dark:text-purple-300",
    iconClass: "text-purple-500",
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

function generateTempPassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const syms   = "@#!$";
  const pool   = upper + lower + digits + syms;
  const pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    syms[Math.floor(Math.random() * syms.length)],
  ];
  for (let i = 4; i < 12; i++) pwd.push(pool[Math.floor(Math.random() * pool.length)]);
  return pwd.sort(() => Math.random() - 0.5).join("");
}

// ─── Componentes base ─────────────────────────────────────────────────────────

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

// ─── ModuleSelector ───────────────────────────────────────────────────────────
function ModuleSelector({
  value, onChange, disabled,
}: {
  value: OrganizationModuleKey[];
  onChange: (v: OrganizationModuleKey[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {MODULES.map((mod) => {
        const enabled = value.includes(mod.key);
        return (
          <div
            key={mod.key}
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
              disabled
                ? "cursor-not-allowed opacity-50 bg-muted/20"
                : enabled
                  ? "border-primary/30 bg-primary/[.03]"
                  : "border-border bg-transparent hover:bg-muted/30",
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", mod.badgeClass)}>
                {mod.icon}
              </span>
              <span className="text-sm font-medium">{mod.label}</span>
            </div>
            <Switch
              checked={enabled}
              disabled={disabled}
              onCheckedChange={(next) => {
                if (disabled) return;
                onChange(next ? [...value, mod.key] : value.filter((k) => k !== mod.key));
              }}
              className="scale-90"
            />
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
          <Button variant="outline" className="h-11 px-5" onClick={onCancel} disabled={busy}>Cancelar</Button>
          <Button variant="destructive" className="h-11 px-5" onClick={onConfirm} disabled={busy}>
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
          <DialogDescription>O usuário receberá um link de autenticação e entrada na organização.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" autoComplete="email" className="h-10" />
          </div>
          <div className="space-y-2">
            <FieldLabel>Papel na organização</FieldLabel>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel>Módulos iniciais</FieldLabel>
            <ModuleSelector value={moduleKeys} onChange={setModuleKeys} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11 px-5" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="h-11 px-5" disabled={busy || !email.trim()} onClick={async () => { await onSubmit({ email: email.trim(), role, moduleKeys }); reset(); }}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar convite
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
  const [showEmailField, setShowEmailField] = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

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
    setNewEmail(""); setShowEmailField(false); setTransferConfirmOpen(false);
    setResetMode("idle"); setTempPwd(""); setShowTempPwd(false); setCopied(false); setSendingReset(false);
  }, [memberKey]);

  const isOwner    = member?.membershipRole === "owner";
  const isSelf     = member?.userId === currentUserId;
  const isInactive = member != null && !member.isActive;

  const handleSendEmailReset = async () => {
    if (!member?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) { toast.error("Não foi possível enviar o link. Tente novamente."); }
    else { toast.success(`Link de redefinição enviado para ${member.email}.`); setResetMode("idle"); }
  };

  const handleGenerateTemp = useCallback(async () => {
    if (!member?.userId) return;
    setSendingReset(true);
    const pwd = generateTempPassword();
    const { error: fnError } = await supabase.functions.invoke("admin-user-management", {
      body: { action: "set_temp_password", userId: member.userId, password: pwd },
    });
    if (fnError) { toast.warning("Senha gerada localmente. Copie e envie ao usuário manualmente."); }
    else { await supabase.from("profiles").update({ must_change_password: true }).eq("user_id", member.userId); }
    setTempPwd(pwd); setShowTempPwd(true); setSendingReset(false);
  }, [member?.userId]);

  const handleCopyTempPwd = () => {
    void navigator.clipboard.writeText(tempPwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = member?.displayName
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") ?? "??";

  return (
    <>
      <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
        {/*
          ✦ Modal: 560px (era 480px) — mais respiração para o footer com 4 botões
          ✦ Botões footer: h-11 px-5 text-sm font-medium (era h-10)
        */}
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">

          {/* HEADER */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary ring-2 ring-primary/20">
                {initials}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-base font-semibold leading-tight text-foreground">
                  {member?.displayName}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{member?.email}</p>
              </div>
            </div>
            <div className="mt-4">
              <SectionDivider>Dados do membro</SectionDivider>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {isOwner && (
                <Badge className="h-6 gap-1.5 rounded-full border-amber-400/40 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  <Crown className="h-3 w-3" /> Proprietário
                </Badge>
              )}
              {!isOwner && member?.membershipRole === "admin" && (
                <Badge className="h-6 gap-1.5 rounded-full border-emerald-400/40 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> Administrador
                </Badge>
              )}
              {!isOwner && member?.membershipRole === "member" && (
                <Badge variant="secondary" className="h-6 gap-1.5 rounded-full px-3 text-[11px] font-semibold">
                  Membro
                </Badge>
              )}
              {isInactive && (
                <Badge variant="outline" className="h-6 rounded-full border-rose-400/60 px-3 text-[11px] font-semibold text-rose-500">
                  Inativo
                </Badge>
              )}
              {member?.moduleKeys.map((k) => {
                const mod = MODULES.find((m) => m.key === k);
                return mod ? (
                  <Badge key={k} className={cn("h-6 gap-1.5 rounded-full border px-3 text-[11px] font-semibold", mod.badgeClass)}>
                    {mod.icon} {mod.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          <Separator />

          {/* BODY */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {member && (
              <div className="space-y-6">

                {/* SEÇÃO 1: PAPEL E FUNÇÃO */}
                <div className="space-y-3">
                  <SectionDivider>Papel e função</SectionDivider>
                  {isOwner ? (
                    <div className="flex h-10 items-center gap-3 rounded-lg border bg-muted/30 px-4">
                      <Crown className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="flex-1 text-sm font-medium">Proprietário da organização</span>
                      <Badge variant="secondary" className="text-[10px]">read-only</Badge>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FieldLabel htmlFor="select-role">Papel na organização</FieldLabel>
                      <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                        <SelectTrigger id="select-role" className="h-10 w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* SEÇÃO 2: MÓDULOS PERMITIDOS */}
                <div className="space-y-3">
                  <SectionDivider>Módulos permitidos</SectionDivider>
                  {!isOwner && (
                    <p className="text-[11px] text-muted-foreground">
                      {moduleKeys.length === 0
                        ? "Nenhum módulo selecionado."
                        : `${moduleKeys.length} de ${MODULES.length} módulo${moduleKeys.length !== 1 ? "s" : ""} selecionado${moduleKeys.length !== 1 ? "s" : ""}.`}
                    </p>
                  )}
                  <ModuleSelector value={moduleKeys} onChange={setModuleKeys} disabled={isOwner} />
                </div>

                {/* SEÇÃO 3: STATUS DA CONTA */}
                <div className="space-y-3">
                  <SectionDivider>Status da conta</SectionDivider>
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                      isOwner || isSelf
                        ? "cursor-not-allowed bg-muted/20 opacity-60"
                        : isActive
                          ? "border-emerald-400/30 bg-emerald-500/[.03]"
                          : "border-border",
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {isOwner ? "Acesso permanente" : isActive ? "Acesso ativo" : "Acesso desativado"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {isOwner
                          ? "Proprietários têm acesso permanente à organização."
                          : isActive
                            ? "Este membro pode acessar todos os módulos liberados."
                            : "Membro bloqueado. Ative para restaurar o acesso."}
                      </p>
                    </div>
                    <Switch
                      checked={isOwner ? true : isActive}
                      disabled={isOwner || isSelf}
                      onCheckedChange={(c) => { if (!isOwner && !isSelf) setIsActive(c); }}
                      className="ml-4 shrink-0"
                    />
                  </div>
                </div>

                {/* SEÇÃO 4: SEGURANÇA */}
                {!isOwner && !isSelf && (
                  <div className="space-y-3">
                    <SectionDivider>Segurança</SectionDivider>

                    {isInactive && (
                      <Alert variant="destructive" className="py-2.5">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Membro <strong>inativo</strong>. Reative o acesso antes de redefinir a senha.
                        </AlertDescription>
                      </Alert>
                    )}

                    {resetMode === "idle" && (
                      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                        <div>
                          <p className="text-sm font-medium">Redefinir senha</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Escolha como deseja redefinir o acesso do membro.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            className="h-10 w-full justify-start gap-3 text-sm"
                            disabled={Boolean(isInactive)}
                            onClick={() => setResetMode("email")}
                          >
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Enviar link por e-mail
                          </Button>
                          <Button
                            variant="outline"
                            className="h-10 w-full justify-start gap-3 text-sm"
                            disabled={Boolean(isInactive)}
                            onClick={() => setResetMode("temp")}
                          >
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                            Gerar senha temporária
                          </Button>
                        </div>
                      </div>
                    )}

                    {resetMode === "email" && (
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Enviar link por e-mail</p>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setResetMode("idle")}>Cancelar</Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Um link de redefinição será enviado para{" "}
                          <strong className="text-foreground">{member.email}</strong>.
                          O usuário precisará clicar no link para criar uma nova senha.
                        </p>
                        <Button
                          className="h-10 w-full gap-2"
                          disabled={sendingReset}
                          onClick={handleSendEmailReset}
                        >
                          {sendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          {sendingReset ? "Enviando..." : "Confirmar envio"}
                        </Button>
                      </div>
                    )}

                    {resetMode === "temp" && (
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Senha temporária</p>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => { setResetMode("idle"); setTempPwd(""); }}>Cancelar</Button>
                        </div>
                        {!tempPwd ? (
                          <>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Uma senha forte será gerada e o membro será obrigado a trocá-la no próximo login.
                            </p>
                            <Button
                              className="h-10 w-full gap-2"
                              disabled={sendingReset}
                              onClick={handleGenerateTemp}
                            >
                              {sendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                              {sendingReset ? "Gerando..." : "Gerar senha"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              Copie agora — esta senha não será exibida novamente.
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Input
                                  readOnly
                                  type={showTempPwd ? "text" : "password"}
                                  value={tempPwd}
                                  className="h-10 pr-10 font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowTempPwd((p) => !p)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  {showTempPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              <Button
                                variant="outline"
                                className="h-10 w-10 shrink-0 p-0"
                                onClick={handleCopyTempPwd}
                              >
                                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              O usuário será obrigado a trocar a senha no próximo login (flag <code>must_change_password</code> ativada).
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SEÇÃO 5: MIGRAÇÃO DE E-MAIL */}
                {!isOwner && !isSelf && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <SectionDivider>Migração de e-mail</SectionDivider>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => setShowEmailField((p) => !p)}
                      >
                        {showEmailField ? "Cancelar" : "Alterar e-mail"}
                      </Button>
                    </div>
                    {showEmailField && (
                      <div className="space-y-2">
                        <FieldLabel htmlFor="new-email">Novo e-mail</FieldLabel>
                        <Input
                          id="new-email"
                          type="email"
                          placeholder="novo@email.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="h-10"
                          autoComplete="email"
                        />
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Confirmação enviada para o e-mail antigo e o novo. Sessões existentes serão invalidadas.
                        </p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          <Separator />

          {/* ══════════════════════════════════════════════════════
              FOOTER
              ✦ Botões: h-11 (44px) + px-5 + text-sm font-medium
              ✦ Padding container: px-6 py-4
              ✦ Esquerda: ações destrutivas | Direita: Cancelar + Salvar
          ══════════════════════════════════════════════════════ */}
          <DialogFooter className="flex-row items-center justify-between gap-3 px-6 py-4">

            {/* Zona esquerda — destrutivo/crítico */}
            <div className="flex items-center gap-2">
              {member && !isOwner && !isSelf && member.isActive && (
                <Button
                  variant="outline"
                  className="h-11 gap-2 px-5 text-sm font-medium border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  disabled={busy}
                  onClick={onDeactivate}
                >
                  <UserMinus className="h-4 w-4" />
                  Desativar acesso
                </Button>
              )}
              {member && !isOwner && canTransferOwnership && member.isActive && (
                <Button
                  variant="outline"
                  className="h-11 gap-2 px-5 text-sm font-medium"
                  disabled={busy}
                  onClick={() => setTransferConfirmOpen(true)}
                >
                  <Crown className="h-4 w-4" />
                  Tornar proprietário
                </Button>
              )}
            </div>

            {/* Zona direita — fluxo */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="h-11 px-5 text-sm font-medium"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                className="h-11 gap-2 px-5 text-sm font-medium"
                disabled={busy || isOwner}
                onClick={() =>
                  onSave({
                    role, isActive, moduleKeys,
                    newEmail: showEmailField && newEmail.trim() ? newEmail.trim() : undefined,
                  })
                }
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                <Check className="h-4 w-4" />
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
      if (action === "resend") { await resendInvitation(invitation.invitationId); toast.success("Convite reenviado."); }
      else { await revokeInvitation(invitation.invitationId); toast.success("Convite revogado."); }
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
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
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

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Membros cadastrados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.filter((m) => m.isActive).length}</p>
                <p className="text-xs text-muted-foreground">Acessos ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <MailPlus className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingInvitations.length}</p>
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
                <Badge variant="secondary" className="ml-2">{pendingInvitations.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

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
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                {member.displayName?.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{member.displayName}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "gap-1.5 rounded-full text-[10px] font-semibold",
                                member.membershipRole === "owner"
                                  ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : member.membershipRole === "admin"
                                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "",
                              )}
                              variant={member.membershipRole === "member" ? "secondary" : "outline"}
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
                                    <Badge key={k} className={cn("gap-1 rounded-full text-[9px]", mod.badgeClass)}>
                                      {mod.icon} {mod.label}
                                    </Badge>
                                  ) : null;
                                })
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={member.isActive ? "secondary" : "destructive"}
                              className="rounded-full text-[10px]"
                            >
                              {member.isActive ? "Ativo" : "Desativado"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingMember(member)}>Gerenciar acesso</DropdownMenuItem>
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
                        <TableCell colSpan={5} className="py-12 text-center">
                          <span className="text-sm text-muted-foreground">Nenhum convite criado.</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((invitation) => (
                        <TableRow key={invitation.invitationId}>
                          <TableCell>
                            <p className="text-sm font-medium">{invitation.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Enviado por {invitation.invitedByName} · tentativa {invitation.sendCount}
                            </p>
                          </TableCell>
                          <TableCell><span className="text-sm">{ROLE_LABELS[invitation.invitationRole]}</span></TableCell>
                          <TableCell>
                            <Badge
                              variant={invitation.invitationStatus === "pending" ? "secondary" : invitation.invitationStatus === "accepted" ? "default" : "outline"}
                              className="rounded-full text-[10px]"
                            >
                              {INVITATION_STATUS_LABELS[invitation.invitationStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(invitation.expiresAt)}</TableCell>
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
          try { await updateMember({ userId: editingMember.userId, ...input }); toast.success("Acesso atualizado."); setEditingMember(null); }
          catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o membro."); }
        }}
        onDeactivate={async () => {
          if (!editingMember) return;
          try { await deactivateMember(editingMember.userId); toast.success("Membro desativado."); setEditingMember(null); }
          catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível desativar o membro."); }
        }}
        onTransferOwnership={async () => {
          if (!editingMember) return;
          try { await transferOwnership(editingMember.userId); toast.success("Propriedade transferida."); setEditingMember(null); }
          catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível transferir a propriedade."); }
        }}
      />
    </div>
  );
}
