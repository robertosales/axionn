import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { UserAdmin } from "../hooks/useUsersAdmin";
import type { TeamAdmin } from "../hooks/useTeamsAdmin";

interface EditValues  { display_name: string; module_access: string; team_id: string; }
interface CreateValues extends EditValues { email: string; password: string; }

interface Props {
  open: boolean;
  user?: UserAdmin | null;
  teams: TeamAdmin[];
  onClose: () => void;
  onCreate: (data: CreateValues) => Promise<boolean>;
  onUpdate: (userId: string, data: EditValues) => Promise<boolean>;
}

export function UserFormDialog({ open, user, teams, onClose, onCreate, onUpdate }: Props) {
  const isEdit = !!user;
  const form = useForm<CreateValues>({
    defaultValues: { display_name: "", email: "", password: "", module_access: "sala_agil", team_id: "none" },
  });

  useEffect(() => {
    if (open) {
      form.reset(isEdit
        ? { display_name: user!.display_name, email: user!.email, password: "", module_access: user!.module_access, team_id: user!.team_id ?? "none" }
        : { display_name: "", email: "", password: "", module_access: "sala_agil", team_id: "none" }
      );
    }
  }, [open, user]);

  const onSubmit = async (values: CreateValues) => {
    const teamId = values.team_id === "none" ? null : values.team_id;
    let ok: boolean;
    if (isEdit) {
      ok = await onUpdate(user!.user_id, { display_name: values.display_name, module_access: values.module_access, team_id: teamId });
    } else {
      ok = await onCreate({ ...values, team_id: teamId });
    }
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="display_name" rules={{ required: "Nome obrigatório" }}
              render={({ field }) => (
                <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="João Silva" {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            {!isEdit && (
              <>
                <FormField control={form.control} name="email" rules={{ required: "E-mail obrigatório" }}
                  render={({ field }) => (
                    <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" placeholder="joao@empresa.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )}
                />
                <FormField control={form.control} name="password" rules={{ required: "Senha obrigatória", minLength: { value: 6, message: "Mínimo 6 caracteres" } }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha temporária</FormLabel>
                      <FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl>
                      <FormDescription className="text-[11px]">O usuário será obrigado a trocar no primeiro acesso.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField control={form.control} name="module_access"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Módulo de acesso</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="sala_agil">⚡ Sala Ágil</SelectItem>
                      <SelectItem value="sustentacao">🛡 Sustentação</SelectItem>
                      <SelectItem value="admin">Ambos os módulos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="team_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time principal</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione um time" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem time</SelectItem>
                      {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
