import { timeLeft } from './time-left';

describe('timeLeft', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const at = (ms: number) => new Date(now + ms).toISOString();

  it('returns null when the end has passed', () => {
    expect(timeLeft(at(-1), now)).toBeNull();
    expect(timeLeft(at(0), now)).toBeNull();
  });

  it('uses minutes below an hour, at least one', () => {
    expect(timeLeft(at(1_000), now)).toEqual({ unit: 'minutes', value: 1 });
    expect(timeLeft(at(45 * 60_000), now)).toEqual({ unit: 'minutes', value: 45 });
  });

  it('uses hours below a day', () => {
    expect(timeLeft(at(3 * 3_600_000 - 1), now)).toEqual({ unit: 'hours', value: 3 });
    expect(timeLeft(at(23 * 3_600_000), now)).toEqual({ unit: 'hours', value: 23 });
  });

  it('uses days from 24 hours on, rounded up', () => {
    expect(timeLeft(at(24 * 3_600_000), now)).toEqual({ unit: 'days', value: 1 });
    expect(timeLeft(at(2.2 * 86_400_000), now)).toEqual({ unit: 'days', value: 3 });
  });
});
