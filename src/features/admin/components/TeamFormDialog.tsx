import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { TeamAdmin } from "../hooks/useTeamsAdmin";

interface FormValues { name: string; module: string; }

interface Props {
  open: boolean;
  team?: TeamAdmin | null;
  onClose: () => void;
  onSave: (data: FormValues) => Promise<boolean>;
}

export function TeamFormDialog({ open, team, onClose, onSave }: Props) {
  const form = useForm<FormValues>({ defaultValues: { name: "", module: "sala_agil" } });

  useEffect(() => {
    if (open) form.reset(team ? { name: team.name, module: team.module } : { name: "", module: "sala_agil" });
  }, [open, team]);

  const onSubmit = async (values: FormValues) => {
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
            <FormField control={form.control} name="name" rules={{ required: "Nome obrigatório" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do time</FormLabel>
                  <FormControl><Input placeholder="Ex: TIME NEXO-A" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="module"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Módulo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="sala_agil">Sala Ágil</SelectItem>
                      <SelectItem value="sustentacao">Sustentação</SelectItem>
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
