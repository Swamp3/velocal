import { locationQuality, validateImportFile } from './import-file';

const now = new Date('2026-10-24T08:00:00Z');
const base = {
  externalId: 'a1',
  name: 'Testrennen',
  startDate: '2026-11-01',
  disciplineSlug: 'strasse',
  locationName: 'Frankfurt',
  status: 'published',
};
const file = (events: unknown[], extra: Record<string, unknown> = {}) => ({
  sourceName: 'test-collector',
  events,
  ...extra,
});
const codes = (data: unknown) =>
  validateImportFile(data, now).issues.map(
    (i) => `${i.severity}:${i.code}${i.field ? `:${i.field}` : ''}`,
  );

describe('validateImportFile', () => {
  it('accepts a day-only event and stores Berlin midnight without time', () => {
    const result = validateImportFile(file([base]), now);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.events[0]?.startDate.toISOString()).toBe(
      '2026-10-31T23:00:00.000Z',
    );
    expect(result.events[0]?.startTimeKnown).toBe(false);
  });

  it('keeps a known start time', () => {
    const result = validateImportFile(
      file([{ ...base, startDate: '2026-11-01T09:30:00+01:00' }]),
      now,
    );
    expect(result.events[0]?.startTimeKnown).toBe(true);
  });

  it('reports errors per event and refuses that event', () => {
    const result = validateImportFile(
      file([
        {
          ...base,
          startDate: '01.11.2026',
          disciplineSlug: 'rennen',
          status: 'ok',
          locationName: 'TBD',
        },
        { ...base, externalId: 'a2', lat: 50 },
      ]),
      now,
    );
    expect(result.events).toEqual([null, null]);
    expect(
      codes(
        file([
          {
            ...base,
            startDate: '01.11.2026',
            disciplineSlug: 'rennen',
            status: 'ok',
            locationName: 'TBD',
          },
        ]),
      ),
    ).toEqual(
      expect.arrayContaining([
        'error:dateInvalid:startDate',
        'error:disciplineUnknown:disciplineSlug',
        'error:statusUnknown:status',
        'error:locationPlaceholder:locationName',
      ]),
    );
    expect(codes(file([{ ...base, lat: 50 }]))).toContain(
      'error:coordinatesIncomplete:lng',
    );
  });

  it('finds duplicate ids, missing offsets and unknown fields', () => {
    const c = codes(
      file([base, { ...base, endDate: '2026-11-02T10:00:00', foo: 1 }], {
        extra: true,
      }),
    );
    expect(c).toEqual(
      expect.arrayContaining([
        'warning:unknownField:extra',
        'error:duplicateExternalId:externalId',
        'error:dateNeedsOffset:endDate',
        'warning:unknownField:foo',
        'warning:sameNameSameDay:name',
      ]),
    );
  });

  it('keeps sources and conflicts and asks to confirm conflicts', () => {
    const result = validateImportFile(
      file([
        {
          ...base,
          source: [
            {
              name: 'Verband',
              url: 'https://example.org/a',
              checkedAt: '2026-10-24',
            },
          ],
          conflicts: [
            {
              field: 'startDate',
              values: ['2026-11-01', '2026-11-08'],
              reason: 'x',
            },
          ],
        },
      ]),
      now,
    );
    expect(result.events[0]?.sources).toEqual([
      {
        name: 'Verband',
        url: 'https://example.org/a',
        checkedAt: '2026-10-24',
      },
    ]);
    expect(result.events[0]?.conflicts).toHaveLength(1);
    expect(result.issues.map((i) => i.code)).toContain('hasConflicts');
  });

  it('warns about past events and refuses a broken file', () => {
    expect(codes(file([{ ...base, startDate: '2026-10-01' }]))).toContain(
      'warning:pastEvent:startDate',
    );
    expect(codes({ sourceName: 'X Y', events: [] })).toEqual([
      'error:sourceNameInvalid:sourceName',
      'error:eventsMissing:events',
    ]);
  });
});

