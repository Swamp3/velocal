/** All events are shown in German local time. */
export const EVENT_TIME_ZONE = 'Europe/Berlin';

const WALL = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Wall-clock time in Europe/Berlin for an instant, as milliseconds "as if UTC". */
function wallMs(instant: number): number {
  const parts = Object.fromEntries(
    WALL.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

/** Midnight in Europe/Berlin of the given calendar day. */
export function berlinMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  const offset = wallMs(guess) - guess;
  let result = guess - offset;
  // Across a DST change the offset of the result can differ from the guess.
  const offset2 = wallMs(result) - result;
  if (offset2 !== offset) result = guess - offset2;
  return new Date(result);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

export type ParsedDate =
  | { kind: 'date'; date: Date }
  | { kind: 'dateTime'; date: Date }
  | { kind: 'missingOffset' }
  | { kind: 'invalid' };

function realDay(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
  );
}

/**
 * Reads `YYYY-MM-DD` (day only, stored as Berlin midnight) or an ISO date-time with offset.
 * A date-time without offset is refused: it is unclear which time zone is meant.
 */
export function parseEventDate(value: string): ParsedDate {
  const day = DATE_ONLY.exec(value);
  if (day) {
    const [y, m, d] = [Number(day[1]), Number(day[2]), Number(day[3])];
    if (!realDay(y, m, d)) return { kind: 'invalid' };
    return { kind: 'date', date: berlinMidnight(y, m, d) };
  }
  const dt = DATE_TIME.exec(value);
  if (!dt) return { kind: 'invalid' };
  if (!realDay(Number(dt[1]), Number(dt[2]), Number(dt[3])))
    return { kind: 'invalid' };
  if (Number(dt[4]) > 23 || Number(dt[5]) > 59) return { kind: 'invalid' };
  if (!dt[7]) return { kind: 'missingOffset' };
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? { kind: 'invalid' }
    : { kind: 'dateTime', date };
}

/** `YYYY-MM-DD` of the instant in Europe/Berlin. */
export function berlinDay(date: Date): string {
  return new Date(wallMs(date.getTime())).toISOString().slice(0, 10);
}

/** `HH:mm` of the instant in Europe/Berlin. */
export function berlinTimeOfDay(date: Date): string {
  return new Date(wallMs(date.getTime())).toISOString().slice(11, 16);
}
