import { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useAuth }          from '@/contexts/AuthContext';
import { useMyContract }    from '../hooks/useMyContract';
import { SLACompliancePanel }    from '../components/SLACompliancePanel';
import { RelatorioSLAContrato }  from '../components/RelatorioSLAContrato';
import { CONTRACT_STATUS_CONFIG, ROOM_MODE_CONFIG } from '../types/contract';
import type { ContractStatus, RoomMode, ContractRoomTeam } from '../types/contract';
import { ThemeToggle }     from '@/components/ThemeToggle';
import { AxionLogo }       from '@/components/AxionLogo';
import { Button }          from '@/components/ui/button';
import { Badge }           from '@/components/ui/badge';
import { Skeleton }        from '@/components/ui/skeleton';
import {
  LogOut, FileText, ShieldCheck, Users,
  BarChart3, Menu, X, Zap, Wrench, Shuffle, CalendarDays,
} from 'lucide-react';

const TEAL = '#0bbcaf';

const NAV_ITEMS = [
  { key: 'visao-geral', label: 'Visão Geral',  icon: BarChart3    },
  { key: 'sla',         label: 'SLA',          icon: ShieldCheck  },
  { key: 'relatorio',   label: 'Relatório',    icon: FileText     },
] as const;

type PageKey = typeof NAV_ITEMS[number]['key'];

const ROOM_ICON: Record<string, React.ReactNode> = {
  agil:        <Zap    className="h-3.5 w-3.5" />,
  sustentacao: <Wrench className="h-3.5 w-3.5" />,
  hibrido:     <Shuffle className="h-3.5 w-3.5" />,
};

