import { useState } from "react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Input }    from "@/components/ui/input";
import { Search, Play } from "lucide-react";

interface HU { id: string; code: string; title: string; estimated_hours: number | null; }

interface Props {
  hus:        HU[];
  onStartRound: (huId: string) => void;
  disabled?:  boolean;
}

export function HUSelector({ hus, onStartRound, disabled }: Props) {
  const [search, setSearch] = useState("");

  const filtered = hus.filter(h =>
    h.code.toLowerCase().includes(search.toLowerCase()) ||
    h.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar HU..."
          className="pl-8 h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma HU no backlog</p>
        )}
        {filtered.map(hu => (
          <div key={hu.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{hu.code}</span>
              <span className="text-xs truncate">{hu.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hu.estimated_hours !== null && (
                <Badge variant="secondary" className="text-[9px]">{hu.estimated_hours}h</Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1 px-2"
                disabled={disabled}
                onClick={() => onStartRound(hu.id)}
              >
                <Play className="h-2.5 w-2.5" /> Estimar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
