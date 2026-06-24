import type { ContractualItem, HuRow } from "../types/apfItem.types";

export function buildStoryText(hu: HuRow): string {
  return [
    `Código interno: ${hu.code}`,
    `Título: ${hu.title}`,
    hu.description?.trim() ? `Descrição:\n${hu.description.trim()}` : "",
    hu.acceptance_criteria?.trim()
      ? `Critérios de Aceite:\n${hu.acceptance_criteria.trim()}`
      : "",
  ].filter(Boolean).join("\n\n");
}

export const effectiveFunction = (item: ContractualItem) =>
  item.corrected_function_sigla ?? item.function_sigla;

export const effectiveFactor = (item: ContractualItem) =>
  item.corrected_factor_sigla ?? item.factor_sigla;

export const effectivePfBruto = (item: ContractualItem) =>
  Number(item.corrected_pf_bruto ?? item.pf_bruto ?? 0);

export const effectivePfFs = (item: ContractualItem) =>
  Number(item.corrected_pf_fs ?? item.pf_fs ?? 0);

export const calculatePfFs = (weight: number, pct: number) =>
  Math.round((weight * pct) / 100 * 100) / 100;

export function extractHuRefs(value: string): string[] {
  return [...value.matchAll(/\bHU\s*(\d+(?:\.\d+)?)\b/gi)]
    .map((match) => `HU${match[1]}`.toUpperCase());
}
