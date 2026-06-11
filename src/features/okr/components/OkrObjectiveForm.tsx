import { useEffect, useMemo, useState } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { OkrObjective, OkrStatus } from "../types";

interface ObjectivePayload {
  title: string;
  description?: string;
  owner_id?: string;
  owner_name?: string;
  team_id: string;
  team_name?: string;
  cycle: string;
  status: OkrStatus;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ObjectivePayload) => Promise<void>;
  teams: { id: string; name: string }[];
  defaultCycle: string;
  objective?: OkrObjective | null;
}

export function OkrObjectiveForm({ open, onClose, onSubmit, teams, defaultCycle, objective }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === teamId), [teams, teamId]);
  const isEdit = !!objective;

  useEffect(() => {
    if (!open) return;
    setTitle(objective?.title ?? "");
    setDescription(objective?.description ?? "");
    // Prioriza: team do objective editado → primeiro time disponível → string vazia
    const resolvedTeamId = objective?.team_id ?? teams[0]?.id ?? "";
    setTeamId(resolvedTeamId);
  }, [open, objective, teams]);

  if (!open) return null;

  const isTeamValid = !!teamId && teamId !== "all" && teams.some((t) => t.id === teamId);

  const handleSubmit = async () => {
    if (!title.trim() || !isTeamValid) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        owner_id: objective?.owner_id ?? user?.id ?? undefined,
        owner_name: objective?.owner_name ?? user?.email ?? undefined,
        team_id: teamId,
        team_name: selectedTeam?.name,
        cycle: objective?.cycle ?? defaultCycle,
        status: objective?.status ?? "on_track",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-base font-semibold">{isEdit ? "Editar objetivo" : "Novo objetivo"}</h3>
            <p className="text-xs text-muted-foreground">Defina o objetivo principal do ciclo.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Reduzir retrabalho nas entregas"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[88px] w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Contexto, impacto esperado e escopo do objetivo"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Time</label>
              {teams.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Carregando times...</p>
              ) : (
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Ciclo</label>
              <input
                value={objective?.cycle ?? defaultCycle}
                disabled
                className="h-10 w-full rounded-lg border bg-muted px-3 text-sm text-muted-foreground"
              />
            </div>
          </div>

          {!isTeamValid && teams.length > 0 && (
            <p className="text-xs text-destructive">Selecione um time válido para continuar.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !isTeamValid || !title.trim()} className="gap-1.5">
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                {isEdit ? "Salvando..." : "Criando..."}
              </span>
            ) : (
              <><Save className="h-4 w-4" /> {isEdit ? "Salvar alterações" : "Criar objetivo"}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
