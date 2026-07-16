const ACCEPTANCE_HEADING = /^(?:#{1,6}\s*)?(?:\*\*)?crit[eé]rios?\s+de\s+aceite\s*:?(?:\*\*)?\s*$/im;

export interface UserStoryContentParts {
  content: string;
  acceptanceCriteria: string;
}

export function splitUserStoryContent(value?: string | null): UserStoryContentParts {
  const content = (value ?? "").trim();
  const match = ACCEPTANCE_HEADING.exec(content);
  if (!match) return { content, acceptanceCriteria: "" };

  return {
    content,
    acceptanceCriteria: content.slice(match.index + match[0].length).trim(),
  };
}

export function buildUnifiedUserStoryContent(
  description?: string | null,
  acceptanceCriteria?: string | null,
): string {
  const content = (description ?? "").trim();
  const criteria = (acceptanceCriteria ?? "").trim();
  if (!criteria || ACCEPTANCE_HEADING.test(content)) return content;
  return `${content}${content ? "\n\n" : ""}## Critérios de Aceite\n\n${criteria}`;
}

