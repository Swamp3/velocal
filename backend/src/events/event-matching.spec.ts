import {
  distinguishingTokens,
  compareEvents,
  distanceKm,
  normalizeText,
  similarity,
} from './event-matching';

describe('event matching', () => {
  it('normalizes accents, punctuation, years and edition numbers', () => {
    expect(normalizeText('  38. Rund um Köln 2027!  ')).toBe('rund um koln');
    expect(normalizeText('Große Straße')).toBe('grosse strasse');
  });

  it('scores identical and contained names high, different names low', () => {
    expect(similarity('Rund um Köln', 'RUND UM KÖLN 2027')).toBe(1);
    expect(
      similarity('Rund um Köln', 'Rund um Köln Elite Männer'),
    ).toBeGreaterThan(0.9);
    expect(similarity('Rund um Köln', 'Sixdays Berlin')).toBeLessThan(0.4);
  });

  it('measures distance', () => {
    const km = distanceKm(
      { lat: 52.52, lng: 13.405 },
      { lat: 48.137, lng: 11.575 },
    );
    expect(km).toBeGreaterThan(480);
    expect(km).toBeLessThan(520);
    expect(distanceKm({ lat: 1, lng: 1 }, {})).toBeNull();
  });

  it('matches the same race listed with a different spelling and place name', () => {
    const r = compareEvents(
      {
        name: 'Rund um den Henninger Turm',
        locationName: 'Frankfurt am Main',
        lat: 50.11,
        lng: 8.68,
      },
      {
        name: 'Rund um den Henninger-Turm 2027',
        locationName: 'Frankfurt',
        lat: 50.12,
        lng: 8.69,
      },
    );
    expect(r.match).toBe(true);
    expect(r.reasons).toContain('sameName');
  });

  it('does not match different races in the same city', () => {
    const r = compareEvents(
      {
        name: 'Kriterium Berlin',
        locationName: 'Berlin',
        lat: 52.5,
        lng: 13.4,
      },
      { name: 'Gravel Marathon', locationName: 'Berlin', lat: 52.5, lng: 13.4 },
    );
    expect(r.match).toBe(false);
  });

  it('matches similar names at the same place but not far apart', () => {
    const base = { name: 'Frühjahrsrennen Cottbus', locationName: 'Cottbus' };
    expect(
      compareEvents(base, { name: 'Fruehjahrsrennen', locationName: 'Cottbus' })
        .match,
    ).toBe(true);
    expect(
      compareEvents(
        { ...base, lat: 51.7, lng: 14.3 },
        {
          name: 'Frühjahrsrennen Kiel',
          locationName: 'Kiel',
          lat: 54.3,
          lng: 10.1,
        },
      ).match,
    ).toBe(false);
  });
});

describe('distinguishing classes and rounds', () => {
  it('keeps different age classes and rounds at the same hall apart', () => {
    const hall = 'Kissing, Paartalhalle';
    expect(
      compareEvents(
        {
          name: 'Radball — Bayernliga U13 Süd — 1. Spieltag',
          locationName: hall,
        },
        {
          name: 'Radball — Bayernliga U17 Süd — 1. Spieltag',
          locationName: hall,
        },
      ).match,
    ).toBe(false);
    expect(
      compareEvents(
        { name: 'Landesliga Staffel 1 — 2. Spieltag', locationName: hall },
        { name: 'Landesliga Staffel 2 — 2. Spieltag', locationName: hall },
      ).match,
    ).toBe(false);
    expect(
      compareEvents(
        { name: '5er Bundesliga — Gruppe 1 - 3', locationName: hall },
        { name: '5er Bundesliga — Gruppe 2 - 4', locationName: hall },
      ).match,
    ).toBe(false);
  });

  it('still matches the same competition', () => {
    expect(
      compareEvents(
        { name: 'Bayernliga U13 Süd 1. Spieltag', locationName: 'Kissing' },
        { name: 'Bayernliga U13 Süd - 1 . Spieltag', locationName: 'Kissing' },
      ).match,
    ).toBe(true);
    expect(distinguishingTokens('Bayernliga U13 Süd - 1 . Spieltag')).toEqual(
      new Set(['u13', 'spieltag:1']),
    );
  });
});
