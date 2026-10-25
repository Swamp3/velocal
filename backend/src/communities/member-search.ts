export const MEMBER_PAGE_SIZE = 30;

/** Makes `%`, `_` and `\` in a search text match themselves in an ILIKE pattern. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
