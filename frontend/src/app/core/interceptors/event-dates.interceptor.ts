import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Midnight of the instant's German calendar day, in the viewer's own time zone. */
export function localDayOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const [y, m, d] = BERLIN_DAY.format(date).split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** Copy of the value with every day-only event's dates moved to local midnight. */
function withLocalDays(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withLocalDays);
  if (!value || typeof value !== 'object') return value;
  const copy: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) copy[key] = withLocalDays(field);
  if (copy['startTimeKnown'] === false) {
    for (const key of ['startDate', 'endDate']) {
      if (typeof copy[key] === 'string') copy[key] = localDayOf(copy[key] as string);
    }
  }
  return copy;
}

/**
 * Events without a start time are stored as midnight in Germany. Shown as they are, a viewer west
 * of Germany would see the day before. This moves them to local midnight of the same day once, at
 * the API boundary, so every date pipe and calendar shows the right day.
 */
export const eventDatesInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event) =>
      event instanceof HttpResponse && event.body && typeof event.body === 'object'
        ? event.clone({ body: withLocalDays(event.body) })
        : event,
    ),
  );
