import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Project, ProjectInput } from '../services/projects.service';

interface Props {
  contractId: string;
  initialData?: Project;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (input: ProjectInput) => Promise<void>;
}

export function ProjectForm({ contractId, initialData, onClose, onSuccess, onSubmit }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProjectInput>({
    contract_id:  contractId,
    name:         initialData?.name        ?? '',
    code:         initialData?.code        ?? '',
    description:  initialData?.description ?? '',
    module_type:  initialData?.module_type ?? 'sustenance',
    redmine_id:   initialData?.redmine_id  ?? null,
  });

  const set = (field: keyof ProjectInput, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    setSaving(true);
    try {
      await onSubmit(form);
      toast.success(initialData ? 'Projeto atualizado!' : 'Projeto criado!');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar projeto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-md bg-background border rounded-xl shadow-2xl p-6">
        <h3 className="text-sm font-semibold mb-4">
          {initialData ? 'Editar Projeto' : 'Novo Projeto'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ex: NEXO, GESP3"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <Input
                value={form.code ?? ''}
                onChange={e => set('code', e.target.value)}
                placeholder="Ex: NEXO"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Redmine ID</Label>
              <Input
                type="number"
                value={form.redmine_id ?? ''}
                onChange={e => set('redmine_id', e.target.value ? Number(e.target.value) : null)}
                placeholder="ID do projeto"
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Tipo de Módulo</Label>
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
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.description ?? ''}
                onChange={e => set('description', e.target.value)}
                rows={2}
                className="text-sm resize-none"
                placeholder="Descrição opcional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : (initialData ? 'Salvar' : 'Criar')}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
