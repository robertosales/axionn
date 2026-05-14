import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FluxoColuna {
  id: string;
  team_id: string;
  key: string;
  label: string;
  color_class: string;
  dot_color: string;
  hex: string | null;
  sort_order: number;
  wip_limit: number | null;
}

const COLOR_PRESETS = [
  { label: "Cinza",    color_class: "bg-slate-100 text-slate-700",   dot_color: "bg-slate-400",   hex: "#94a3b8" },
  { label: "Azul",     color_class: "bg-blue-100 text-blue-700",     dot_color: "bg-blue-500",    hex: "#3b82f6" },
  { label: "Violeta",  color_class: "bg-violet-100 text-violet-700", dot_color: "bg-violet-500",  hex: "#8b5cf6" },
  { label: "Âmbar",   color_class: "bg-amber-100 text-amber-700",   dot_color: "bg-amber-500",   hex: "#f59e0b" },
  { label: "Verde",    color_class: "bg-green-100 text-green-700",   dot_color: "bg-green-500",   hex: "#22c55e" },
  { label: "Vermelho", color_class: "bg-red-100 text-red-700",       dot_color: "bg-red-500",     hex: "#ef4444" },
  { label: "Rosa",     color_class: "bg-pink-100 text-pink-700",     dot_color: "bg-pink-500",    hex: "#ec4899" },
  { label: "Ciano",    color_class: "bg-cyan-100 text-cyan-700",     dot_color: "bg-cyan-500",    hex: "#06b6d4" },
];

export { COLOR_PRESETS };

export function useFluxoAdmin(teamId: string) {
  const [colunas, setColunas] = useState<FluxoColuna[]>([]);
  const [loading, setLoading] = useState(false);

  // BUG FIX 1: limpa colunas imediatamente ao trocar de time
  // evita que colunas do time anterior apareçam enquanto o novo carrega
  useEffect(() => {
    setColunas([]);
  }, [teamId]);

  const load = useCallback(async () => {
    if (!teamId) {
      setColunas([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("workflow_columns")
        .select("*")
        .eq("team_id", teamId)
        .order("sort_order");

      if (error) {
        // BUG FIX 2: exibe mensagem de erro real do Supabase (não silencia)
        console.error("[useFluxoAdmin] load error:", error);
        toast.error("Erro ao carregar fluxo: " + error.message);
        return;
      }

      setColunas((data ?? []) as FluxoColuna[]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const create = async (payload: Omit<FluxoColuna, "id" | "team_id">) => {
    if (!teamId) {
      toast.error("Nenhum time selecionado");
      return false;
    }

    // Calcula sort_order baseado nas colunas já carregadas
    const nextOrder =
      colunas.length > 0
        ? Math.max(...colunas.map(c => c.sort_order)) + 1
        : 0;

    const row = {
      key:         payload.key,
      label:       payload.label,
      color_class: payload.color_class,
      dot_color:   payload.dot_color,
      hex:         payload.hex,
      wip_limit:   payload.wip_limit ?? null,
      team_id:     teamId,
      sort_order:  nextOrder,
    };

    // BUG FIX 3: usa select() para obter o registro inserido e confirmar persistência
    const { data: inserted, error } = await supabase
      .from("workflow_columns")
      .insert(row)
      .select()
      .single();

    if (error || !inserted) {
      console.error("[useFluxoAdmin] insert error:", error);
      toast.error("Erro ao criar coluna: " + (error?.message ?? "Resposta vazia do banco"));
      return false;
    }

    // Atualiza estado local imediatamente com o registro confirmado pelo banco
    setColunas(prev => [...prev, inserted as FluxoColuna]);
    toast.success("Coluna criada com sucesso!");

    // Recarrega para garantir ordem e dados frescos
    await load();
    return true;
  };

  const update = async (id: string, data: Partial<Omit<FluxoColuna, "id" | "team_id">>) => {
    const { data: updated, error } = await supabase
      .from("workflow_columns")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      console.error("[useFluxoAdmin] update error:", error);
      toast.error("Erro ao atualizar coluna: " + (error?.message ?? "Resposta vazia"));
      return false;
    }

    toast.success("Coluna atualizada!");
    await load();
    return true;
  };

  const remove = async (id: string) => {
    const col = colunas.find(c => c.id === id);
    if (col) {
      const { count, error: countError } = await supabase
        .from("user_stories")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("status", col.key);

      if (countError) {
        console.error("[useFluxoAdmin] count error:", countError);
      }
      if ((count ?? 0) > 0) {
        toast.error(`Não é possível excluir: ${count} HU(s) estão nessa coluna`);
        return false;
      }
    }

    const { error } = await supabase
      .from("workflow_columns")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[useFluxoAdmin] delete error:", error);
      toast.error("Erro ao excluir coluna: " + error.message);
      return false;
    }

    toast.success("Coluna excluída");
    await load();
    return true;
  };

  const moveUp = async (id: string) => {
    const idx = colunas.findIndex(c => c.id === id);
    if (idx <= 0) return;
    const prev = colunas[idx - 1];
    const curr = colunas[idx];
    const [r1, r2] = await Promise.all([
      supabase.from("workflow_columns").update({ sort_order: prev.sort_order }).eq("id", curr.id).select().single(),
      supabase.from("workflow_columns").update({ sort_order: curr.sort_order }).eq("id", prev.id).select().single(),
    ]);
    if (r1.error || r2.error) {
      console.error("[useFluxoAdmin] moveUp error:", r1.error, r2.error);
      toast.error("Erro ao reordenar colunas");
    }
    await load();
  };

  const moveDown = async (id: string) => {
    const idx = colunas.findIndex(c => c.id === id);
    if (idx < 0 || idx >= colunas.length - 1) return;
    const next = colunas[idx + 1];
    const curr = colunas[idx];
    const [r1, r2] = await Promise.all([
      supabase.from("workflow_columns").update({ sort_order: next.sort_order }).eq("id", curr.id).select().single(),
      supabase.from("workflow_columns").update({ sort_order: curr.sort_order }).eq("id", next.id).select().single(),
    ]);
    if (r1.error || r2.error) {
      console.error("[useFluxoAdmin] moveDown error:", r1.error, r2.error);
      toast.error("Erro ao reordenar colunas");
    }
    await load();
  };

  return { colunas, loading, reload: load, create, update, remove, moveUp, moveDown };
}
