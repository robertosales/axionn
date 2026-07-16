const ACCEPTANCE_HEADING = /^(?:#{1,6}\s*)?(?:\*\*)?crit[eé]rios?\s+de\s+aceite\s*:?(?:\*\*)?\s*$/im;

export function parseUserStoryContent(value: unknown): { content: string; acceptanceCriteria: string | null } {
  const content = typeof value === "string" ? value.trim() : "";
  const match = ACCEPTANCE_HEADING.exec(content);
  return {
    content,
    acceptanceCriteria: match ? content.slice(match.index + match[0].length).trim() || null : null,
  };
}

