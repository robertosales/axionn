import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminKpis } from "@/features/admin/hooks/useAdminKpis";
import { useNotifications } from "@/features/admin/hooks/useNotifications";
import { useDashboardFilters } from "@/features/admin/hooks/useDashboardFilters";
import { ContractProvider, useContractContext } from "@/features/admin/contexts/ContractContext";
import { ContractSwitcher }   from "@/features/admin/components/ContractSwitcher";
import { SalaAgilKpis }        from "@/features/admin/components/SalaAgilKpis";
import { SustentacaoKpis }     from "@/features/admin/components/SustentacaoKpis";
import { ModuleQuickAccess }   from "@/features/admin/components/ModuleQuickAccess";
import { ComparativeChart }    from "@/features/admin/components/ComparativeChart";
import { TeamDetailPanel }     from "@/features/admin/components/TeamDetailPanel";
import { AdminTimesPage }      from "@/features/admin/pages/AdminTimesPage";
import { AdminUsuariosPage }   from "@/features/admin/pages/AdminUsuariosPage";
import { AdminHistoricoPage }  from "@/features/admin/pages/AdminHistoricoPage";
import { AdminCapacidadePage } from "@/features/admin/pages/AdminCapacidadePage";
import { AdminIAsPage }        from "@/features/admin/pages/AdminIAsPage";
import { AdminContratosPage }  from "@/features/admin/pages/AdminContratosPage";
import { ProjetosAdminPanel }  from "@/features/admin/components/ProjetosAdminPanel";
import { NotificationBell }    from "@/features/admin/components/NotificationBell";
import { ThemeToggle }         from "@/components/ThemeToggle";
import { DashboardFilters }    from "@/features/admin/components/DashboardFilters";
import { ExecutiveKpis }       from "@/features/admin/components/ExecutiveKpis";
import { TeamSummaryCards }    from "@/features/admin/components/TeamSummaryCards";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AxionLogo } from "@/components/AxionLogo";
import type { TeamKpis, AdminKpis } from "@/features/admin/hooks/useAdminKpis";
import {
  LogOut, Users, UsersRound,
  BarChart3, History, Gauge, AlertTriangle, Sparkles, Menu, X, FileText,
  FolderKanban, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";

const TEAL = "#0bbcaf";

const NAV_ITEMS = [
  { key: "visao-geral", label: "Vis\u00e3o Geral", icon: BarChart3    },
  { key: "historico",   label: "Hist\u00f3rico",   icon: History      },
  { key: "capacidade",  label: "Capacidade",  icon: Gauge        },
  { key: "times",       label: "Times",       icon: UsersRound   },
  { key: "usuarios",    label: "Usu\u00e1rios",    icon: Users        },
  { key: "projetos",    label: "Projetos",    icon: FolderKanban },
  { key: "ias",         label: "IA",          icon: Sparkles     },
  { key: "contratos",   label: "Contratos",   icon: FileText     },
] as const;

type PageKey = typeof NAV_ITEMS[number]["key"];

// ---------------------------------------------------------------------------
// Hook para detectar dark mode e retornar cor de fundo opaca para o top bar
// Usa o atributo data-theme ou prefers-color-scheme como fallback
// ---------------------------------------------------------------------------
function useTopBarBg() {
  const [bg, setBg] = useState<string>("#ffffff");

  useEffect(() => {
    const update = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = theme === "dark" || (!theme && prefersDark);
      // Lemos a CSS var --background resolvida do elemento root
      const rawBg = getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
      // Se a var estiver definida (shadcn/ui usa formato "hsl(... ... ...)"),
      // montamos o hsl. Sen\u00e3o usamos fallback s\u00f3lido.
      if (rawBg) {
        setBg(`hsl(${rawBg})`);
      } else {
        setBg(isDark ? "#171614" : "#f7f6f2");
      }
    };

    update();

    // Observa troca de data-theme no <html>
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);

    return () => {
      obs.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);

  return bg;
}

// ---------------------------------------------------------------------------
// VisaoGeralPage \u2014 corpo da p\u00e1gina (sem header pr\u00f3prio)
// ---------------------------------------------------------------------------
interface VisaoGeralPageProps {
  byTeam:       TeamKpis[];
  loading:      boolean;
  dataWarnings: string[] | null | undefined;
  globalKpis:   AdminKpis["global"];
}

function VisaoGeralPage({ byTeam, loading, dataWarnings, globalKpis }: VisaoGeralPageProps) {
  const {
    pendingFilters,
    appliedTeamId,
    appliedModule,
    handleChange,
    handleApply,
  } = useDashboardFilters();

  const filteredByTeam = useMemo(() => {
    if (appliedTeamId === "all") return byTeam;
    return byTeam.filter((t) => t.teamId === appliedTeamId);
  }, [byTeam, appliedTeamId]);

  const filteredByModule = useMemo(() => {
    if (appliedModule === "todos") return filteredByTeam;
    return filteredByTeam.filter((t) => {
      const m = (t.module ?? "").toLowerCase();
      if (appliedModule === "sala-agil")   return m.includes("agil") || m.includes("scrum");
      if (appliedModule === "sustentacao") return m.includes("sust");
      if (appliedModule === "rdm")         return m.includes("rdm") || m.includes("muda");
      return true;
    });
  }, [filteredByTeam, appliedModule]);

  const execKpis = useMemo(() => {
    const timesAtivos     = filteredByModule.length;
    const sprintSet       = new Set(filteredByModule.map(t => t.sprintAtivo).filter(Boolean));
    const sprintLabel     = sprintSet.size === 1
      ? [...sprintSet][0]!
      : sprintSet.size > 1 ? `${sprintSet.size} sprints ativas` : null;
    const husAtivas        = filteredByModule.reduce((s, t) => s + (t.husAtivas      ?? 0), 0);
    const husTotais        = filteredByModule.reduce((s, t) => s + (t.husAtivas      ?? 0) + (t.husConcluidas ?? 0), 0);
    const husConcluidas    = filteredByModule.reduce((s, t) => s + (t.husConcluidas  ?? 0), 0);
    const husConcluidasPct = husTotais > 0 ? Math.round((husConcluidas / husTotais) * 100) : 0;
    const demandasAbertas  = filteredByModule.reduce((s, t) => s + (t.demandasAbertas ?? 0), 0);
    const slaEmRisco       = filteredByModule.reduce((s, t) => s + (t.slaEmRisco      ?? 0), 0);
    return { timesAtivos, sprintLabel, husAtivas, husConcluidasPct, demandasAbertas, slaEmRisco };
  }, [filteredByModule]);

  const teamCards = useMemo(() => filteredByModule.map((t) => ({
    teamId:          t.teamId,
    teamName:        t.teamName,
    module:          (t.module ?? "").toLowerCase().includes("agil") ? "sala-agil" : "sustentacao",
    husAtivas:       t.husAtivas,
    impedimentos:    t.impedimentos,
    backlog:         t.backlog,
    demandasAbertas: t.demandasAbertas,
    slaEmRisco:      t.slaEmRisco,
    bloqueadas:      t.bloqueadas,
    sprintAtivo:     t.sprintAtivo,
  })), [filteredByModule]);

  const teamsForFilter = useMemo(() => byTeam.map(t => ({ id: t.teamId, name: t.teamName })), [byTeam]);
  const [scrollTeam, setScrollTeam] = useState("all");

  return (
    <div className="flex flex-col gap-5">

      {dataWarnings && dataWarnings.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">{dataWarnings[0]}</AlertDescription>
        </Alert>
      )}

      {/* 1. FILTROS */}
      <DashboardFilters
        filters={pendingFilters}
        teams={teamsForFilter}
        onChange={handleChange}
        onApply={handleApply}
        loading={loading}
      />

      {/* 2. CARDS EXECUTIVOS */}
      <section aria-label="Indicadores executivos">
        <ExecutiveKpis
          timesAtivos={execKpis.timesAtivos}
          sprintAtiva={execKpis.sprintLabel}
          husAtivas={execKpis.husAtivas}
          husConcluidasPct={execKpis.husConcluidasPct}
          demandasAbertas={execKpis.demandasAbertas}
          slaEmRisco={execKpis.slaEmRisco}
          slaDescricao={execKpis.slaEmRisco > 0 ? "+5 dias sem conclus\u00e3o" : undefined}
          loading={loading}
        />
      </section>

      {/* 3. ACESSO R\u00c1PIDO */}
      <section aria-label="Acesso r\u00e1pido">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acesso R\u00e1pido</h2>
        <ModuleQuickAccess kpis={globalKpis} />
      </section>

      {/* 4. RESUMO POR TIME */}
      <section aria-label="Resumo por time">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resumo por Time</h2>
          <div className="flex gap-1">
            <button
              className="rounded-md border p-1 hover:bg-muted transition-colors"
              aria-label="Rolar para esquerda"
              onClick={() => document.getElementById("team-scroll")?.scrollBy({ left: -260, behavior: "smooth" })}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="rounded-md border p-1 hover:bg-muted transition-colors"
              aria-label="Rolar para direita"
              onClick={() => document.getElementById("team-scroll")?.scrollBy({ left: 260, behavior: "smooth" })}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div id="team-scroll">
          <TeamSummaryCards
            teams={teamCards}
            loading={loading}
            onTeamClick={(id) => setScrollTeam(id)}
          />
        </div>
      </section>

      {/* 5. INDICADORES POR M\u00d3DULO */}
      {(appliedModule === "todos" || appliedModule === "sala-agil") && (
        <section aria-label="Indicadores Sala \u00c1gil">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Indicadores por M\u00f3dulo</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card shadow-sm p-4">
              <SalaAgilKpis kpis={globalKpis} sprintAtivo={execKpis.sprintLabel} />
            </div>
            {(appliedModule === "todos" || appliedModule === "sustentacao") && (
              <div className="rounded-xl border bg-card shadow-sm p-4">
                <SustentacaoKpis kpis={globalKpis} />
              </div>
            )}
          </div>
        </section>
      )}

      {appliedModule === "sustentacao" && (
        <section aria-label="Indicadores Sustenta\u00e7\u00e3o">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Indicadores por M\u00f3dulo</h2>
          <div className="rounded-xl border bg-card shadow-sm p-4">
            <SustentacaoKpis kpis={globalKpis} />
          </div>
        </section>
      )}

      {/* 6 + 7. DETALHE E DESEMPENHO POR TIME */}
      <section aria-label="Detalhamento operacional">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold">Detalhe por Time</h2>
            </div>
            <TeamDetailPanel
              byTeam={filteredByModule}
              selectedTeam={scrollTeam}
              onSelect={setScrollTeam}
            />
          </div>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold">Desempenho por Time</h2>
            </div>
            <div className="px-2 pb-4">
              <ComparativeChart byTeam={filteredByModule} loading={loading} />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminDashboard \u2014 shell (sidebar + main)
// ---------------------------------------------------------------------------
function AdminDashboardInner() {
  const { profile, signOut } = useAuth();
  const { isGestor, selectedContractId, selectedContract } = useContractContext();
  const navigate  = useNavigate();
  const [activePage, setActivePage]   = useState<PageKey>("visao-geral");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { global: g, byTeam, loading, dataWarnings } = useAdminKpis(selectedContractId);
  const { notifications, criticalCount, warningCount } = useNotifications(byTeam ?? []);

  // Fundo opaco do top bar \u2014 resolve a CSS var --background em runtime
  // para garantir que n\u00e3o seja transparente durante o scroll
  const topBarBg = useTopBarBg();

  // Rel\u00f3gio \u2014 \u00fanico setInterval para todo o shell
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const horaLabel = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dataLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // \u00daltima atualiza\u00e7\u00e3o
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  useEffect(() => { if (!loading) setLastUpdated(new Date()); }, [loading]);
  const lastUpdatedLabel = useMemo(() => {
    const diffMin = Math.floor((Date.now() - lastUpdated.getTime()) / 60_000);
    if (diffMin < 1)   return "agora mesmo";
    if (diffMin === 1) return "h\u00e1 1 minuto";
    return `h\u00e1 ${diffMin} minutos`;
  }, [lastUpdated]);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const isVisaoGeral = activePage === "visao-geral";
  const activeLabel  = NAV_ITEMS.find(n => n.key === activePage)?.label ?? "";

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={[
        "flex flex-col h-screen transition-colors duration-250 scrollbar-none",
        mobile ? "w-64" : "fixed top-0 left-0 w-60 z-30 hidden lg:flex",
      ].join(" ")}
      style={{ background: "hsl(var(--sidebar))", color: "hsl(var(--sidebar-foreground))" }}
    >
      <div
        className="flex items-center gap-2.5 px-4 h-14 shrink-0"
        style={{ borderBottom: "1px solid rgba(192,212,208,0.08)" }}
      >
        <AxionLogo size={24} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-none tracking-tight" style={{ color: "#ffffff" }}>Axion</p>
          <p className="text-[9px] uppercase tracking-widest leading-none mt-0.5" style={{ color: TEAL }}>Admin</p>
        </div>
        {mobile && (
          <button
            className="ml-auto flex items-center justify-center"
            style={{ color: "rgba(192,212,208,0.5)" }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isGestor && <ContractSwitcher />}

      <nav
        className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-none"
        aria-label="Navega\u00e7\u00e3o admin"
        style={{ scrollbarWidth: "none" }}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = activePage === key;
          return (
            <button
              key={key}
              onClick={() => { setActivePage(key); if (mobile) setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors text-left"
              style={{
                background: isActive ? "hsl(var(--sidebar-active))" : "transparent",
                color:      isActive ? "#ffffff" : "rgba(192,212,208,0.7)",
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(192,212,208,0.06)"; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              {key === "contratos" && (
                <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: TEAL, color: "#fff" }}>Novo</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 mt-auto shrink-0" style={{ borderTop: "1px solid rgba(192,212,208,0.08)" }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ background: TEAL, color: "#fff" }}
          >
            {profile?.full_name?.split(" ").slice(0, 2).map((n: string) => n[0]).join("") || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium leading-tight truncate" style={{ color: "rgba(192,212,208,0.9)" }}>
              {profile?.full_name || "Usu\u00e1rio"}
            </p>
            <p className="text-[10px] leading-tight" style={{ color: "rgba(192,212,208,0.45)" }}>
              {profile?.role === "gestor" ? "Gestor" : "Admin"}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors"
          style={{ color: "rgba(192,212,208,0.5)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(192,212,208,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(192,212,208,0.9)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(192,212,208,0.5)"; }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  );

  const renderPage = () => {
    switch (activePage) {
      case "visao-geral": return (
        <VisaoGeralPage
          byTeam={byTeam ?? []}
          loading={loading}
          dataWarnings={dataWarnings}
          globalKpis={g}
        />
      );
      case "historico":  return <AdminHistoricoPage />;
      case "capacidade": return <AdminCapacidadePage />;
      case "times":      return <AdminTimesPage />;
      case "usuarios":   return <AdminUsuariosPage />;
      case "projetos":   return <ProjetosAdminPanel />;
      case "ias":        return <AdminIAsPage />;
      case "contratos":  return <AdminContratosPage />;
      default:           return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="ml-auto"><Sidebar mobile /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-screen lg:ml-60">

        {/*
          TOP BAR sticky \u2014 fundo 100% opaco, resolvido em runtime.

          Por que useTopBarBg() e n\u00e3o s\u00f3 className="bg-background"?
          \u2192 A classe Tailwind bg-background aplica hsl(var(--background))
             via CSS, mas n\u00e3o garante que --background tenha alpha=1.
             shadcn/ui define --background como "0 0% 100%" (s\u00f3 os canais HSL)
             sem alpha expl\u00edcito, o que funciona na maioria dos casos.
             O hook l\u00ea o valor real em runtime e monta hsl() s\u00f3lido,
             garantindo opacidade total independente do tema.

          isolation: isolate + position: sticky + z-index: 20
          garantem que nenhum filho com transform/opacity vaze acima.
        */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 h-14 px-4 lg:px-6 shrink-0"
          style={{
            backgroundColor: topBarBg,
            borderBottom: "1px solid hsl(var(--border))",
            isolation: "isolate",
          }}
        >
          {/* Bot\u00e3o menu mobile */}
          <button
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* T\u00edtulo da p\u00e1gina ativa + subt\u00edtulo (visao-geral only) */}
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold leading-none tracking-tight truncate">
                {activeLabel}
              </h1>
              {loading && isVisaoGeral && (
                <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin shrink-0" aria-label="Carregando" />
              )}
            </div>
            {isVisaoGeral && (
              <div className="flex items-center gap-1.5 mt-[3px]">
                <span className="text-xs font-semibold text-foreground truncate">
                  {selectedContract?.name ?? "\u2014"}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                  \u00b7 \u00daltima atualiza\u00e7\u00e3o: {lastUpdatedLabel}
                </span>
              </div>
            )}
          </div>

          {/* Data + hora \u2014 vis\u00edvel apenas em lg+ */}
          <div className="hidden lg:flex flex-col items-end shrink-0">
            <span className="text-[11px] text-muted-foreground capitalize leading-none">{dataLabel}</span>
            <span className="text-[13px] font-semibold tabular-nums leading-tight mt-0.5">{horaLabel}</span>
          </div>

          {/* A\u00e7\u00f5es */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <NotificationBell
              notifications={notifications}
              criticalCount={criticalCount}
              warningCount={warningCount}
            />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {renderPage()}
        </main>

        <footer className="text-center text-[11px] text-muted-foreground py-3 border-t px-4">
          Axion Admin \u00a9 2026 \u00b7 Todos os direitos reservados.
        </footer>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ContractProvider>
      <AdminDashboardInner />
    </ContractProvider>
  );
}
