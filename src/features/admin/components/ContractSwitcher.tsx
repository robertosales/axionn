import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, ChevronUp, Globe, Check } from "lucide-react";
import { useContractContext } from "../contexts/ContractContext";

/**
 * ContractSwitcher — aparece na sidebar APENAS para o Gestor Master.
 * Para o Admin de contrato, renderiza um bloco estático sem interação.
 */
export function ContractSwitcher() {
  const { selectedContractId, selectedContract, setSelectedContractId, contracts, isGestor } =
    useContractContext();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const TEAL = "#0bbcaf";

  // ── Admin de contrato: bloco estático ─────────────────────────────────────
  if (!isGestor) {
    return (
      <div
        className="px-2 py-2.5"
        style={{ borderBottom: "1px solid rgba(192,212,208,0.08)" }}
      >
        <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1.5"
           style={{ color: "rgba(61,90,86,1)" }}>
          Contrato
        </p>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
          style={{
            background: "rgba(251,191,36,0.05)",
            border: "1px solid rgba(251,191,36,0.18)",
          }}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#fbbf24" }} />
          <span className="text-[12px] font-semibold truncate" style={{ color: "#f1f5f9" }}>
            {selectedContract?.name ?? "—"}
          </span>
        </div>
      </div>
    );
  }

  // ── Gestor master: seletor interativo ─────────────────────────────────────
  return (
    <div
      className="px-2 py-2.5"
      style={{ borderBottom: "1px solid rgba(192,212,208,0.08)", position: "relative" }}
      ref={ref}
    >
      <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-1.5"
         style={{ color: "rgba(61,90,86,1)" }}>
        Contrato ativo
      </p>

      {/* Botão do seletor */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors"
        style={{
          background: open ? "rgba(11,188,175,0.14)" : "rgba(11,188,175,0.07)",
          border: `1px solid rgba(11,188,175,${open ? "0.4" : "0.22"})`,
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(11,188,175,0.12)";
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(11,188,175,0.07)";
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: TEAL }} />
        <span className="flex-1 text-[12px] font-semibold truncate" style={{ color: "#f1f5f9" }}>
          {selectedContract?.name ?? "Todos os contratos"}
        </span>
        {open
          ? <ChevronUp  className="h-3 w-3 shrink-0" style={{ color: TEAL }} />
          : <ChevronDown className="h-3 w-3 shrink-0" style={{ color: "rgba(61,90,86,1)" }} />}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-2 right-2 z-50 rounded-xl overflow-hidden"
          style={{
            top: "calc(100% - 4px)",
            background: "#1a2030",
            border: "1px solid rgba(11,188,175,0.22)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(11,188,175,0.06)",
          }}
          role="listbox"
        >
          <div className="px-3 pt-2.5 pb-1 text-[9px] font-semibold uppercase tracking-widest"
               style={{ color: "rgba(61,90,86,1)" }}>
            Trocar contrato
          </div>

          {/* Lista de contratos */}
          {contracts.map(c => {
            const isActive = c.id === selectedContractId;
            return (
              <button
                key={c.id}
                role="option"
                aria-selected={isActive}
                onClick={() => { setSelectedContractId(c.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors"
                style={{
                  background: isActive ? "rgba(11,188,175,0.1)" : "transparent",
                  color: isActive ? "#f1f5f9" : "rgba(192,212,208,0.65)",
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: isActive ? TEAL : "rgba(61,90,86,1)" }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-medium truncate">{c.name}</span>
                  {(c.projectCount !== undefined || c.slaCount !== undefined) && (
                    <span className="block text-[10px]" style={{ color: "rgba(71,85,105,1)" }}>
                      {c.projectCount ?? 0} projeto{c.projectCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: TEAL }} />}
              </button>
            );
          })}

          {/* Separador + opção "Todos" */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
          <button
            role="option"
            aria-selected={selectedContractId === null}
            onClick={() => { setSelectedContractId(null); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 pb-2.5 text-left transition-colors"
            style={{
              background: selectedContractId === null ? "rgba(11,188,175,0.08)" : "transparent",
              color: selectedContractId === null ? "#f1f5f9" : "rgba(100,116,139,1)",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#94a3b8"}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color =
                selectedContractId === null ? "#f1f5f9" : "rgba(100,116,139,1)";
            }}
          >
            <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(100,116,139,1)" }} />
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-medium">Todos os contratos</span>
              <span className="block text-[10px]" style={{ color: "rgba(71,85,105,1)" }}>visão consolidada</span>
            </span>
            {selectedContractId === null && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: TEAL }} />}
          </button>
        </div>
      )}
    </div>
  );
}
