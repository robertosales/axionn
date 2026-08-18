export interface ExtractedApfCriterion {
  stableId: string;
  sortOrder: number;
  originalText: string;
  expectedBehavior: string;
}
export interface ExtractedApfSpecification {
  objective: string | null;
  actors: string[];
  businessRules: string[];
  functionalObjects: string[];
  operations: string[];
  boundaries: string[];
  nonFunctionalRequirements: string[];
  criteria: ExtractedApfCriterion[];
}
const criterionHeading =
  /^(?:#{1,6}\s*)?(?:crit[eé]rios?\s+de\s+aceite|acceptance\s+criteria)\s*:?(.*)$/i;
const numbered =
  /^(?:[-*•]\s*)?(?:(CA[-\s]?\d+)|(?:\d+)[.)])\s*[:.-]?\s*(.+)$/i;
const sections = [
  {
    key: "objective",
    pattern: /^(?:#{1,6}\s*)?(?:objetivo|descri[cç][aã]o|vis[aã]o)\s*:?(.*)$/i,
    single: true,
  },
  {
    key: "actors",
    pattern: /^(?:#{1,6}\s*)?(?:atores?|perfis?|usu[aá]rios?)\s*:?(.*)$/i,
  },
  {
    key: "businessRules",
    pattern:
      /^(?:#{1,6}\s*)?(?:regras?\s+de\s+neg[oó]cio|business\s+rules?)\s*:?(.*)$/i,
  },
  {
    key: "functionalObjects",
    pattern:
      /^(?:#{1,6}\s*)?(?:objetos?\s+funcionais?|entidades?|dados?)\s*:?(.*)$/i,
  },
  {
    key: "operations",
    pattern:
      /^(?:#{1,6}\s*)?(?:opera[cç][oõ]es?|funcionalidades?|a[cç][oõ]es?)\s*:?(.*)$/i,
  },
  {
    key: "boundaries",
    pattern:
      /^(?:#{1,6}\s*)?(?:fronteiras?|sistemas?\s+envolvidos?|escopo)\s*:?(.*)$/i,
  },
  {
    key: "nonFunctionalRequirements",
    pattern:
      /^(?:#{1,6}\s*)?(?:requisitos?\s+n[aã]o\s+funcionais?|rnf)\s*:?(.*)$/i,
  },
] as const;
const clean = (value: string) =>
  value
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
export function extractApfSpecificationFromText(
  content: string,
): ExtractedApfSpecification {
  const lines = content
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim());
  const values: Record<string, string[]> = {
    actors: [],
    businessRules: [],
    functionalObjects: [],
    operations: [],
    boundaries: [],
    nonFunctionalRequirements: [],
  };
  let objective: string | null = null;
  let active: string | null = null;
  const criteriaText: string[] = [];
  let inCriteria = false;
  for (const line of lines) {
    if (!line) continue;
    const criterion = line.match(criterionHeading);
    if (criterion) {
      inCriteria = true;
      active = null;
      if (criterion[1]?.trim()) criteriaText.push(clean(criterion[1]));
      continue;
    }
    const section = sections.find((item) => item.pattern.test(line));
    if (section) {
      inCriteria = false;
      const match = line.match(section.pattern);
      const inline = clean(match?.[1] ?? "");
      if ("single" in section && section.single) {
        objective = inline || objective;
        active = "objective";
      } else {
        active = section.key;
        if (inline) values[section.key].push(inline);
      }
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      active = null;
      inCriteria = false;
      continue;
    }
    const match = line.match(numbered);
    if ((inCriteria && (match || /^[-*•]\s+/.test(line))) || match?.[1]) {
      criteriaText.push(clean(match?.[2] ?? line));
      continue;
    }
    if (active === "objective" && !objective) objective = clean(line);
    else if (
      active &&
      active !== "objective" &&
      (match || /^[-*•]\s+/.test(line))
    )
      values[active].push(clean(match?.[2] ?? line));
  }
  const unique = (items: string[]) => [
    ...new Set(
      items
        .map((value) => value.replace(/\s+/g, " "))
        .filter((value) => value.length >= 2),
    ),
  ];
  const criteria = unique(criteriaText)
    .slice(0, 200)
    .map((originalText, index) => ({
      stableId: `CA-${String(index + 1).padStart(2, "0")}`,
      sortOrder: index,
      originalText,
      expectedBehavior: originalText,
    }));
  return {
    objective,
    actors: unique(values.actors),
    businessRules: unique(values.businessRules),
    functionalObjects: unique(values.functionalObjects),
    operations: unique(values.operations),
    boundaries: unique(values.boundaries),
    nonFunctionalRequirements: unique(values.nonFunctionalRequirements),
    criteria,
  };
}
export const extractApfCriteriaFromText = (content: string) =>
  extractApfSpecificationFromText(content).criteria;
