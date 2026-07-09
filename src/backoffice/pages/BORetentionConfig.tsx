import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  Database,
  Shield,
  Timer,
  UserX,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useOrgBriefingRetentionConfig,
  useSetOrgBriefingRetentionConfig,
  useArchiveExpiredBriefings,
} from "@/features/briefing/hooks/useBriefingBackoffice";

interface BORetentionConfigProps {
  orgId: string;
}

export default function BORetentionConfig({ orgId }: BORetentionConfigProps) {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useOrgBriefingRetentionConfig(orgId);
  const setConfigMutation = useSetOrgBriefingRetentionConfig();
  const archiveMutation = useArchiveExpiredBriefings();

  const [form, setForm] = useState({
    defaultRetentionDays: config?.defaultRetentionDays ?? 180,
    autoArchive: config?.autoArchive ?? true,
    autoAnonymize: config?.autoAnonymize ?? false,
    allowPermanentDelete: config?.allowPermanentDelete ?? false,
  });

  const handleChange = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setConfigMutation.mutateAsync({ orgId, config: form });
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["briefing-retention-config", orgId] });
    } catch (err) {
      toast.error("Erro ao salvar configuração");
    }
  };

  const handleArchiveNow = async () => {
    try {
      const count = await archiveMutation.mutateAsync();
      toast.success(`${count} briefing(s) arquivado(s)`);
      queryClient.invalidateQueries({ queryKey: ["briefing-backoffice"] });
    } catch {
      toast.error("Erro ao arquivar");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Retenção e Privacidade — Briefing IA</h1>
        <p className="text-sm text-muted-foreground">
          Configure por quanto tempo os briefings são mantidos e como dados sensíveis são tratados.
        </p>
      </div>

      <Card className="border-cyan-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-cyan-500" />
            <CardTitle className="text-base">Retenção padrão</CardTitle>
          </div>
          <CardDescription>
            Dias após os quais briefings sem atividade são elegíveis para arquivamento automático.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="retentionDays">Dias de retenção (1–3650)</Label>
            <Input
              id="retentionDays"
              type="number"
              min={1}
              max={3650}
              value={form.defaultRetentionDays}
              onChange={(e) => handleChange("defaultRetentionDays", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            <CardTitle className="text-base">Arquivamento automático</CardTitle>
          </div>
          <CardDescription>
            Move briefings expirados para status "arquivado" automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Ativar auto-arquivar</p>
            <p className="text-sm text-muted-foreground">
              {form.autoArchive ? "Ativo" : "Inativo — briefings expirados permanecem ativos"}
            </p>
          </div>
          <Switch
            checked={form.autoArchive}
            onCheckedChange={(checked) => handleChange("autoArchive", checked)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle className="text-base">Anonimização automática</CardTitle>
          </div>
          <CardDescription>
            Substitui conteúdo e evidências por "[ANONIMIZADO]" ao arquivar. Mantém estrutura para
            auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Ativar auto-anonimizar</p>
            <p className="text-sm text-muted-foreground">
              Requer "Arquivamento automático" ativo. Remove nomes, falas e transcrições.
            </p>
          </div>
          <Switch
            checked={form.autoAnonymize}
            onCheckedChange={(checked) => handleChange("autoAnonymize", checked)}
            disabled={!form.autoArchive}
          />
        </CardContent>
      </Card>

      <Card className="border-rose-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-rose-500" />
            <CardTitle className="text-base text-rose-700">Exclusão permanente</CardTitle>
          </div>
          <CardDescription>
            Permite exclusão definitiva (hard delete) de briefings. Sem isso, faz apenas soft-delete
            (arquiva e limpa conteúdo).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Permitir hard delete</p>
            <p className="text-sm text-muted-foreground">
              {form.allowPermanentDelete
                ? "Ativo — remove completamente do banco"
                : "Inativo — apenas arquiva e anonimiza (recomendado)"}
            </p>
          </div>
          <Switch
            checked={form.allowPermanentDelete}
            onCheckedChange={(checked) => handleChange("allowPermanentDelete", checked)}
          />
        </CardContent>
      </Card>

      <Card className="border-amber-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base text-amber-700">Ação manual</CardTitle>
          </div>
          <CardDescription>
            Arquiva agora todos os briefings que já passaram do prazo de retenção.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleArchiveNow}
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Arquivar expirados agora
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit" disabled={setConfigMutation.isPending}>
          {setConfigMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Salvar configuração
        </Button>
      </div>
    </form>
  );
}