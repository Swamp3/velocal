import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  Event,
  EventSource,
  EventStatus,
} from '../events/entities/event.entity';
import { compareEvents } from '../events/event-matching';
import { GeocodingService } from '../events/geocoding.service';
import { ImportRun, ImportRunStatus } from './entities/import-run.entity';
import {
  ImportResult,
  ImportSource,
  RawEvent,
} from './interfaces/import-source.interface';
import { RaceResultSource } from './sources/race-result.source';
import { RadNetSource } from './sources/rad-net.source';

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const RETENTION_DAYS = 90;

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly sources: ImportSource[];
  private readonly cooldownMs: number;
  private importRunning = false;
  private candidates: {
    event: Event;
    lat: number | null;
    lng: number | null;
  }[] = [];

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(ImportRun)
    private readonly importRunRepo: Repository<ImportRun>,
    private readonly config: ConfigService,
    private readonly geocoding: GeocodingService,
    radNetSource: RadNetSource,
    raceResultSource: RaceResultSource,
  ) {
    this.sources = [radNetSource, raceResultSource];
    this.cooldownMs =
      (this.config.get<number>('IMPORT_COOLDOWN_MINUTES') ?? 5) * 60 * 1000 ||
      DEFAULT_COOLDOWN_MS;

    void this.recoverStaleRuns();
  }

  async startImport(
    sourceName?: string,
    triggeredBy?: string,
  ): Promise<ImportRun> {
    if (this.importRunning) {
      throw new ConflictException('An import is already running');
    }

    const lastRun = await this.importRunRepo.findOne({
      where: { status: ImportRunStatus.COMPLETED },
      order: { finishedAt: 'DESC' },
    });

    if (lastRun?.finishedAt) {
      const elapsed = Date.now() - lastRun.finishedAt.getTime();
      if (elapsed < this.cooldownMs) {
        const remainingSec = Math.ceil((this.cooldownMs - elapsed) / 1000);
        throw new ConflictException(
          `Import on cooldown. Try again in ${remainingSec}s`,
        );
      }
    }

    const run = this.importRunRepo.create({
      source: sourceName ?? null,
      status: ImportRunStatus.RUNNING,
      triggeredBy: triggeredBy ?? null,
    });
    await this.importRunRepo.save(run);

    this.importRunning = true;
    void this.executeImport(run);

    return run;
  }

  async getJob(id: string): Promise<ImportRun | null> {
    return this.importRunRepo.findOne({ where: { id } });
  }

  async getJobs(limit = 50, offset = 0): Promise<ImportRun[]> {
    return this.importRunRepo.find({
      order: { startedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  getSourceNames(): string[] {
    return this.sources.map((s) => s.name);
  }

  private async executeImport(run: ImportRun): Promise<void> {
    const sources = run.source
      ? this.sources.filter((s) => s.name === run.source)
      : this.sources;

    if (sources.length === 0) {
      this.logger.warn(`No import source found for: ${run.source}`);
      await this.finishRun(run, { created: 0, updated: 0, skipped: 0 });
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    try {
      for (const source of sources) {
        this.logger.log(`Running import for source: ${source.name}`);

        const sourceStart = new Date();
        const fetched = await source.fetch();
        const rawEvents = dedupeRaw(fetched);
        this.logger.log(
          `Source ${source.name} returned ${fetched.length} events (${rawEvents.length} unique)`,
        );

        await this.preloadCandidates(rawEvents);
        const seenIds = new Set<string>();
        for (const raw of rawEvents) {
          try {
            const { result, id } = await this.upsertEvent(raw);
            if (id) seenIds.add(id);
            switch (result) {
              case 'created':
                created++;
                break;
              case 'updated':
                updated++;
                break;
              case 'skipped':
                skipped++;
                break;
            }
          } catch (error) {
            // One broken record must not abort the whole run.
            skipped++;
            this.logger.warn(
              `Could not import "${raw.name}" (${raw.externalId})`,
              error,
            );
          }
        }

        await this.recordSeen(source, seenIds, sourceStart);

        this.logger.log(
          `Source ${source.name} complete: ${created} created, ${updated} updated, ${skipped} skipped`,
        );
      }

      await this.finishRun(run, { created, updated, skipped });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import run ${run.id} failed: ${message}`);
      await this.failRun(run, message);
    }
  }

  private async finishRun(run: ImportRun, result: ImportResult): Promise<void> {
    run.status = ImportRunStatus.COMPLETED;
    run.eventsCreated = result.created;
    run.eventsUpdated = result.updated;
    run.eventsSkipped = result.skipped;
    run.finishedAt = new Date();
    await this.importRunRepo.save(run);
    this.importRunning = false;
  }

  private async failRun(run: ImportRun, error: string): Promise<void> {
    run.status = ImportRunStatus.FAILED;
    run.errorLog = error;
    run.finishedAt = new Date();
    await this.importRunRepo.save(run);
    this.importRunning = false;
  }

  /**
   * Mark any runs left as "running" from a previous process as failed.
   * This handles the case where the server crashed mid-import.
   */
  private async recoverStaleRuns(): Promise<void> {
    const stale = await this.importRunRepo.find({
      where: { status: ImportRunStatus.RUNNING },
    });
    for (const run of stale) {
      this.logger.warn(`Marking stale import run ${run.id} as failed`);
      await this.failRun(run, 'Server restarted while import was running');
    }
  }

  /**
   * Stamps the events a source still lists, and flags upcoming events of that
   * source that a complete run did not find any more.
   */
  private async recordSeen(
    source: ImportSource,
    seenIds: Set<string>,
    runStart: Date,
  ): Promise<void> {
    if (seenIds.size > 0) {
      await this.eventRepo
        .createQueryBuilder()
        .update(Event)
        .set({ lastSeenAt: new Date(), missingSince: null })
        .where('id = ANY(:ids)', { ids: [...seenIds] })
        .execute();
    }
    if (!source.lastFetchComplete) {
      this.logger.warn(
        `Source ${source.name} was not fetched completely: not flagging missing events`,
      );
      return;
    }
    const res = await this.eventRepo
      .createQueryBuilder()
      .update(Event)
      .set({ missingSince: new Date() })
      .where('source = :src', { src: EventSource.IMPORTED })
      .andWhere('"sourceName" = :name', { name: source.name })
      .andWhere('"startDate" >= :now', { now: new Date() })
      .andWhere('"missingSince" IS NULL')
      .andWhere('("lastSeenAt" IS NULL OR "lastSeenAt" < :runStart)', {
        runStart,
      })
      .execute();
    if (res.affected) {
      this.logger.log(
        `${res.affected} upcoming ${source.name} events are no longer listed`,
      );
    }
  }

  private async upsertEvent(
    raw: RawEvent,
  ): Promise<{ result: 'created' | 'updated' | 'skipped'; id?: string }> {
    const existing = await this.findExisting(raw);

    if (existing) {
      // Manual events and events of another source stay as they are: the same
      // race listed twice must not become two rows.
      if (
        existing.source !== EventSource.IMPORTED ||
        (existing.sourceName && existing.sourceName !== raw.sourceName)
      ) {
        return { result: 'skipped' };
      }
      return {
        result: await this.updateIfChanged(existing, raw),
        id: existing.id,
      };
    }

    return this.createEvent(raw);
  }

  /**
   * Finds the stored event for a scraped record: the source's own id first,
   * then its page, then the same race on the same day by name and place.
   */
  private async findExisting(raw: RawEvent): Promise<Event | null> {
    if (raw.externalId) {
      const byExternalId = await this.eventRepo.findOne({
        where: {
          externalId: raw.externalId,
          sourceName: raw.sourceName,
          source: EventSource.IMPORTED,
        },
      });
      if (byExternalId) return byExternalId;
    }

    const url = raw.sourceUrl ?? raw.externalUrl;
    if (url) {
      const byUrl = await this.eventRepo
        .createQueryBuilder('e')
        .where('e.source = :src', { src: EventSource.IMPORTED })
        .andWhere(
          new Brackets((qb) =>
            qb
              .where('e.sourceUrl = :url', { url })
              .orWhere('e.externalUrl = :url', { url }),
          ),
        )
        .getOne();
      if (byUrl) return byUrl;
    }

    // Same calendar day, public calendar only; candidates were loaded once for
    // the whole run (see preloadCandidates).
    let best: { event: Event; score: number } | null = null;
    for (const { event, lat, lng } of this.candidates) {
      if (!sameLocalDay(event.startDate, raw.startDate)) continue;
      // The same source lists it under another id: a separate record (for
      // example two classes of one race), never merged by name.
      if (
        event.sourceName === raw.sourceName &&
        event.externalId &&
        event.externalId !== raw.externalId
      ) {
        continue;
      }
      const result = compareEvents(
        {
          name: raw.name,
          locationName: raw.locationName,
          lat: raw.lat,
          lng: raw.lng,
        },
        { name: event.name, locationName: event.locationName, lat, lng },
      );
      if (result.match && (!best || result.score > best.score)) {
        best = { event, score: result.score };
      }
    }
    return (best as { event: Event } | null)?.event ?? null;
  }

  /**
   * Loads the public-calendar events around the dates of this run in one query
   * instead of one query per scraped record.
   */
  private async preloadCandidates(raws: RawEvent[]): Promise<void> {
    this.candidates = [];
    if (raws.length === 0) return;
    const times = raws.map((r) => r.startDate.getTime());
    const from = new Date(Math.min(...times) - 24 * 60 * 60 * 1000);
    const to = new Date(Math.max(...times) + 36 * 60 * 60 * 1000);
    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .addSelect('ST_Y(e.coordinates::geometry)', 'e_lat')
      .addSelect('ST_X(e.coordinates::geometry)', 'e_lng')
      .where('e.startDate BETWEEN :from AND :to', { from, to })
      .andWhere('e.community_id IS NULL')
      .getRawAndEntities();
    this.candidates = rows.entities.map((event, i) => {
      const row = rows.raw[i] as {
        e_lat?: number | null;
        e_lng?: number | null;
      };
      return {
        event,
        lat: row.e_lat == null ? null : Number(row.e_lat),
        lng: row.e_lng == null ? null : Number(row.e_lng),
      };
    });
  }

  private async updateIfChanged(
    existing: Event,
    raw: RawEvent,
  ): Promise<'updated' | 'skipped'> {
    const status = this.mapStatus(raw.status);
    let changed = false;
    let locationChanged = false;

    if (existing.name !== raw.name) {
      existing.name = raw.name;
      changed = true;
    }
    // A postponed event keeps its row instead of leaving a stale copy behind.
    if (!sameLocalDay(existing.startDate, raw.startDate)) {
      existing.startDate = raw.startDate;
      changed = true;
    }
    if (existing.externalId !== raw.externalId && raw.externalId) {
      existing.externalId = raw.externalId;
      changed = true;
    }
    if (!existing.sourceName) {
      existing.sourceName = raw.sourceName;
      changed = true;
    }
    if (!existing.sourceUrl && (raw.sourceUrl ?? raw.externalUrl)) {
      existing.sourceUrl = raw.sourceUrl ?? raw.externalUrl ?? null;
      changed = true;
    }
    if (existing.locationName !== raw.locationName) {
      existing.locationName = raw.locationName;
      changed = true;
      locationChanged = true;
    }
    if (existing.status !== status) {
      existing.status = status;
      changed = true;
    }
    if (raw.endDate && existing.endDate?.getTime() !== raw.endDate.getTime()) {
      existing.endDate = raw.endDate;
      changed = true;
    }
    if (
      raw.registrationDeadline &&
      existing.registrationDeadline?.getTime() !==
        raw.registrationDeadline.getTime()
    ) {
      existing.registrationDeadline = raw.registrationDeadline;
      changed = true;
    }
    if (raw.externalUrl && existing.externalUrl !== raw.externalUrl) {
      existing.externalUrl = raw.externalUrl;
      changed = true;
    }
    if (raw.address && existing.address !== raw.address) {
      existing.address = raw.address;
      changed = true;
    }

    const addressChanged = raw.address && existing.address !== raw.address;
    const needsGeocode =
      !existing.coordinates || locationChanged || addressChanged;

    if (needsGeocode) {
      const coords = await this.resolveCoordinates(raw);
      if (coords) {
        existing.coordinates = {
          type: 'Point',
          coordinates: [coords.lng, coords.lat],
        } as any;
        changed = true;
      }
    }

    if (!changed) return 'skipped';

    await this.eventRepo.save(existing);
    return 'updated';
  }

  private async createEvent(
    raw: RawEvent,
  ): Promise<{ result: 'created'; id: string }> {
    const status = this.mapStatus(raw.status);
    const coords = await this.resolveCoordinates(raw);

    const event = this.eventRepo.create({
      name: raw.name,
      description: raw.description,
      startDate: raw.startDate,
      endDate: raw.endDate,
      status,
      locationName: raw.locationName,
      address: raw.address,
      country: raw.country ?? 'DE',
      coordinates: coords
        ? { type: 'Point', coordinates: [coords.lng, coords.lat] }
        : undefined,
      registrationDeadline: raw.registrationDeadline,
      externalUrl: raw.externalUrl,
      externalId: raw.externalId,
      source: EventSource.IMPORTED,
      sourceName: raw.sourceName,
      sourceUrl: raw.sourceUrl ?? raw.externalUrl ?? null,
      lastSeenAt: new Date(),
      disciplineSlug: raw.disciplineSlug,
    });

    const saved = await this.eventRepo.save(event);
    // Later records of this run can match the event we just created.
    this.candidates.push({
      event: saved,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
    return { result: 'created', id: saved.id };
  }

  private async resolveCoordinates(
    raw: RawEvent,
  ): Promise<{ lat: number; lng: number } | null> {
    if (raw.lat != null && raw.lng != null) {
      return { lat: raw.lat, lng: raw.lng };
    }

    const result = await this.geocoding.geocodeLocation(
      raw.locationName,
      raw.address,
      raw.country,
    );

    if (result) {
      this.logger.debug(
        `Geocoded "${raw.locationName}" → ${result.lat}, ${result.lng}`,
      );
    }

    return result;
  }

  private mapStatus(status: string): EventStatus {
    switch (status) {
      case 'cancelled':
        return EventStatus.CANCELLED;
      case 'completed':
        return EventStatus.COMPLETED;
      default:
        return EventStatus.PUBLISHED;
    }
  }
}

/** The same record can appear in several list pages of one source. */
function dedupeRaw(events: RawEvent[]): RawEvent[] {
  const seen = new Map<string, RawEvent>();
  for (const event of events) {
    const key = `${event.sourceName}|${event.externalId}`;
    if (!seen.has(key)) seen.set(key, event);
  }
  return [...seen.values()];
}

const DAY_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar day in the time zone the races are held in. */
function sameLocalDay(a: Date, b: Date): boolean {
  return DAY_FORMAT.format(a) === DAY_FORMAT.format(b);
}
