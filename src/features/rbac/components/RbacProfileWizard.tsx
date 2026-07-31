import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RbacPermissionMatrix } from "@/features/rbac/components/RbacPermissionMatrix";
import {
  emptyRbacDraft,
  getRbacCategoryLabel,
  getRbacColor,
  getRbacIcon,
  RBAC_CATEGORIES,
  RBAC_COLORS,
  RBAC_ICONS,
  RBAC_MODULES,
} from "@/features/rbac/rbacCatalog";
import {
  RBAC_MODULE_KEYS,
  type RbacPermission,
  type RbacProfile,
  type RbacProfileDraft,
  type RbacWizardMode,
} from "@/features/rbac/types";

const profileSchema = z.object({
  profileKey: z.string().nullable(),
  displayName: z
    .string()
    .trim()
    .min(3, "Informe um nome com pelo menos 3 caracteres.")
    .max(80, "Use no máximo 80 caracteres."),
  description: z
    .string()
    .trim()
    .min(10, "Explique em pelo menos 10 caracteres quando este perfil deve ser usado.")
    .max(280, "Use no máximo 280 caracteres."),
  category: z.enum(["governance", "delivery", "quality", "support", "custom"]),
  colorToken: z.string().min(1),
  iconName: z.string().min(1),
  moduleKeys: z.array(z.enum(RBAC_MODULE_KEYS)).min(1, "Selecione pelo menos um módulo."),
  permissionKeys: z.array(z.string()).min(1, "Selecione pelo menos uma permissão."),
});

const STEPS = [
  { id: 1, label: "Identidade", description: "Nome e apresentação" },
  { id: 2, label: "Módulos", description: "Escopo do produto" },
  { id: 3, label: "Permissões", description: "Ações autorizadas" },
  { id: 4, label: "Revisão", description: "Impacto e confirmação" },
] as const;

interface RbacProfileWizardProps {
  open: boolean;
  mode: RbacWizardMode;
  profile: RbacProfile | null;
  permissions: RbacPermission[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: RbacProfileDraft) => Promise<string>;
}

function draftFromProfile(
  profile: RbacProfile | null,
  mode: RbacWizardMode,
): RbacProfileDraft {
  if (!profile) return emptyRbacDraft();
  return {
    profileKey: mode === "duplicate" ? null : profile.key,
    displayName:
      mode === "duplicate" ? `${profile.displayName} (cópia)` : profile.displayName,
    description: profile.description,
    category: profile.category,
    colorToken: profile.colorToken,
    iconName: profile.iconName,
    moduleKeys: [...profile.moduleKeys],
    permissionKeys: [...profile.permissionKeys],
  };
}

