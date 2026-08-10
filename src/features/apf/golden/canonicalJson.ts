export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue | undefined };

const DEFAULT_IGNORED_FIELDS = new Set([
  "created_at",
  "updated_at",
  "created_by",
  "random_id",
  "request_id",
]);

export interface CanonicalJsonOptions {
  ignoredFields?: ReadonlySet<string>;
}

function canonicalize(value: CanonicalJsonValue, ignoredFields: ReadonlySet<string>): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new TypeError(
        "Canonical JSON accepts only safe integer numbers; financial decimals must be strings.",
      );
    }
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item, ignoredFields)).join(",")}]`;
  }

  const entries = Object.entries(value)
    .filter(([key, item]) => !ignoredFields.has(key) && item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  return `{${entries.map(([key, item]) => (
    `${JSON.stringify(key.normalize("NFC"))}:${canonicalize(item as CanonicalJsonValue, ignoredFields)}`
  )).join(",")}}`;
}

export function canonicalJson(
  value: CanonicalJsonValue,
  options: CanonicalJsonOptions = {},
): string {
  return canonicalize(value, options.ignoredFields ?? DEFAULT_IGNORED_FIELDS);
}

export function canonicalDecimal(value: string): string {
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new TypeError(`Invalid decimal: ${value}`);
  const [, sign, integerPart, fractionPart = ""] = match;
  const integer = integerPart.replace(/^0+(?=\d)/, "");
  const fraction = fractionPart.replace(/0+$/, "");
  const zero = integer === "0" && fraction === "";
  return `${zero ? "" : sign}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function canonicalTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid timestamp: ${value}`);
  return date.toISOString();
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

export async function canonicalJsonSha256(
  value: CanonicalJsonValue,
  options?: CanonicalJsonOptions,
): Promise<{ canonical: string; sha256: string }> {
  const canonical = canonicalJson(value, options);
  return { canonical, sha256: await sha256Hex(canonical) };
}
