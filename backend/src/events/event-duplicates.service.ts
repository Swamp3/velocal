import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MatchReason, compareEvents } from './event-matching';

export interface DuplicateEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  locationName: string;
  address: string | null;
  status: string;
  disciplineSlug: string;
  source: string;
  sourceName: string | null;
  sourceUrl: string | null;
  externalUrl: string | null;
  lastSeenAt: string | null;
  missingSince: string | null;
  createdAt: string;
  lat: number | null;
  lng: number | null;
}

export interface DuplicateGroup {
  /** Stable key: the id of the earliest created event of the group. */
  key: string;
  date: string;
  score: number;
  reasons: MatchReason[];
  events: DuplicateEvent[];
}

const CACHE_MS = 60_000;

const DAY_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

@Injectable()
export class EventDuplicatesService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Public-calendar events (not club events) on the same day whose names and
   * places look like the same event. Pairs an admin has dismissed are left out.
   */
  async findGroups(options: {
    includePast: boolean;
    page: number;
    limit: number;
  }): Promise<{ data: DuplicateGroup[]; total: number }> {
    const all = await this.cachedGroups(options.includePast);
    const start = (options.page - 1) * options.limit;
    return {
      data: all.slice(start, start + options.limit),
      total: all.length,
    };
  }

  private readonly cache = new Map<
    boolean,
    { until: number; groups: DuplicateGroup[] }
  >();

  /** The scan compares every event of a day: reuse it for a minute. */
  private async cachedGroups(includePast: boolean): Promise<DuplicateGroup[]> {
    const hit = this.cache.get(includePast);
    if (hit && hit.until > Date.now()) return hit.groups;
    const groups = await this.scan(includePast);
    this.cache.set(includePast, { until: Date.now() + CACHE_MS, groups });
    return groups;
  }

  private async scan(includePast: boolean): Promise<DuplicateGroup[]> {
    const events = await this.load(includePast);
    const ignored = await this.loadIgnored();

    const byDay = new Map<string, DuplicateEvent[]>();
    for (const event of events) {
      const day = DAY_FORMAT.format(new Date(event.startDate));
      const list = byDay.get(day) ?? [];
      list.push(event);
      byDay.set(day, list);
    }

    // Union-find over the matching pairs of each day.
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      let root = id;
      while ((parent.get(root) ?? root) !== root) root = parent.get(root)!;
      parent.set(id, root);
      return root;
    };
    const pairInfo = new Map<
      string,
      { score: number; reasons: Set<MatchReason> }
    >();

    for (const list of byDay.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (ignored.has(pairKey(a.id, b.id))) continue;
          const result = compareEvents(
            {
              name: a.name,
              locationName: a.locationName,
              lat: a.lat,
              lng: a.lng,
            },
            {
              name: b.name,
              locationName: b.locationName,
              lat: b.lat,
              lng: b.lng,
            },
          );
          if (!result.match) continue;
          parent.set(find(a.id), find(b.id));
          for (const id of [a.id, b.id]) {
            const info = pairInfo.get(id) ?? { score: 0, reasons: new Set() };
            info.score = Math.max(info.score, result.score);
            result.reasons.forEach((r) => info.reasons.add(r));
            pairInfo.set(id, info);
          }
        }
      }
    }

    const groups = new Map<string, DuplicateEvent[]>();
    for (const event of events) {
      if (!pairInfo.has(event.id)) continue;
      const root = find(event.id);
      const list = groups.get(root) ?? [];
      list.push(event);
      groups.set(root, list);
    }

    const result: DuplicateGroup[] = [...groups.values()]
      .filter((list) => list.length > 1)
      .map((list) => {
        const sorted = [...list].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        );
        const reasons = new Set<MatchReason>();
        let score = 0;
        for (const e of list) {
          const info = pairInfo.get(e.id)!;
          score = Math.max(score, info.score);
          info.reasons.forEach((r) => reasons.add(r));
        }
        return {
          key: sorted[0].id,
          date: list[0].startDate,
          score: Math.round(score * 100) / 100,
          reasons: [...reasons],
          events: sorted,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }

  /** Marks every pair among the given events as "not a duplicate". */
  async ignore(eventIds: string[], adminId: string): Promise<void> {
    const ids = [...new Set(eventIds)].sort();
    const found = await this.dataSource.query<{ id: string }[]>(
      `SELECT "id" FROM "events" WHERE "id" = ANY($1::uuid[])`,
      [ids],
    );
    if (found.length !== ids.length) {
      throw new BadRequestException('Unknown event');
    }
    this.cache.clear();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        await this.dataSource.query(
          `INSERT INTO "event_duplicate_ignores" ("event_a_id", "event_b_id", "created_by_id")
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [ids[i], ids[j], adminId],
        );
      }
    }
  }

  private async load(includePast: boolean): Promise<DuplicateEvent[]> {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT e."id", e."name", e."startDate", e."endDate", e."locationName", e."address",
              e."status", e."discipline_slug" AS "disciplineSlug", e."source",
              e."sourceName", e."sourceUrl", e."externalUrl", e."lastSeenAt",
              e."missingSince", e."createdAt",
              ST_Y(e."coordinates"::geometry) AS "lat", ST_X(e."coordinates"::geometry) AS "lng"
       FROM "events" e
       WHERE e."community_id" IS NULL
         AND e."status" <> 'cancelled'
         AND e."startDate" >= now() - (CASE WHEN $1::boolean THEN interval '12 months' ELSE interval '1 day' END)
       ORDER BY e."startDate"`,
      [includePast],
    );
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      startDate: (r.startDate as Date).toISOString(),
      endDate: r.endDate ? (r.endDate as Date).toISOString() : null,
      locationName: (r.locationName as string) ?? '',
      address: (r.address as string) ?? null,
      status: r.status as string,
      disciplineSlug: r.disciplineSlug as string,
      source: r.source as string,
      sourceName: (r.sourceName as string) ?? null,
      sourceUrl: (r.sourceUrl as string) ?? null,
      externalUrl: (r.externalUrl as string) ?? null,
      lastSeenAt: r.lastSeenAt ? (r.lastSeenAt as Date).toISOString() : null,
      missingSince: r.missingSince
        ? (r.missingSince as Date).toISOString()
        : null,
      createdAt: (r.createdAt as Date).toISOString(),
      lat: r.lat == null ? null : Number(r.lat),
      lng: r.lng == null ? null : Number(r.lng),
    }));
  }

  private async loadIgnored(): Promise<Set<string>> {
    const rows = await this.dataSource.query<{ a: string; b: string }[]>(
      `SELECT "event_a_id" AS a, "event_b_id" AS b FROM "event_duplicate_ignores"`,
    );
    return new Set(rows.map((r) => pairKey(r.a, r.b)));
  }
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
