/**
 * Multipart body with one file in the field `file`. The server only treats a part as a file
 * when it has a file name, and some mobile pickers hand over files without one, so an empty
 * name is replaced.
 */
export function uploadForm(file: File, fallbackName: string): FormData {
  const form = new FormData();
  form.append('file', file, file.name?.trim() || fallbackName);
  return form;
}

/** Fallback file name for an image whose picker gave none, matching its type. */
export function imageFallbackName(file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  return `image.${ext}`;
}
