/**
 * Renders the small subset of inline Markdown used in CHANGELOG.md bullets
 * (`**bold**`, `` `code` ``, `[text](url)`) to HTML. Not a general Markdown
 * parser — just enough for changelog entries, which are plain, trusted,
 * repo-authored text.
 */
export function renderInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
