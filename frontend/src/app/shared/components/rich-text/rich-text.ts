/** Visible text, so an empty Quill document (`<p><br></p>`) counts as blank. */
export function plainText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quill's `getSemanticHTML()` writes every space as `&nbsp;`. Non-breaking spaces never wrap,
 * so a long comment would only break inside words. Turn them back into normal spaces.
 */
export function normalSpaces(html: string): string {
  return html.replace(/&nbsp;|\u00a0/gi, ' ');
}

/** Stores `''` when the editor has no visible text. */
export function normalizeRichText(value: string | null | undefined): string {
  const raw = normalSpaces(value ?? '');
  return plainText(raw) ? raw : '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML for display. Plain text keeps its line breaks. Angular still sanitizes `[innerHTML]`. */
export function toDisplayHtml(value: string | null | undefined): string {
  const raw = value?.trim() ?? '';
  if (!raw) return '';
  // Older content was saved with `&nbsp;` for every space; show it with normal, wrappable spaces.
  if (/<[a-z][\s\S]*>/i.test(raw)) return normalSpaces(raw);
  return escapeHtml(raw).replace(/\n/g, '<br>');
}
