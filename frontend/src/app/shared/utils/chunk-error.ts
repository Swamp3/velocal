/**
 * Whether an error comes from a lazy-loaded script that could not be fetched. After a deployment
 * the old file names are gone, so a page that was opened before the update fails to load the page
 * the visitor navigates to.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \S+ failed/i.test(
    message,
  );
}
