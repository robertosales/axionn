import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

interface ReportFiltersProps {
  /** Mantido para retrocompatibilidade — recebe "7"|"30"|"90"|"all" */
  periodo: string;
  setPeriodo: (v: string) => void;
  analista?: string;
  setAnalista?: (v: string) => void;
  analistas?: Array<{ user_id: string; display_name: string }>;
  showAnalista?: boolean;
  teamId?: string;
  setTeamId?: (v: string) => void;
  /** Datas em formato yyyy-mm-dd. Quando informadas, ativam o layout estilo "Produtividade". */
  dataInicio?: string;
  setDataInicio?: (v: string) => void;
  dataFim?: string;
  setDataFim?: (v: string) => void;
}

function today() {
  return new Date().toISOString().split("T")[0];
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function ReportFilters({
  periodo,
  setPeriodo,
  analista,
  setAnalista,
  analistas,
  showAnalista = true,
  teamId,
  setTeamId,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
}: ReportFiltersProps) {
  const { teams, setCurrentTeamId } = useAuth();
  const sustTeams = teams.filter((t) => t.module === "sustentacao");

  // FIX: ao trocar o time no filtro, atualizamos também o currentTeamId
  // global — os hooks de dados (useDemandas / useAllTransitions / useAllHours)
  // são scopeados por currentTeamId, então sem isso a troca só filtraria
  // localmente dados que nem foram carregados.
  const handleTeamChange = (v: string) => {
    setTeamId?.(v);
    if (v && v !== "all") setCurrentTeamId(v);
  };

  // Layout novo (estilo Produtividade) quando datas são controladas externamente
  const useDateRange = !!setDataInicio && !!setDataFim;

  if (useDateRange) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {setTeamId && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Time</Label>
                <Select value={teamId || "all"} onValueChange={handleTeamChange}>
                  <SelectTrigger className="min-h-11 w-full text-xs sm:min-h-9" aria-label="Selecionar time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sustTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showAnalista && analistas && setAnalista && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Analista</Label>
                <Select value={analista || "all"} onValueChange={setAnalista}>
                  <SelectTrigger className="min-h-11 w-full text-xs sm:min-h-9" aria-label="Selecionar analista">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos analistas</SelectItem>
                    {analistas.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id} title={a.display_name}>
                        {a.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="report-start-date" className="text-xs font-semibold">Data Início</Label>
              <Input
                type="date"
                value={dataInicio || ""}
                onChange={(e) => setDataInicio!(e.target.value)}
                id="report-start-date"
                className="min-h-11 w-full text-xs sm:min-h-9"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="report-end-date" className="text-xs font-semibold">Data Fim</Label>
              <Input
                type="date"
                value={dataFim || ""}
                onChange={(e) => setDataFim!(e.target.value)}
                id="report-end-date"
                className="min-h-11 w-full text-xs sm:min-h-9"
              />
            </div>

            <div className="flex flex-wrap items-end gap-2 pb-0.5">
              {[
                { label: "7d", days: 7 },
                { label: "30d", days: 30 },
                { label: "90d", days: 90 },
              ].map(({ label, days }) => (
                <Button
                  key={label}
                  size="sm"
                  variant="outline"
                  className="min-h-11 px-3 text-xs sm:min-h-9"
                  onClick={() => {
                    setDataInicio!(daysAgo(days));
                    setDataFim!(today());
                    setPeriodo(String(days));
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Layout legado (compacto)
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {setTeamId && (
        <Select value={teamId || "all"} onValueChange={handleTeamChange}>
          <SelectTrigger className="min-h-11 w-full text-xs sm:min-h-9 sm:w-[150px]" aria-label="Selecionar time">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {sustTeams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={periodo} onValueChange={setPeriodo}>
        <SelectTrigger className="min-h-11 w-full text-xs sm:min-h-9 sm:w-[150px]" aria-label="Selecionar período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Últimos 7 dias</SelectItem>
          <SelectItem value="30">Últimos 30 dias</SelectItem>
          <SelectItem value="90">Últimos 90 dias</SelectItem>
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </Select>
      {showAnalista && analistas && setAnalista && (
        <Select value={analista || "all"} onValueChange={setAnalista}>
          <SelectTrigger className="min-h-11 w-full text-xs sm:min-h-9 sm:w-[200px]" aria-label="Selecionar analista">
            <SelectValue placeholder="Todos analistas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos analistas</SelectItem>
            {analistas.map((a) => (
              <SelectItem key={a.user_id} value={a.user_id} title={a.display_name}>
                {a.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
