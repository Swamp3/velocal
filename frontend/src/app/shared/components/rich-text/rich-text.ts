/** Visible text, so an empty Quill document (`<p><br></p>`) counts as blank. */
export function plainText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stores `''` when the editor has no visible text. */
export function normalizeRichText(value: string | null | undefined): string {
  const raw = value ?? '';
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
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return escapeHtml(raw).replace(/\n/g, '<br>');
}
