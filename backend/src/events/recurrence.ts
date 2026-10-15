import { BadRequestException } from '@nestjs/common';

export type RecurrenceFrequency = 'weekly' | 'biweekly';

export const MAX_OCCURRENCES = 104;
const MAX_SPAN_DAYS = 800;

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

function wallTimeOf(timeZone: string, at: Date): WallTime {
  const shifted = new Date(at.getTime() + offsetMs(timeZone, at));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function wallToUtc(timeZone: string, wall: WallTime): Date {
  const guess = Date.UTC(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
  );
  const first = offsetMs(timeZone, new Date(guess));
  let result = guess - first;
  const second = offsetMs(timeZone, new Date(result));
  if (second !== first) result = guess - second;
  return new Date(result);
}

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new BadRequestException('Unknown time zone');
  }
}

/**
 * Start instants of a repeating event. The local wall-clock time stays the
 * same across daylight saving changes (18:30 stays 18:30), which is why the
 * time zone is part of the input. The first occurrence is `first` itself.
 */
export function occurrenceStarts(
  first: Date,
  frequency: RecurrenceFrequency,
  timeZone: string,
  limit: { until?: Date; count?: number },
): Date[] {
  assertTimeZone(timeZone);
  if (!limit.until && !limit.count) {
    throw new BadRequestException('Set an end date or a number of events');
  }
  const stepDays = frequency === 'biweekly' ? 14 : 7;
  const max = Math.min(limit.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const wall = wallTimeOf(timeZone, first);
  const lastAllowed = limit.until
    ? limit.until.getTime()
    : first.getTime() + MAX_SPAN_DAYS * 86_400_000;

  const starts: Date[] = [];
  for (let index = 0; index < max; index += 1) {
    const start = wallToUtc(timeZone, {
      ...wall,
      day: wall.day + index * stepDays,
    });
    if (index > 0 && start.getTime() > lastAllowed) break;
    if (start.getTime() - first.getTime() > MAX_SPAN_DAYS * 86_400_000) break;
    starts.push(start);
  }
  return starts;
}
