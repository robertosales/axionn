import { useState, useMemo } from "react";
import {
  ThumbsUp, ThumbsDown, Loader2, AlertCircle,
  Clock, ShieldCheck, Users,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar, AvatarFallback, AvatarImage,
} from "@/components/ui/avatar";
import { cn }      from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRdmGoNogo }        from "../hooks/useRdmGoNogo";
import { useRdmParticipantes } from "../hooks/useRdmParticipantes";
import { toast } from "sonner";

// Papéis habilitados para votar no Go/No-Go (alinhados com CHECK do banco)
const PAPEIS_VOTANTES = ["arquiteto", "product_owner", "ad"] as const;
type PapelVotante = typeof PAPEIS_VOTANTES[number];

const PAPEL_LABELS: Record<string, string> = {
  arquiteto:     "Arquiteto",
  product_owner: "Product Owner",
  ad:            "AD",
};

const PAPEL_COLORS: Record<string, string> = {
  arquiteto:     "bg-purple-500/15 text-purple-400 border-purple-500/20",
  product_owner: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  ad:            "bg-orange-500/15 text-orange-400 border-orange-500/20",
};

function getInitials(name?: string | null, email?: string | null) {
  if (name?.trim())
    return name.trim().split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (email?.[0] ?? "?").toUpperCase();
}

interface Props { rdmId: string }

