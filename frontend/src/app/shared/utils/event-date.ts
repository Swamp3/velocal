/**
 * Returns true when the ISO datetime has a non-midnight time component,
 * i.e. the event has a meaningful start time worth displaying.
 */
export function hasTime(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/**
 * Formats the time portion of an ISO datetime as `HH:mm` (24h).
 * Returns `null` if the time is midnight (00:00), meaning no explicit time was set.
 */
export function formatTime(iso: string | null | undefined): string | null {
  if (!iso || !hasTime(iso)) return null;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Formats a date range for display using the given Intl locale.
 */
export function formatDateRange(
  start: string,
  end?: string | null,
  locale = 'de-DE',
): string {
  const dateOpts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const startDate = new Date(start);
  let result = startDate.toLocaleDateString(locale, dateOpts);

  const startTime = formatTime(start);
  if (startTime) {
    result += `, ${startTime}`;
  }

  if (end && end !== start) {
    const endDate = new Date(end);
    const sameDay = startDate.toDateString() === endDate.toDateString();

    if (!sameDay) {
      result += ' – ' + endDate.toLocaleDateString(locale, dateOpts);
    }

    const endTime = formatTime(end);
    if (endTime) {
      result += sameDay ? ` – ${endTime}` : `, ${endTime}`;
    }
  }

  return result;
}