function TeamCard({ rt }: { rt: ContractRoomTeam }) {
  const roomCfg = ROOM_MODE_CONFIG[(rt.room_type as RoomMode) ?? 'sustentacao'];
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <Users className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{rt.team_name ?? rt.team_id.slice(0, 8)}</p>
        {roomCfg && (
          <Badge
            variant="outline"
            className={`mt-0.5 text-[10px] gap-1 border ${roomCfg.className}`}
          >
            {ROOM_ICON[rt.room_type] ?? null}
            {roomCfg.label}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function MeuContratoDashboard() {
  const { profile, signOut }    = useAuth();
  const { data, loading, error } = useMyContract();
  const navigate                 = useNavigate();
  const [activePage, setActivePage] = useState<PageKey>('visao-geral');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const contract    = data?.contract ?? null;
  const slas        = data?.slas ?? [];
  const roomTeams   = data?.roomTeams ?? [];

  const statusCfg   = contract
    ? CONTRACT_STATUS_CONFIG[contract.status as ContractStatus]
    : null;
  const roomMode    = (contract?.room_mode ?? 'sustentacao') as RoomMode;
  const roomCfg     = ROOM_MODE_CONFIG[roomMode];
  const hasSLA      = roomCfg?.hasSLA ?? true;

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={[
        'flex flex-col h-screen transition-colors duration-250 scrollbar-none',
        mobile ? 'w-64' : 'fixed top-0 left-0 w-60 z-30 hidden lg:flex',
      ].join(' ')}
      style={{ background: 'hsl(var(--sidebar))', color: 'hsl(var(--sidebar-foreground))' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 h-14 shrink-0"
        style={{ borderBottom: '1px solid rgba(192,212,208,0.08)' }}
      >
        <AxionLogo size={24} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-none tracking-tight" style={{ color: '#ffffff' }}>
            Axion
          </p>
          <p className="text-[9px] uppercase tracking-widest leading-none mt-0.5" style={{ color: TEAL }}>
            Contrato
          </p>
        </div>
        {mobile && (
          <button
            className="ml-auto flex items-center justify-center"
            style={{ color: 'rgba(192,212,208,0.5)' }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nome do contrato */}
      {contract && (
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(192,212,208,0.08)' }}
        >
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: TEAL }}>
            Contrato ativo
          </p>
          <p className="text-sm font-semibold mt-0.5 text-white truncate">{contract.name}</p>
          {statusCfg && (
            <Badge className={`mt-1 text-[10px] border ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
          )}
        </div>
      )}

      {/* Nav */}
      <nav
        className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = activePage === key;
          return (
            <button
              key={key}
              onClick={() => { setActivePage(key); if (mobile) setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors text-left relative"
              style={{
                background: isActive ? 'hsl(var(--sidebar-active))' : 'transparent',
                color:      isActive ? '#ffffff' : 'rgba(192,212,208,0.7)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'hsl(var(--sidebar-accent))';
                  (e.currentTarget as HTMLElement).style.color = 'hsl(var(--sidebar-foreground))';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(192,212,208,0.7)';
                }
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{ background: TEAL }}
                />
              )}
              <Icon
                className="h-[14px] w-[14px] shrink-0"
                style={{ color: isActive ? TEAL : 'rgba(61,90,86,1)' }}
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-3 space-y-2 shrink-0"
        style={{ borderTop: '1px solid rgba(192,212,208,0.08)' }}
      >
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(192,212,208,0.55)' }}>
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{profile?.display_name ?? 'Admin Contrato'}</span>
        </div>
        <Button
          variant="ghost" size="sm"
          className="w-full justify-start h-8 text-xs gap-2 transition-colors"
          style={{ color: 'rgba(192,212,208,0.6)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'hsl(var(--sidebar-accent))';
            (e.currentTarget as HTMLElement).style.color = 'hsl(var(--sidebar-foreground))';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'rgba(192,212,208,0.6)';
          }}
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </Button>
      </div>
    </aside>
  );

  // ── Conteúdo ───────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      );
    }

    if (error || !contract) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            {error ?? 'Nenhum contrato vinculado à sua conta.'}
          </p>
        </div>
      );
    }

    if (activePage === 'sla') {
      return (
        <SLACompliancePanel
          contractId={contract.id}
          contractName={contract.name}
          title="SLA – Compliance do Contrato"
        />
      );
    }

    if (activePage === 'relatorio') {
      return <RelatorioSLAContrato contractId={contract.id} contractName={contract.name} />;
    }

    // visao-geral
    return (
      <div className="space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Modalidade</p>
            <div className="flex items-center gap-1.5 mt-2">
              {roomCfg && (
                <Badge variant="outline" className={`text-[11px] border gap-1 ${roomCfg.className}`}>
                  {ROOM_ICON[roomMode]}
                  {roomCfg.label}
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</p>
            {statusCfg && (
              <Badge className={`mt-2 text-xs border ${statusCfg.className}`}>
                {statusCfg.label}
              </Badge>
            )}
          </div>

          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Times</p>
            <p className="text-2xl font-bold mt-1">{roomTeams.length}</p>
          </div>

          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">SLAs</p>
            <p className={`text-2xl font-bold mt-1 ${hasSLA ? 'text-purple-400' : 'text-muted-foreground'}`}>
              {hasSLA ? slas.length : '—'}
            </p>
          </div>
        </div>

        {/* Vigência */}
        {(contract.starts_at || contract.ends_at) && (
          <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">Vigência</p>
              <p className="text-sm font-medium">
                {contract.starts_at
                  ? new Date(contract.starts_at).toLocaleDateString('pt-BR')
                  : '—'}
                {' → '}
                {contract.ends_at
                  ? new Date(contract.ends_at).toLocaleDateString('pt-BR')
                  : 'Indeterminado'}
              </p>
            </div>
          </div>
        )}

        {/* Times vinculados */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Times vinculados</h2>
          {roomTeams.length === 0 ? (
            <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum time vinculado a este contrato.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {roomTeams.map(rt => <TeamCard key={rt.id} rt={rt} />)}
            </div>
          )}
        </div>

        {/* SLA inline (somente modalidades com SLA) */}
        {hasSLA && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">SLA – Visão rápida</h2>
            <SLACompliancePanel
              contractId={contract.id}
              contractName={contract.name}
            />
          </div>
        )}
      </div>
    );
  };

  const pageLabel = NAV_ITEMS.find(n => n.key === activePage)?.label ?? 'Meu Contrato';

  return (
    <div className="min-h-screen flex" style={{ background: 'hsl(var(--background))' }}>
      <Sidebar />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      {sidebarOpen && (
        <div className="fixed top-0 left-0 z-50 h-screen lg:hidden">
          <Sidebar mobile />
        </div>
      )}

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Header */}
        <header
          className="sticky top-0 z-20 backdrop-blur"
          style={{
            background: 'hsl(var(--background) / 0.95)',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden"
                style={{ color: 'hsl(var(--muted-foreground))' }}
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-sm font-semibold leading-tight">{pageLabel}</h1>
                {contract && (
                  <p className="text-[11px] hidden sm:block" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {contract.name}
                  </p>
                )}
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-4 md:px-6 py-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
