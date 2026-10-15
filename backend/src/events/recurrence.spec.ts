import { occurrenceStarts } from './recurrence';

describe('occurrenceStarts', () => {
  it('repeats weekly and keeps local time across the DST change', () => {
    // Wed 2026-03-18 18:30 Berlin (CET, UTC+1)
    const first = new Date('2026-03-18T17:30:00Z');
    const starts = occurrenceStarts(first, 'weekly', 'Europe/Berlin', {
      count: 3,
    });
    expect(starts.map((d) => d.toISOString())).toEqual([
      '2026-03-18T17:30:00.000Z',
      '2026-03-25T17:30:00.000Z', // still CET
      '2026-04-01T16:30:00.000Z', // CEST (UTC+2): still 18:30 local
    ]);
  });

  it('stops at the until date', () => {
    const first = new Date('2026-06-03T16:30:00Z');
    const starts = occurrenceStarts(first, 'weekly', 'Europe/Berlin', {
      until: new Date('2026-06-24T23:59:00Z'),
    });
    expect(starts).toHaveLength(4);
  });

  it('supports every second week', () => {
    const first = new Date('2026-06-03T16:30:00Z');
    const starts = occurrenceStarts(first, 'biweekly', 'Europe/Berlin', {
      count: 3,
    });
    expect(starts[2].toISOString()).toBe('2026-07-01T16:30:00.000Z');
  });

  it('rejects an unknown time zone and a missing limit', () => {
    const first = new Date('2026-06-03T16:30:00Z');
    expect(() =>
      occurrenceStarts(first, 'weekly', 'Mars/Base', { count: 2 }),
    ).toThrow();
    expect(() => occurrenceStarts(first, 'weekly', 'UTC', {})).toThrow();
  });
});