describe('locationQuality', () => {
  it('tells missing, vague and real places apart', () => {
    expect(locationQuality('TBD')).toBe('missing');
    expect(
      locationQuality('Deutschland (Austragungsort nicht angegeben)'),
    ).toBe('missing');
    expect(
      locationQuality('Niedersachsen (Austragungsort nicht angegeben)'),
    ).toBe('missing');
    expect(
      locationQuality('Oelde, Austragungsort wird noch bekanntgegeben'),
    ).toBe('vague');
    expect(
      locationQuality(
        '73770 Denkendorf, Albert-Schweitzer-Schulsporthalle, Lenaustraße 3',
      ),
    ).toBe('ok');
    expect(locationQuality('München, Olympiapark')).toBe('ok');
  });

  it('reads classes: category fills ages, licence fields and distances', () => {
    const result = validateImportFile(
      file([
        {
          ...base,
          format: 'rtf',
          classes: [
            { name: 'U15', category: 'u15' },
            { name: 'Kurz', distanceKm: 42.26, elevationM: 450.4 },
            {
              name: 'Masters',
              license: 'license',
              dayLicense: true,
              licenseClasses: ['master', 'master'],
            },
          ],
        },
      ]),
      now,
    );
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const [event] = result.events;
    expect(event?.format).toBe('rtf');
    expect(event?.classes?.[0]).toMatchObject({
      category: 'u15',
      ageMin: 13,
      ageMax: 14,
      license: 'open',
    });
    expect(event?.classes?.[1]).toMatchObject({
      distanceKm: 42.3,
      elevationM: 450,
    });
    expect(event?.classes?.[2]).toMatchObject({
      dayLicense: true,
      licenseClasses: ['master'],
    });
  });

  it('refuses unknown formats, licences, categories and bad numbers', () => {
    expect(
      codes(
        file([
          {
            ...base,
            format: 'cyclo',
            classes: [
              {
                name: 'X',
                license: 'hobby',
                category: 'u99',
                licenseClasses: ['pro'],
                distanceKm: -1,
              },
            ],
          },
        ]),
      ),
    ).toEqual(
      expect.arrayContaining([
        'error:formatUnknown:format',
        'error:classLicenseUnknown:classes[0].license',
        'error:classCategoryUnknown:classes[0].category',
        'error:classLicenseClassUnknown:classes[0].licenseClasses',
        'error:numberInvalid:classes[0].distanceKm',
      ]),
    );
  });

  it('reads parking areas with several kinds and warns when one is far away', () => {
    const result = validateImportFile(
      file([
        {
          ...base,
          lat: 50.1109,
          lng: 8.6821,
          parking: [
            {
              name: 'P1 Sporthalle',
              kinds: ['participants', 'camper'],
              lat: 50.112,
              lng: 8.684,
              fee: 'free',
              openFrom: '07:00',
            },
            { name: 'Weit weg', kinds: ['spectators'], lat: 50.2, lng: 8.9 },
          ],
        },
      ]),
      now,
    );
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.issues.map((i) => i.code)).toContain('parkingFar');
    expect(result.events[0]?.parkingAreas?.[0]).toMatchObject({
      kinds: ['participants', 'camper'],
      coordinates: { lat: 50.112, lng: 8.684 },
      fee: 'free',
      openFrom: '07:00',
    });
  });

  it('refuses parking areas without kinds or coordinates', () => {
    expect(
      codes(
        file([
          {
            ...base,
            parking: [
              {
                name: 'P',
                kinds: [],
                lat: 'x',
                fee: 'maybe',
                openFrom: '7 Uhr',
              },
            ],
          },
        ]),
      ),
    ).toEqual(
      expect.arrayContaining([
        'error:parkingKindUnknown:parking[0].kinds',
        'error:coordinateInvalid:parking[0].lat',
        'error:coordinateInvalid:parking[0].lng',
        'error:parkingFeeUnknown:parking[0].fee',
        'error:timeInvalid:parking[0].openFrom',
      ]),
    );
  });
});
