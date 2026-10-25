import type { Event } from '../events/entities/event.entity';
import { EventStatus } from '../events/entities/event.entity';
import { applyChanges, diffImportedEvent } from './import-diff';
import type { RawEvent } from './interfaces/import-source.interface';

const existing = (over: Partial<Event> = {}): Event =>
  ({
    name: 'Testrennen',
    description: 'Alt',
    startDate: new Date('2026-10-31T23:00:00Z'),
    endDate: null,
    startTimeKnown: false,
    status: EventStatus.PUBLISHED,
    locationName: 'Frankfurt',
    address: null,
    country: 'DE',
    registrationDeadline: null,
    externalUrl: 'https://example.org/a',
    sourceUrl: 'https://example.org/a',
    disciplineSlug: 'strasse',
    sources: null,
    importConflicts: null,
    editedFields: [],
    ...over,
  }) as unknown as Event;

const raw = (over: Partial<RawEvent> = {}): RawEvent => ({
  externalId: 'a1',
  sourceName: 'test',
  name: 'Testrennen',
  startDate: new Date('2026-10-31T23:00:00Z'),
  startTimeKnown: false,
  disciplineSlug: 'strasse',
  locationName: 'Frankfurt',
  externalUrl: 'https://example.org/a',
  status: 'published',
  ...over,
});

describe('diffImportedEvent', () => {
  it('finds nothing to change for the same data and never clears missing fields', () => {
    expect(diffImportedEvent(existing(), raw())).toEqual({
      changes: [],
      protected: [],
    });
  });

  it('ignores key order of stored objects', () => {
    const result = diffImportedEvent(
      existing({ sources: [{ url: 'https://v.de', name: 'V' }] }),
      raw({ sources: [{ name: 'V', url: 'https://v.de' }] }),
    );
    expect(result.changes).toEqual([]);
  });

  it('lists changed fields with old and new value', () => {
    const { changes } = diffImportedEvent(
      existing(),
      raw({ name: 'Neu', status: 'cancelled' }),
    );
    expect(changes).toEqual([
      { field: 'name', before: 'Testrennen', after: 'Neu' },
      { field: 'status', before: 'published', after: 'cancelled' },
    ]);
  });

  it('keeps fields edited by hand', () => {
    const result = diffImportedEvent(
      existing({ editedFields: ['name', 'locationName'] }),
      raw({ name: 'Neu', locationName: 'Offenbach', description: 'Neu' }),
    );
    expect(result.changes.map((c) => c.field)).toEqual(['description']);
    expect(result.protected.map((c) => c.field)).toEqual([
      'name',
      'locationName',
    ]);
  });

  it('applies only the listed changes', () => {
    const event = existing();
    const r = raw({
      name: 'Neu',
      sources: [{ name: 'V', url: 'https://v.de' }],
    });
    applyChanges(event, r, diffImportedEvent(event, r).changes);
    expect(event.name).toBe('Neu');
    expect(event.sources).toEqual([{ name: 'V', url: 'https://v.de' }]);
    expect(event.description).toBe('Alt');
  });
});
