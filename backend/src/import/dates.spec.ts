import { berlinDay, berlinMidnight, parseEventDate } from './dates';

describe('berlinMidnight', () => {
  it('uses +02:00 in summer and +01:00 in winter', () => {
    expect(berlinMidnight(2026, 7, 1).toISOString()).toBe(
      '2026-06-30T22:00:00.000Z',
    );
    expect(berlinMidnight(2026, 12, 6).toISOString()).toBe(
      '2026-12-05T23:00:00.000Z',
    );
  });

  it('handles the days of the clock change', () => {
    // 25 Oct 2026: clocks go back at 03:00, midnight is still summer time.
    expect(berlinMidnight(2026, 10, 25).toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    );
    expect(berlinMidnight(2026, 10, 26).toISOString()).toBe(
      '2026-10-25T23:00:00.000Z',
    );
    expect(berlinMidnight(2027, 3, 28).toISOString()).toBe(
      '2027-03-27T23:00:00.000Z',
    );
  });
});

describe('parseEventDate', () => {
  it('reads a day', () => {
    const parsed = parseEventDate('2026-10-24');
    expect(parsed.kind).toBe('date');
    if (parsed.kind === 'date')
      expect(berlinDay(parsed.date)).toBe('2026-10-24');
  });

  it('reads a date-time with offset', () => {
    const parsed = parseEventDate('2026-10-25T09:00:00+01:00');
    expect(parsed).toEqual({
      kind: 'dateTime',
      date: new Date('2026-10-25T08:00:00Z'),
    });
  });

  it('refuses a date-time without offset and impossible dates', () => {
    expect(parseEventDate('2026-10-25T09:00:00').kind).toBe('missingOffset');
    expect(parseEventDate('2026-02-30').kind).toBe('invalid');
    expect(parseEventDate('24.10.2026').kind).toBe('invalid');
    expect(parseEventDate('2026-10-25T25:00:00+01:00').kind).toBe('invalid');
  });
});