export function RbacProfileWizard({
  open,
  mode,
  profile,
  permissions,
  saving,
  onClose,
  onSave,
}: RbacProfileWizardProps) {
  const [step, setStep] = useState(1);
  const [confirmClose, setConfirmClose] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const readOnly = mode === "view";

  const form = useForm<RbacProfileDraft>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyRbacDraft(),
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(draftFromProfile(profile, mode));
    setStep(1);
    setSubmitError(null);
  }, [form, mode, open, profile]);

  const moduleKeys = form.watch("moduleKeys");
  const permissionKeys = form.watch("permissionKeys");
  const selectedPermissions = useMemo(
    () => permissions.filter((permission) => permissionKeys.includes(permission.key)),
    [permissionKeys, permissions],
  );
  const privilegedPermissions = useMemo(
    () => selectedPermissions.filter((permission) => permission.isPrivileged),
    [selectedPermissions],
  );
  const currentProfileHasPrivilege = Boolean(
    profile?.permissionKeys.some((key) => permissions.some(
      (permission) => permission.key === key && permission.isPrivileged,
    )),
  );
  const requiresApproval = privilegedPermissions.length > 0 || currentProfileHasPrivilege;
  const scopedPermissions = useMemo(
    () => permissions.filter((permission) => moduleKeys.includes(permission.moduleKey)),
    [moduleKeys, permissions],
  );

  async function goForward() {
    setSubmitError(null);
    if (readOnly) {
      setStep((current) => Math.min(4, current + 1));
      return;
    }

    if (step === 1) {
      const valid = await form.trigger([
        "displayName",
        "description",
        "category",
        "colorToken",
        "iconName",
      ]);
      if (!valid) return;
    }

    if (step === 2) {
      const valid = await form.trigger("moduleKeys");
      if (!valid) return;
      const allowedKeys = new Set(scopedPermissions.map((permission) => permission.key));
      form.setValue(
        "permissionKeys",
        permissionKeys.filter((permissionKey) => allowedKeys.has(permissionKey)),
        { shouldDirty: true },
      );
    }

    if (step === 3) {
      const valid = await form.trigger("permissionKeys");
      if (!valid) return;
    }

    setStep((current) => Math.min(4, current + 1));
  }

  function requestClose() {
    if (saving) return;
    if (!readOnly && form.formState.isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  async function submit(values: RbacProfileDraft) {
    setSubmitError(null);
    try {
      await onSave(values);
      onClose();
    } catch (error) {
      console.error("[RbacProfileWizard] save failed", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o perfil. Revise os dados e tente novamente.",
      );
    }
  }

  const title =
    mode === "create"
      ? "Novo perfil de acesso"
      : mode === "duplicate"
        ? "Duplicar perfil"
        : mode === "edit"
          ? "Editar perfil"
          : profile?.displayName ?? "Detalhes do perfil";

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && requestClose()}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(880px,calc(100dvh-3rem))] sm:w-[calc(100%-3rem)]">
          <DialogHeader className="shrink-0 border-b px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{title}</DialogTitle>
              {readOnly && <Badge variant="secondary">Somente leitura</Badge>}
            </div>
            <DialogDescription>
              {readOnly
                ? "Explore o escopo e as permissões deste perfil."
                : "Configure o acesso em etapas e revise o impacto antes de salvar."}
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 border-b bg-muted/20 px-5 py-4 sm:px-7">
            <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do perfil">
              {STEPS.map((item) => {
                const completed = item.id < step;
                const current = item.id === step;
                return (
                  <li key={item.id} className="min-w-0">
                    <button
                      type="button"
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors motion-reduce:transition-none",
                        current && "bg-primary/10 text-primary",
                        !current && "text-muted-foreground",
                        item.id <= step && "cursor-pointer",
                        item.id > step && "cursor-not-allowed opacity-60",
                      )}
                      disabled={item.id > step}
                      onClick={() => item.id <= step && setStep(item.id)}
                      aria-current={current ? "step" : undefined}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                          completed && "border-primary bg-primary text-primary-foreground",
                          current && "border-primary text-primary",
                        )}
                      >
                        {completed ? <Check className="h-3.5 w-3.5" /> : item.id}
                      </span>
                      <span className="hidden min-w-0 sm:block">
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {item.label}
                        </span>
                        <span className="hidden truncate text-[11px] font-normal text-muted-foreground lg:block">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Progress
              value={step * 25}
              className="mt-3 h-1.5"
              aria-label={`Etapa ${step} de 4`}
            />
          </div>

          <Form {...form}>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={form.handleSubmit(submit)}
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                {submitError && (
                  <Alert variant="destructive" role="alert" className="mb-5">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Não foi possível salvar</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                {step === 1 && (
                  <div className="mx-auto max-w-3xl space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">Identidade do perfil</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Use um nome reconhecível e descreva quando o perfil deve ser atribuído.
                      </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>
                              Nome do perfil <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                autoFocus
                                disabled={readOnly}
                                className="h-11 text-base"
                                placeholder="Ex.: Desenvolvedor Front-end"
                              />
                            </FormControl>
                            <FormDescription>
                              Este nome aparecerá nas atribuições e auditorias.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>
                              Descrição <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                disabled={readOnly}
                                className="min-h-24 resize-y text-base sm:text-sm"
                                placeholder="Explique responsabilidades, limites e público deste perfil."
                              />
                            </FormControl>
                            <div className="flex items-start justify-between gap-3">
                              <FormMessage />
                              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                {field.value.length}/280
                              </span>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoria</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={readOnly}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11" aria-label="Categoria do perfil">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {RBAC_CATEGORIES.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="colorToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cor de identificação</FormLabel>
                            <div className="flex min-h-11 flex-wrap items-center gap-2" role="radiogroup" aria-label="Cor do perfil">
                              {RBAC_COLORS.map((color) => (
                                <button
                                  key={color.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={field.value === color.value}
                                  aria-label={color.label}
                                  disabled={readOnly}
                                  onClick={() => field.onChange(color.value)}
                                  className={cn(
                                    "flex h-11 w-11 items-center justify-center rounded-full border-2 transition-transform motion-reduce:transition-none",
                                    field.value === color.value
                                      ? "border-foreground"
                                      : "border-transparent hover:scale-105",
                                  )}
                                >
                                  <span className={cn("h-6 w-6 rounded-full", color.swatchClass)} />
                                </button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="iconName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ícone</FormLabel>
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Ícone do perfil">
                            {RBAC_ICONS.map((entry) => {
                              const Icon = entry.icon;
                              const selected = field.value === entry.value;
                              return (
                                <button
                                  key={entry.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  disabled={readOnly}
                                  onClick={() => field.onChange(entry.value)}
                                  className={cn(
                                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs transition-colors motion-reduce:transition-none",
                                    selected
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "hover:bg-muted",
                                  )}
                                >
                                  <Icon className="h-5 w-5" aria-hidden="true" />
                                  <span className="truncate">{entry.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {step === 2 && (
                  <div className="mx-auto max-w-4xl space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">Módulos disponíveis</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Selecione onde este perfil poderá ser atribuído. As permissões serão filtradas por este escopo.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="moduleKeys"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid gap-4 md:grid-cols-3">
                            {RBAC_MODULES.map((module) => {
                              const Icon = module.icon;
                              const selected = field.value.includes(module.key);
                              return (
                                <button
                                  key={module.key}
                                  type="button"
                                  disabled={readOnly}
                                  aria-pressed={selected}
                                  onClick={() =>
                                    field.onChange(
                                      selected
                                        ? field.value.filter((key) => key !== module.key)
                                        : [...field.value, module.key],
                                    )
                                  }
                                  className={cn(
                                    "relative min-h-48 rounded-2xl border p-5 text-left transition-[border-color,background-color,transform] duration-200 motion-reduce:transition-none",
                                    selected
                                      ? "border-primary bg-primary/[0.06] ring-2 ring-primary/15"
                                      : "bg-card hover:-translate-y-0.5 hover:border-primary/30 motion-reduce:hover:translate-y-0",
                                  )}
                                >
                                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                  </span>
                                  <span className="mt-4 block text-base font-semibold">
                                    {module.label}
                                  </span>
                                  <span className="mt-2 block text-sm leading-5 text-muted-foreground">
                                    {module.description}
                                  </span>
                                  <span
                                    className={cn(
                                      "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border",
                                      selected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background",
                                    )}
                                  >
                                    {selected && <Check className="h-3.5 w-3.5" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage className="mt-3" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-lg font-semibold">Permissões do perfil</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Conceda apenas o necessário. Você pode pesquisar e selecionar grupos inteiros.
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="permissionKeys"
                      render={({ field }) => (
                        <FormItem>
                          <RbacPermissionMatrix
                            permissions={scopedPermissions}
                            selectedKeys={field.value}
                            onChange={(value) =>
                              form.setValue("permissionKeys", value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            readOnly={readOnly}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {step === 4 && (
                  <div className="mx-auto max-w-4xl space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">Revise antes de salvar</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Confirme o escopo e o impacto do perfil. Nenhum usuário será atribuído automaticamente.
                      </p>
                    </div>

                    <ProfilePreview
                      draft={form.getValues()}
                      permissionCount={selectedPermissions.length}
                      userCount={profile?.userCount ?? 0}
                    />

                    <div className="grid gap-4 sm:grid-cols-3">
                      <SummaryMetric
                        label="Módulos"
                        value={moduleKeys.length}
                        description={moduleKeys
                          .map((key) => RBAC_MODULES.find((module) => module.key === key)?.label)
                          .filter(Boolean)
                          .join(", ")}
                      />
                      <SummaryMetric
                        label="Permissões"
                        value={selectedPermissions.length}
                        description={`${new Set(selectedPermissions.map((permission) => permission.groupKey)).size} grupos funcionais`}
                      />
                      <SummaryMetric
                        label="Usuários impactados"
                        value={mode === "edit" ? profile?.userCount ?? 0 : 0}
                        description={
                          mode === "edit"
                            ? "Receberão a nova configuração"
                            : "O perfil ainda não foi atribuído"
                        }
                      />
                    </div>

                    {!readOnly && (profile?.userCount ?? 0) > 0 && mode === "edit" && (
                      <Alert>
                        <UsersRound className="h-4 w-4" />
                        <AlertTitle>Alteração com impacto</AlertTitle>
                        <AlertDescription>
                          {profile?.userCount} usuário(s) utilizam este perfil. As novas permissões serão aplicadas após o salvamento.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!readOnly && requiresApproval && (
                      <Alert className="border-amber-500/40 bg-amber-500/5" role="status">
                        <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertTitle>Revisão por outro administrador</AlertTitle>
                        <AlertDescription>
                          Este perfil {privilegedPermissions.length > 0
                            ? `inclui ${privilegedPermissions.length} permissão(ões) privilegiada(s)`
                            : "já possui permissões privilegiadas"}. Ao continuar, a alteração ficará pendente até ser aprovada por um segundo administrador.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="shrink-0 px-5 py-4 sm:px-7">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 sm:mr-auto"
                  onClick={requestClose}
                  disabled={saving}
                >
                  {readOnly ? "Fechar" : "Cancelar"}
                </Button>
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => setStep((current) => Math.max(1, current - 1))}
                    disabled={saving}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                )}
                {step < 4 ? (
                  <Button type="button" className="h-11" onClick={goForward}>
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : !readOnly ? (
                  <Button type="submit" className="h-11" disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {requiresApproval ? "Enviar para aprovação" : "Salvar perfil"}
                  </Button>
                ) : null}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As informações preenchidas neste perfil serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmClose(false);
                form.reset();
                onClose();
              }}
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function ProfilePreview({
  draft,
  permissionCount,
  userCount,
}: {
  draft: RbacProfileDraft;
  permissionCount: number;
  userCount: number;
}) {
  const color = getRbacColor(draft.colorToken);
  const Icon = getRbacIcon(draft.iconName);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border",
            color.surfaceClass,
          )}
        >
          <Icon className={cn("h-6 w-6", color.iconClass)} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{draft.displayName || "Novo perfil"}</h3>
            <Badge variant="outline">{getRbacCategoryLabel(draft.category)}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {draft.description || "Adicione uma descrição para orientar os administradores."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {draft.moduleKeys.map((moduleKey) => (
              <Badge key={moduleKey} variant="secondary">
                {RBAC_MODULES.find((module) => module.key === moduleKey)?.label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-48 sm:grid-cols-1">
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Permissões
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums">{permissionCount}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UsersRound className="h-4 w-4" /> Usuários
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums">{userCount}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        Pronto para revisão administrativa
      </div>
    </div>
  );
}
