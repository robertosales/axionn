import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { OkrInitiative } from "../types";
import { createObjectiveInitiative, fetchObjectiveInitiatives, updateInitiativeStatus } from "../services/okrFollowUp.service";

export function OkrInitiativesPanel({ objectiveId }: { objectiveId: string }) {
  const [items, setItems] = useState<OkrInitiative[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setItems(await fetchObjectiveInitiatives(objectiveId)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [objectiveId]);
  const add = async () => {
    if (!title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await createObjectiveInitiative({ objectiveId, title, createdBy: user.id });
    setTitle(""); await load();
  };
  return <div className="mt-5 border-t pt-4 space-y-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Iniciativas</p><span className="text-[10px] text-muted-foreground">Ações não alteram o progresso dos KRs</span></div>
    {loading ? <p className="text-xs text-muted-foreground">Carregando...</p> : items.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma iniciativa cadastrada.</p> : <div className="space-y-1.5">{items.map((item) => <div key={item.id} className="flex items-center gap-2 rounded border px-3 py-2"><input type="checkbox" checked={item.status === "completed"} onChange={async (event) => { await updateInitiativeStatus(item.id, event.target.checked ? "completed" : "in_progress"); await load(); }} /><span className={`text-xs flex-1 ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{item.title}</span><span className="text-[10px] text-muted-foreground">{item.status}</span></div>)}</div>}
    <div className="flex gap-2"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nova iniciativa" className="h-8 flex-1 rounded border bg-background px-3 text-xs" /><Button size="sm" variant="outline" className="h-8 gap-1" onClick={add} disabled={!title.trim()}><Plus className="h-3 w-3" /> Adicionar</Button></div>
  </div>;
}
