import { useState } from "react";
import { Plus, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label }  from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRdmParticipantes } from "../hooks/useRdmParticipantes";
import { useAuth }             from "@/contexts/AuthContext";

const PAPEIS = [
  { value: "executor",    label: "Executor" },
  { value: "aprovador",   label: "Aprovador" },
  { value: "testador",    label: "Testador" },
  { value: "comunicacao", label: "Comunicação" },
  { value: "observador",  label: "Observador" },
] as const;

interface Props { rdmId: string }

export function RdmParticipantesPanel({ rdmId }: Props) {
  const { profile } = useAuth();
  const { participantes, loading, add, remove } = useRdmParticipantes(rdmId);
  const [papel, setPapel]           = useState("executor");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!profile?.id) return;
    setSubmitting(true);
    try {
      await add({ rdm_id: rdmId, profile_id: profile.id, papel });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try { await remove(id); } finally { setRemovingId(null); }
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-5">
      {participantes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
          <Users className="h-10 w-10 opacity-25" />
          <p className="text-sm">Nenhum participante cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {participantes.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {PAPEIS.find((r) => r.value === p.papel)?.label ?? p.papel}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {p.profile_id.slice(0, 8)}&hellip;
                </p>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                disabled={removingId === p.id}
                onClick={() => handleRemove(p.id)}
              >
                {removingId === p.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2  className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3 rounded-xl border border-border p-4">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Meu papel nesta RDM</Label>
          <Select value={papel} onValueChange={setPapel}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAPEIS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={submitting}
          className="gap-1.5 h-8"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Participar
        </Button>
      </div>
    </div>
  );
}
