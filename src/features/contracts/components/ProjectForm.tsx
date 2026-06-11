/**
 * ProjectForm — Cadastro de projeto GLOBAL (sem vínculo a contrato).
 * O vínculo contrato ↔ time ↔ projeto é feito na tela de gestão do contrato
 * via ProjectTeamsPanel (seleção em cascata).
 */
import { useState } from 'react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { X, Loader2, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import type { Project, ProjectInput } from '../services/projects.service';

interface Props {
  initialData?: Project;
  onClose:   () => void;
  onSuccess: () => void;
  onSubmit:  (input: ProjectInput) => Promise<void>;
  /** @deprecated — não é mais necessário; mantido para compatibilidade */
  contractId?: string;
}

export function ProjectForm({ initialData, onClose, onSuccess, onSubmit }: Props) {
  const isEdit = !!initialData;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProjectInput>({
    name:        initialData?.name        ?? '',
    code:        initialData?.code        ?? '',
    description: initialData?.description ?? '',
    module_type: initialData?.module_type ?? 'sustenance',
    redmine_id:  initialData?.redmine_id  ?? null,
  });

  const set = (field: keyof ProjectInput, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nome do projeto é obrigatório'); return; }
    setSaving(true);
    try {
      await onSubmit(form);
      toast.success(isEdit ? 'Projeto atualizado!' : 'Projeto criado com sucesso!');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar projeto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
                      w-full max-w-md bg-background border rounded-xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {isEdit ? 'Editar Projeto' : 'Novo Projeto'}
            </h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4">

            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ex: NEXO, GESP3, App Mobile"
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            {/* Código + Redmine */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Código</Label>
                <Input
                  value={form.code ?? ''}
                  onChange={e => set('code', e.target.value)}
                  placeholder="Ex: NEXO"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Redmine ID</Label>
                <Input
                  type="number"
                  value={form.redmine_id ?? ''}
                  onChange={e => set('redmine_id', e.target.value ? Number(e.target.value) : null)}
                  placeholder="ID numérico"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Tipo de módulo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de Módulo</Label>
              <Select value={form.module_type} onValueChange={v => set('module_type', v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sustenance">🛠 Sustentação</SelectItem>
                  <SelectItem value="agile">⚡ Ágil</SelectItem>
                  <SelectItem value="mixed">🔀 Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea
                value={form.description ?? ''}
                onChange={e => set('description', e.target.value)}
                rows={2}
                className="text-sm resize-none"
                placeholder="Descrição opcional do projeto"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-3 border-t bg-muted/20 rounded-b-xl">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="min-w-[80px]">
              {saving
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : isEdit ? 'Salvar' : 'Criar Projeto'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
