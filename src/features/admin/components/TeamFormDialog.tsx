import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanies } from "../hooks/useCompanies";
import type { TeamAdmin, TeamFormValues } from "../hooks/useTeamsAdmin";

const NO_COMPANY = "__none__";

interface Props {
  open: boolean;
  team?: TeamAdmin | null;
  onClose: () => void;
  onSave: (data: TeamFormValues) => Promise<boolean>;
}

export function TeamFormDialog({ open, team, onClose, onSave }: Props) {
  const { companies, loading: loadingCompanies } = useCompanies();

  const form = useForm<TeamFormValues>({
    defaultValues: { name: "", module: "sala_agil", company_id: null },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        team
          ? { name: team.name, module: team.module, company_id: team.company_id ?? null }
          : { name: "", module: "sala_agil", company_id: null }
      );
    }
  }, [open, team]);

  const onSubmit = async (values: TeamFormValues) => {
    const ok = await onSave(values);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{team ? "Editar Time" : "Novo Time"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Nome obrigatório" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do time</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: TIME NEXO-A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Módulo */}
            <FormField
              control={form.control}
              name="module"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Módulo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sala_agil">Sala Ágil</SelectItem>
                      <SelectItem value="sustentacao">Sustentação</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Empresa */}
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa cliente <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  {loadingCompanies ? (
                    <Skeleton className="h-9 w-full rounded-md" />
                  ) : (
                    <Select
                      value={field.value ?? NO_COMPANY}
                      onValueChange={v => field.onChange(v === NO_COMPANY ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Sem empresa" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_COMPANY}>— Sem empresa —</SelectItem>
                        {companies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
