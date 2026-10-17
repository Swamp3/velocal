export type TimeLeft = { unit: 'minutes' | 'hours' | 'days'; value: number };

/**
 * How long until `end`, in the largest unit that is at least one: days, then hours, then minutes
 * (never below 1). Returns null once the time has passed.
 */
export function timeLeft(end: string | Date, now: number = Date.now()): TimeLeft | null {
  const ms = new Date(end).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return { unit: 'minutes', value: Math.max(1, minutes) };
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return { unit: 'hours', value: hours };
  return { unit: 'days', value: Math.ceil(ms / 86_400_000) };
}
