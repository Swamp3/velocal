import { normalizeStravaProfile } from './strava-profile';

describe('normalizeStravaProfile', () => {
  it('turns an athlete id into a profile link', () => {
    expect(normalizeStravaProfile(' 12345678 ')).toBe(
      'https://www.strava.com/athletes/12345678',
    );
  });

  it('accepts profile links and drops query and fragment', () => {
    expect(
      normalizeStravaProfile('https://strava.com/athletes/12345678?oq=x#top'),
    ).toBe('https://www.strava.com/athletes/12345678');
    expect(
      normalizeStravaProfile('https://www.strava.com/athletes/some_name/'),
    ).toBe('https://www.strava.com/athletes/some_name');
  });

  it('treats blank input as not set', () => {
    expect(normalizeStravaProfile('   ')).toBeNull();
  });

  it('rejects other hosts, schemes and shapes', () => {
    for (const bad of [
      'http://www.strava.com/athletes/1',
      'https://evil.example/athletes/1',
      'https://www.strava.com.evil.example/athletes/1',
      'https://www.strava.com/clubs/1',
      'javascript:alert(1)',
      'not a link',
    ]) {
      expect(() => normalizeStravaProfile(bad)).toThrow();
    }
  });
});