export function RdmGoNogoPanel({ rdmId }: Props) {
  const { profile } = useAuth();

  const { votes, loading: loadingV, error, totalGo, totalNogo, consensus, vote } =
    useRdmGoNogo(rdmId);
  const { participantes, loading: loadingP } = useRdmParticipantes(rdmId);

  // Justificativa por profile_id (um textarea por card)
  const [justMap, setJustMap] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null); // profile_id em submissão

  const loading = loadingV || loadingP;

  // Filtra participantes com papel de votante
  const votantes = useMemo(() =>
    participantes.filter((p) =>
      PAPEIS_VOTANTES.includes(p.papel as PapelVotante)
    ),
    [participantes]
  );

  // Mapa vote por profile_id
  const voteMap = useMemo(() => {
    const m: Record<string, typeof votes[number]> = {};
    votes.forEach((v) => { m[v.profile_id] = v; });
    return m;
  }, [votes]);

  const handleVote = async (
    profileId: string,
    papel: string,
    decisao: "go" | "no_go"
  ) => {
    setSubmitting(profileId);
    try {
      await vote({
        rdm_id:        rdmId,
        profile_id:    profileId,
        papel,
        decisao,
        justificativa: (justMap[profileId] ?? "").trim() || null,
      });
      setJustMap((prev) => ({ ...prev, [profileId]: "" }));
      toast.success(decisao === "go" ? "✅ Voto GO registrado." : "🚫 Voto NO-GO registrado.");
    } catch (e: any) {
      toast.error("Erro ao registrar voto: " + (e?.message ?? ""));
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-destructive text-sm py-6 justify-center">
      <AlertCircle className="h-4 w-4" /> {error}
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ===== Card de Consenso ===== */}
      <div className={cn(
        "rounded-xl border p-4 flex items-center gap-4",
        consensus === "go"       && "border-emerald-500/30 bg-emerald-500/10",
        consensus === "no_go"    && "border-red-500/30 bg-red-500/10",
        consensus === "pendente" && "border-border bg-muted/30",
      )}>
        {consensus === "go"       && <ThumbsUp    className="h-8 w-8 text-emerald-400 shrink-0" />}
        {consensus === "no_go"    && <ThumbsDown  className="h-8 w-8 text-red-400 shrink-0" />}
        {consensus === "pendente" && <Clock       className="h-8 w-8 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">
            {consensus === "go"       && "✅ Consenso: GO"}
            {consensus === "no_go"    && "🚫 Consenso: NO-GO"}
            {consensus === "pendente" && "⏳ Aguardando votos"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalGo} GO &nbsp;·&nbsp; {totalNogo} NO-GO &nbsp;·&nbsp;
            {votes.length} voto{votes.length !== 1 ? "s" : ""}
            {votantes.length > 0 && (
              <> &nbsp;·&nbsp; {votes.length}/{votantes.length} votantes</>
            )}
          </p>
        </div>
        {consensus === "go" && (
          <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
        )}
      </div>

      {/* ===== Aviso: sem votantes elegivéis ===== */}
      {votantes.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
          <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum votante elegivél</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adicione participantes com papel <strong>Arquiteto</strong>,{" "}
              <strong>Product Owner</strong> ou <strong>AD</strong> na aba Participantes
              para habilitar o painel de Go/No-Go.
            </p>
          </div>
        </div>
      )}

      {/* ===== Cards de votantes ===== */}
      {votantes.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Votantes ({votantes.length})
          </p>

          {votantes.map((p) => {
            const jaVotou      = !!voteMap[p.profile_id];
            const votoAtual    = voteMap[p.profile_id];
            const éEu          = profile?.id === p.profile_id;
            const emSubmissao  = submitting === p.profile_id;
            const initials     = getInitials(p.profile?.display_name, p.profile?.email);
            const displayName  = p.profile?.display_name || p.profile?.email || p.profile_id.slice(0, 8) + "…";

            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border overflow-hidden transition-all",
                  jaVotou
                    ? votoAtual?.decisao === "go"
                      ? "border-emerald-500/25 bg-emerald-500/5"
                      : "border-red-500/25 bg-red-500/5"
                    : éEu
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/10"
                )}
              >
                {/* Cabeçalho do card */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={p.profile?.avatar_url ?? undefined} alt={displayName} />
                    <AvatarFallback className="text-[11px] font-semibold bg-primary/20 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {displayName}
                      {éEu && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(você)</span>
                      )}
                    </p>
                    {p.profile?.email && (
                      <p className="text-[11px] text-muted-foreground truncate">{p.profile.email}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] h-5 shrink-0",
                    PAPEL_COLORS[p.papel] ?? ""
                  )}>
                    {PAPEL_LABELS[p.papel] ?? p.papel}
                  </Badge>

                  {/* Badge do voto já registrado */}
                  {jaVotou && (
                    <span className={cn(
                      "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full",
                      votoAtual?.decisao === "go"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {votoAtual?.decisao === "go"
                        ? <><ThumbsUp   className="h-3 w-3" /> GO</>
                        : <><ThumbsDown className="h-3 w-3" /> NO-GO</>}
                    </span>
                  )}
                  {!jaVotou && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> Pendente
                    </span>
                  )}
                </div>

                {/* Justificativa do voto já registrado */}
                {jaVotou && votoAtual?.justificativa && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-muted-foreground italic">
                      "{votoAtual.justificativa}"
                    </p>
                  </div>
                )}

                {/* Formulário de voto (só para o usuário logado e não votado ainda) */}
                {éEu && !jaVotou && (
                  <div className="px-4 pb-4 space-y-2 border-t border-border/40 pt-3">
                    <Textarea
                      placeholder="Justificativa (opcional)…"
                      rows={2}
                      className="resize-none text-sm"
                      value={justMap[p.profile_id] ?? ""}
                      onChange={(e) =>
                        setJustMap((prev) => ({ ...prev, [p.profile_id]: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm"
                        className="flex-1 gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        disabled={!!submitting}
                        onClick={() => handleVote(p.profile_id, p.papel, "go")}
                      >
                        {emSubmissao
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <ThumbsUp className="h-4 w-4" />}
                        GO
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="flex-1 gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10"
                        disabled={!!submitting}
                        onClick={() => handleVote(p.profile_id, p.papel, "no_go")}
                      >
                        {emSubmissao
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <ThumbsDown className="h-4 w-4" />}
                        NO-GO
                      </Button>
                    </div>
                  </div>
                )}

                {/* Usuário logado já votou: timestamp */}
                {éEu && jaVotou && votoAtual?.created_at && (
                  <div className="px-4 pb-2">
                    <p className="text-[10px] text-muted-foreground/60">
                      Votado em {new Date(votoAtual.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
