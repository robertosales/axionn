/**
 * Conversões para campos de duração no formato HH:MM (ou H:MM).
 *
 * - parseHmToMinutes("1:30")        -> 90
 * - parseHmToMinutes("0:48")        -> 48
 * - parseHmToMinutes("2")           -> 120 (apenas horas)
 * - parseHmToMinutes("0,8")         -> 48 (compat. com lançamentos antigos)
 * - minutesToHm(90)                 -> "1:30"
 * - hoursDecimalToMinutes(0.8)      -> 48
 * - formatMinutes(90)               -> "1h 30min"
 * - formatMinutes(120)              -> "2h"
 * - formatMinutes(30)               -> "0h 30min"
 * - sumDecimalsAsMinutes([1.25, 0.5]) -> "1h 45min"
 */

export function parseHmToMinutes(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    if (!isFinite(input) || input < 0) return null;
    return Math.round(input * 60);
  }
  const s = String(input).trim().replace(",", ".");
  if (!s) return null;

  // Formato HH:MM
  if (s.includes(":")) {
    const m = /^(\d{1,3}):([0-5]?\d)$/.exec(s);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(mm)) return null;
    return h * 60 + mm;
  }

  // Formato decimal (compatibilidade)
  const dec = parseFloat(s);
  if (!isFinite(dec) || dec < 0) return null;
  return Math.round(dec * 60);
}

export function minutesToHm(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(minutes ?? 0)));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}:${String(r).padStart(2, "0")}`;
}

export function hoursDecimalToMinutes(hours: number | null | undefined): number {
  if (!hours || !isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * 60);
}

export function minutesToHoursDecimal(minutes: number | null | undefined): number {
  const m = Math.max(0, Math.round(Number(minutes ?? 0)));
  return Math.round((m / 60) * 100) / 100; // 2 casas
}

/** Validação amigável usada nos formulários */
export function isValidHm(input: string): boolean {
  if (!input) return false;
  return parseHmToMinutes(input) !== null;
}

/**
 * Formata um total de minutos no padrão legível "Xh Ymin".
 *
 * Exemplos:
 *   formatMinutes(90)  → "1h 30min"
 *   formatMinutes(120) → "2h"
 *   formatMinutes(30)  → "0h 30min"
 *   formatMinutes(0)   → "0h"
 */
export function formatMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h    = Math.floor(safe / 60);
  const min  = safe % 60;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}min`;
}

/**
 * Recebe um array de valores decimais de horas (como armazenados no banco),
 * converte cada um para minutos, soma e retorna a string formatada.
 *
 * Exemplos:
 *   sumDecimalsAsMinutes([1.25, 0.5])  → "1h 45min"
 *   sumDecimalsAsMinutes([2, 1])       → "3h"
 *   sumDecimalsAsMinutes([])           → "0h"
 */
export function sumDecimalsAsMinutes(values: (number | null | undefined)[]): string {
  const totalMin = values.reduce<number>((acc, v) => {
    const n = Number(v ?? 0);
    return acc + (isFinite(n) ? Math.round(n * 60) : 0);
  }, 0);
  return formatMinutes(totalMin);
}
