import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem,
  FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button }   from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label }  from "@/components/ui/label";
import {
  RDM_TIPO_MUDANCA, RDM_TIPO_LABELS,
  RDM_RISCO,        RDM_RISCO_LABELS,
  RDM_AMBIENTE,     RDM_AMBIENTE_LABELS,
} from "../types/rdm";
import type { Rdm, RdmInsert } from "../types/rdm";

const schema = z.object({
  nome:                    z.string().min(3, "Mínimo 3 caracteres"),
  objetivo:               z.string().min(10, "Descreva o objetivo (mín. 10 caracteres)"),
  sistema_modulo:         z.string().min(2, "Informe o sistema/módulo"),
  tipo_mudanca:           z.enum(RDM_TIPO_MUDANCA),
  risco:                  z.enum(RDM_RISCO),
  ambiente:               z.enum(RDM_AMBIENTE),
  data_implantacao:       z.string().min(1, "Informe a data"),
  hora_inicio:            z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  hora_fim_prevista:      z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  downtime_previsto:      z.boolean().default(false),
  rollback_previsto:      z.boolean().default(true),
  tempo_rollback_minutos: z.coerce.number().nullable().optional(),
  observacoes:            z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open:     boolean;
  onClose:  () => void;
  onSubmit: (values: Omit<RdmInsert, "id" | "codigo" | "updated_at" | "team_id" | "criado_por">) => Promise<void>;
  loading?: boolean;
  rdm?:     Rdm;   // se informado, modo edição
}

export function RdmForm({ open, onClose, onSubmit, loading, rdm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!rdm;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome:                    "",
      objetivo:               "",
      sistema_modulo:         "",
      tipo_mudanca:           "evolutiva",
      risco:                  "baixo",
      ambiente:               "producao",
      data_implantacao:       "",
      hora_inicio:            "22:00",
      hora_fim_prevista:      "23:00",
      downtime_previsto:      false,
      rollback_previsto:      true,
      tempo_rollback_minutos: null,
      observacoes:            "",
    },
  });

  // Popula o form ao abrir em modo edição
  useEffect(() => {
    if (open && rdm) {
      form.reset({
        nome:                    rdm.nome,
        objetivo:               rdm.objetivo,
        sistema_modulo:         rdm.sistema_modulo,
        tipo_mudanca:           rdm.tipo_mudanca as any,
        risco:                  rdm.risco as any,
        ambiente:               rdm.ambiente as any,
        data_implantacao:       rdm.data_implantacao ?? "",
        hora_inicio:            (rdm.hora_inicio ?? "22:00").slice(0, 5),
        hora_fim_prevista:      (rdm.hora_fim_prevista ?? "23:00").slice(0, 5),
        downtime_previsto:      rdm.downtime_previsto ?? false,
        rollback_previsto:      rdm.rollback_previsto ?? true,
        tempo_rollback_minutos: rdm.tempo_rollback_minutos ?? null,
        observacoes:            rdm.observacoes ?? "",
      });
    }
    if (open && !rdm) {
      form.reset();
    }
  }, [open, rdm]); // eslint-disable-line

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        tempo_rollback_minutos: values.tempo_rollback_minutos ?? null,
        observacoes:            values.observacoes || null,
        ...(isEdit ? {} : { status: "rascunho" }),
      } as any);
      if (!isEdit) form.reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar RDM — ${rdm?.codigo ?? ""}` : "Nova Requisição de Mudança (RDM)"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">

            <FormField control={form.control} name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Mudança *</FormLabel>
                  <FormControl><Input placeholder="Ex.: Deploy v2.5.1 — módulo financeiro" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="objetivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o objetivo e escopo da mudança…" className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="sistema_modulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sistema / Módulo *</FormLabel>
                  <FormControl><Input placeholder="Ex.: Portal Financeiro — Fechamento" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField control={form.control} name="tipo_mudanca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Mudança *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {RDM_TIPO_MUDANCA.map((t) => (
                          <SelectItem key={t} value={t}>{RDM_TIPO_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="risco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risco *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {RDM_RISCO.map((r) => (
                          <SelectItem key={r} value={r}>{RDM_RISCO_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="ambiente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {RDM_AMBIENTE.map((a) => (
                          <SelectItem key={a} value={a}>{RDM_AMBIENTE_LABELS[a]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField control={form.control} name="data_implantacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Implantação *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="hora_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora Início *</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="hora_fim_prevista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora Fim Prevista *</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="downtime_previsto"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-border p-3">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <Label className="cursor-pointer">Downtime Previsto</Label>
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="rollback_previsto"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-border p-3">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <Label className="cursor-pointer">Plano de Rollback</Label>
                  </FormItem>
                )}
              />
            </div>

            <FormField control={form.control} name="tempo_rollback_minutos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo de Rollback (minutos)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} placeholder="Ex.: 30"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Informações adicionais, dependências, riscos específicos…"
                      className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting || loading}>
                {submitting ? (isEdit ? "Salvando…" : "Criando…") : (isEdit ? "Salvar alterações" : "Criar RDM")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
