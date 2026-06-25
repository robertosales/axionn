import type {
  ParsedApfBaselineWorkbook,
  ParsedBaselineItem,
} from "./apfBaselineParser";

export interface ApfBaselineIntegrityReport {
  errors: string[];
  warnings: string[];
  itemCount: number;
  measurableCount: number;
  nonMeasurableCount: number;
  calculatedPfBruto: number;
  calculatedPfSimples: number;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function groupValues(
  items: ParsedBaselineItem[],
  key: (item: ParsedBaselineItem) => string,
  value: (item: ParsedBaselineItem) => number,
) {
  const groups = new Map<string, Set<number>>();
  for (const item of items) {
    const groupKey = key(item);
    const values = groups.get(groupKey) ?? new Set<number>();
    values.add(round2(value(item)));
    groups.set(groupKey, values);
  }
  return groups;
}

export function validateApfBaselineIntegrity(
  baseline: ParsedApfBaselineWorkbook,
): ApfBaselineIntegrityReport {
  const errors: string[] = [];
  const warnings = [...baseline.warnings];
  const measurable = baseline.items.filter((item) => item.is_measurable);
  const nonMeasurable = baseline.items.filter((item) => !item.is_measurable);
  const calculatedPfBruto = round2(
    baseline.items.reduce((sum, item) => sum + item.pf_bruto, 0),
  );
  const calculatedPfSimples = round2(
    baseline.items.reduce((sum, item) => sum + item.pf_fs, 0),
  );

  if (measurable.length === 0) {
    errors.push("A baseline não possui itens mensuráveis.");
  }

  const typeWeights = groupValues(
    measurable,
    (item) => item.function_sigla,
    (item) => item.pf_bruto,
  );
  for (const [sigla, weights] of typeWeights) {
    if (weights.size > 1) {
      errors.push(
        `O tipo ${sigla} possui pesos divergentes: ${[...weights].join(", ")}.`,
      );
    }
    if ([...weights].some((weight) => weight <= 0)) {
      errors.push(`O tipo ${sigla} possui peso contratual inválido.`);
    }
  }

  const factorPercentages = groupValues(
    measurable,
    (item) => item.factor_sigla,
    (item) => item.contribution_pct,
  );
  for (const [sigla, percentages] of factorPercentages) {
    if (percentages.size > 1) {
      errors.push(
        `O fator ${sigla} possui percentuais divergentes: ${[...percentages].join(", ")}.`,
      );
    }
    if ([...percentages].some((percentage) => percentage <= 0 || percentage > 100)) {
      errors.push(`O fator ${sigla} possui percentual inválido.`);
    }
  }

  for (const item of measurable) {
    const expectedPfSimples = round2(
      item.pf_bruto * item.contribution_pct / 100,
    );
    if (Math.abs(expectedPfSimples - item.pf_fs) > 0.02) {
      errors.push(
        `${item.item_ref}: PF Simples ${item.pf_fs.toFixed(2)} diverge do cálculo ${expectedPfSimples.toFixed(2)}.`,
      );
    }
    if (!item.function_sigla || item.function_sigla === "N/A") {
      errors.push(`${item.item_ref}: item mensurável sem tipo funcional.`);
    }
    if (!item.factor_sigla || item.factor_sigla === "N/A") {
      errors.push(`${item.item_ref}: item mensurável sem fator de impacto.`);
    }
  }

  if (
    baseline.expectedPfBruto != null
    && Math.abs(baseline.expectedPfBruto - calculatedPfBruto) > 0.02
  ) {
    errors.push(
      `PF Bruto total divergente: planilha ${baseline.expectedPfBruto.toFixed(2)}, itens ${calculatedPfBruto.toFixed(2)}.`,
    );
  }

  if (
    baseline.expectedPfFs != null
    && Math.abs(baseline.expectedPfFs - calculatedPfSimples) > 0.02
  ) {
    errors.push(
      `PF Simples total divergente: planilha ${baseline.expectedPfFs.toFixed(2)}, itens ${calculatedPfSimples.toFixed(2)}.`,
    );
  }

  if (baseline.expectedPfBruto == null) {
    warnings.push("A planilha não informa o total esperado de PF Bruto.");
  }
  if (baseline.expectedPfFs == null) {
    warnings.push("A planilha não informa o total esperado de PF Simples/PF FS.");
  }

  const rowsWithoutHuRef = baseline.items.filter(
    (item) => item.item_ref.startsWith("ROW-"),
  );
  if (rowsWithoutHuRef.length) {
    warnings.push(
      `${rowsWithoutHuRef.length} item(ns) não possuem referência explícita de HU.`,
    );
  }

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    itemCount: baseline.items.length,
    measurableCount: measurable.length,
    nonMeasurableCount: nonMeasurable.length,
    calculatedPfBruto,
    calculatedPfSimples,
  };
}
