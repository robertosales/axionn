const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCurrencyBRL(value: number | null | undefined): string {
  return brl.format(Number.isFinite(value as number) ? (value as number) : 0);
}

export function parseBRLInput(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
