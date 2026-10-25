import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Event, EventSource } from '../events/entities/event.entity';
import { EventClass } from '../events/entities/event-class.entity';
import { compareEvents } from '../events/event-matching';
import { GeocodingService } from '../events/geocoding.service';
import { berlinDay } from './dates';
import { ImportRun, ImportRunStatus } from './entities/import-run.entity';
import {
  applyChanges,
  comparableClasses,
  diffImportedEvent,
  FieldChange,
  mapStatus,
} from './import-diff';
import { ImportIssue, issueMessage, validateImportFile } from './import-file';
import {
  ImportResult,
  ImportSource,
  RawEvent,
} from './interfaces/import-source.interface';
import { RaceResultSource } from './sources/race-result.source';
import { RadNetSource } from './sources/rad-net.source';
import { inferFormat } from '../events/formats';

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
/** Issues decided against the database; recomputed when the run writes. */
const PLAN_CODES = new Set([
  'possibleDuplicate',
  'otherSource',
  'protectedFields',
]);

/**
 * - `file`: events from a JSON file. An event is only ever updated when it was imported from
 *   the same `sourceName` under the same `externalId`. A record that looks like an existing
 *   event of any other origin is not imported (warning `possibleDuplicate`).
 * - `scraper`: the built-in sources. Also matched by their own page on the same day, because
 *   some sources change their ids.
 */
type ImportMode = 'file' | 'scraper';

export type PlannedAction =
  'create' | 'update' | 'unchanged' | 'skip' | 'invalid';

export interface ReportEntry {
  index: number;
  externalId: string | null;
  name: string | null;
  startDate: string | null;
  action: PlannedAction;
  eventId?: string;
  changes?: FieldChange[];
  issues: (ImportIssue & { message: string })[];
}

export interface ImportReport {
  sourceName: string | null;
  complete: boolean;
  fileName: string | null;
  summary: Record<PlannedAction, number> & { errors: number; warnings: number };
  fileIssues: (ImportIssue & { message: string })[];
  entries: ReportEntry[];
}

export interface ImportCheck {
  report: ImportReport;
  /** No errors. */
  canImport: boolean;
  /** Warnings that must be confirmed before importing. */
  needsConfirmation: boolean;
}

interface Candidate {
  event: Event;
  lat: number | null;
  lng: number | null;
}

interface Plan {
  action: PlannedAction;
  event?: Event;
  changes?: FieldChange[];
  issues: ImportIssue[];
}

function withMessage(issue: ImportIssue): ImportIssue & { message: string } {
  return { ...issue, message: issueMessage(issue) };
}

function emptySummary(): ImportReport['summary'] {
  return {
    create: 0,
    update: 0,
    unchanged: 0,
    skip: 0,
    invalid: 0,
    errors: 0,
    warnings: 0,
  };
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly sources: ImportSource[];
  private readonly cooldownMs: number;
  private importRunning = false;

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(ImportRun)
    private readonly importRunRepo: Repository<ImportRun>,
    @InjectRepository(EventClass)
    private readonly classRepo: Repository<EventClass>,
    private readonly config: ConfigService,
    private readonly geocoding: GeocodingService,
    private readonly dataSource: DataSource,
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

    if (lastRun?.finishedAt && !lastRun.fileName) {
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
    const sources = sourceName
      ? this.sources.filter((s) => s.name === sourceName)
      : this.sources;
    void this.executeImport(run, sources, 'scraper');

    return run;
  }

  /**
   * Checks an import file without writing anything: validation of every event, and what the
   * import would do with it given the current database.
   */
  async checkFile(data: unknown, fileName?: string): Promise<ImportCheck> {
    const validated = validateImportFile(data);
    const report: ImportReport = {
      sourceName: validated.sourceName,
      complete: validated.complete,
      fileName: fileName ?? null,
      summary: emptySummary(),
      fileIssues: validated.issues
        .filter((i) => i.index === undefined)
        .map(withMessage),
      entries: [],
    };
    const raws = validated.events.filter((e): e is RawEvent => e !== null);
    const candidates = await this.loadCandidates(raws);

    for (let index = 0; index < validated.labels.length; index++) {
      const label = validated.labels[index];
      const own = validated.issues.filter((i) => i.index === index);
      const raw = validated.events[index];
      let plan: Plan = { action: 'invalid', issues: [] };
      if (raw) plan = await this.planEvent(raw, 'file', candidates);
      report.entries.push({
        index,
        ...label,
        action: plan.action,
        eventId: plan.event?.id,
        changes: plan.changes,
        issues: [...own, ...plan.issues.map((i) => ({ ...i, index }))].map(
          withMessage,
        ),
      });
    }

    if (validated.sourceName && validated.complete) {
      const listed = new Set(raws.map((r) => r.externalId));
      const upcoming = await this.eventRepo
        .createQueryBuilder('e')
        .select(['e.id', 'e.externalId'])
        .where('e.source = :src', { src: EventSource.IMPORTED })
        .andWhere('e.sourceName = :name', { name: validated.sourceName })
        .andWhere('e.startDate >= :now', { now: new Date() })
        .andWhere('e.missingSince IS NULL')
        .getMany();
      const missing = upcoming.filter((e) => !listed.has(e.externalId)).length;
      if (missing > 0) {
        report.fileIssues.push(
          withMessage({
            severity: 'warning',
            code: 'markedMissing',
            params: { count: missing },
          }),
        );
      }
    }

    const seriesKeys = new Map<string, string>();
    for (const raw of raws)
      for (const ref of raw.series ?? []) seriesKeys.set(ref.key, ref.name);
    if (validated.sourceName && seriesKeys.size > 0) {
      const known = await this.dataSource.query<{ external_key: string }[]>(
        `SELECT "external_key" FROM "race_series" WHERE "source_name" = $1 AND "external_key" = ANY($2)`,
        [validated.sourceName, [...seriesKeys.keys()]],
      );
      const fresh = seriesKeys.size - known.length;
      report.fileIssues.push(
        withMessage({
          severity: 'info',
          code: 'seriesSummary',
          params: { total: seriesKeys.size, created: fresh },
        }),
      );
    }

    this.summarize(report);
    return {
      report,
      canImport: report.summary.errors === 0,
      needsConfirmation: report.summary.warnings > 0,
    };
  }

  /**
   * Imports a checked file as a job. The file is checked again here: errors refuse the import,
   * warnings need `acceptWarnings`.
   */
  async startFileImport(
    data: unknown,
    opts: { fileName?: string; acceptWarnings?: boolean },
    triggeredBy?: string,
  ): Promise<ImportRun> {
    if (this.importRunning) {
      throw new ConflictException('An import is already running');
    }
    const check = await this.checkFile(data, opts.fileName);
    if (!check.canImport) {
      throw new BadRequestException({
        message: 'The file has errors; nothing was imported',
        code: 'import.hasErrors',
        report: check.report,
      });
    }
    if (check.needsConfirmation && !opts.acceptWarnings) {
      throw new BadRequestException({
        message: 'The file has warnings; confirm them to import',
        code: 'import.needsConfirmation',
        report: check.report,
      });
    }
    const validated = validateImportFile(data);
    const run = this.importRunRepo.create({
      source: validated.sourceName,
      status: ImportRunStatus.RUNNING,
      triggeredBy: triggeredBy ?? null,
      fileName: opts.fileName?.slice(0, 255) ?? 'upload.json',
    });
    await this.importRunRepo.save(run);

    const events = validated.events;
    const source: ImportSource = {
      name: validated.sourceName as string,
      lastFetchComplete: validated.complete,
      fetch: () =>
        Promise.resolve(events.filter((e): e is RawEvent => e !== null)),
    };
    this.importRunning = true;
    void this.executeImport(run, [source], 'file', check.report);
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
      // Reports can be large; the list only needs the counts.
      select: {
        id: true,
        source: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        eventsCreated: true,
        eventsUpdated: true,
        eventsSkipped: true,
        errorLog: true,
        triggeredBy: true,
        fileName: true,
      },
    });
  }

  getSourceNames(): string[] {
    return this.sources.map((s) => s.name);
  }

  private async executeImport(
    run: ImportRun,
    sources: ImportSource[],
    mode: ImportMode,
    checked?: ImportReport,
  ): Promise<void> {
    if (sources.length === 0) {
      this.logger.warn(`No import source found for: ${run.source}`);
      await this.finishRun(run, { created: 0, updated: 0, skipped: 0 }, null);
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const report: ImportReport = checked
      ? { ...checked, entries: [], summary: emptySummary() }
      : {
          sourceName: run.source,
          complete: false,
          fileName: null,
          summary: emptySummary(),
          fileIssues: [],
          entries: [],
        };

    try {
      for (const source of sources) {
        this.logger.log(`Running import for source: ${source.name}`);

        const sourceStart = new Date();
        const fetched = await source.fetch();
        const rawEvents = mode === 'file' ? fetched : dedupeRaw(fetched);
        this.logger.log(
          `Source ${source.name} returned ${fetched.length} events (${rawEvents.length} unique)`,
        );

        const candidates = await this.loadCandidates(rawEvents);
        const seenIds = new Set<string>();
        for (const [index, raw] of rawEvents.entries()) {
          const before = checked?.entries.find(
            (e) => e.externalId === raw.externalId,
          );
          const entry: ReportEntry = {
            index: before?.index ?? index,
            externalId: raw.externalId,
            name: raw.name,
            startDate: raw.startDate.toISOString(),
            action: 'skip',
            // Keep the file's own warnings (conflicts, vague place …) in the run's report.
            issues: (before?.issues ?? []).filter(
              (i) => !PLAN_CODES.has(i.code),
            ),
          };
          try {
            const plan = await this.planEvent(raw, mode, candidates);
            entry.issues.push(...plan.issues.map(withMessage));
            entry.action = plan.action;
            if (plan.action === 'create') {
              const saved = await this.createEvent(raw, run.id, entry);
              candidates.push({
                event: saved,
                lat: raw.lat ?? null,
                lng: raw.lng ?? null,
              });
              entry.eventId = saved.id;
              seenIds.add(saved.id);
              created++;
            } else if (plan.action === 'update' && plan.event) {
              await this.updateEvent(
                plan.event,
                raw,
                plan.changes ?? [],
                entry,
              );
              entry.eventId = plan.event.id;
              entry.changes = plan.changes;
              seenIds.add(plan.event.id);
              updated++;
            } else {
              if (plan.action === 'unchanged' && plan.event) {
                seenIds.add(plan.event.id);
                const unchanged = plan.event;
                await this.dataSource.transaction((m) =>
                  this.linkSeries(m, unchanged, raw),
                );
              }
              entry.eventId = plan.event?.id;
              skipped++;
            }
          } catch (error) {
            // One broken record must not abort the whole run.
            skipped++;
            entry.action = 'skip';
            const message =
              error instanceof Error ? error.message : String(error);
            entry.issues.push(
              withMessage({
                severity: 'error',
                code: 'saveFailed',
                params: { message },
              }),
            );
            this.logger.warn(
              `Could not import "${raw.name}" (${raw.externalId}): ${message}`,
            );
          }
          // Scraper runs list thousands of unchanged events; keep only what matters.
          if (
            mode === 'file' ||
            entry.action !== 'unchanged' ||
            entry.issues.length > 0
          ) {
            report.entries.push(entry);
          }
        }

        await this.recordSeen(source, seenIds, sourceStart);

        this.logger.log(
          `Source ${source.name} complete: ${created} created, ${updated} updated, ${skipped} skipped`,
        );
      }

      this.summarize(report);
      await this.finishRun(run, { created, updated, skipped }, report);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import run ${run.id} failed: ${message}`);
      this.summarize(report);
      await this.failRun(run, message, report);
    }
  }

  /** Decides what to do with one record. Reads only; the caller writes. */
  private async planEvent(
    raw: RawEvent,
    mode: ImportMode,
    candidates: Candidate[],
  ): Promise<Plan> {
    const own = await this.eventRepo.findOne({
      where: {
        externalId: raw.externalId,
        sourceName: raw.sourceName,
        source: EventSource.IMPORTED,
      },
    });
    const existing =
      own ?? (mode === 'scraper' ? await this.findBySourcePage(raw) : null);
    if (existing) return await this.planUpdate(existing, raw);

    const duplicate = this.findDuplicate(raw, candidates);
    if (duplicate) {
      return {
        action: 'skip',
        event: duplicate,
        issues: [
          mode === 'file'
            ? {
                severity: 'warning',
                code: 'possibleDuplicate',
                params: {
                  eventId: duplicate.id,
                  name: duplicate.name,
                  source: duplicate.sourceName ?? duplicate.source,
                },
              }
            : {
                severity: 'info',
                code: 'otherSource',
                params: { source: duplicate.sourceName ?? duplicate.source },
              },
        ],
      };
    }
    return { action: 'create', issues: [] };
  }

  private async planUpdate(existing: Event, raw: RawEvent): Promise<Plan> {
    // Manual events and events of another source stay as they are.
    if (
      existing.source !== EventSource.IMPORTED ||
      (existing.sourceName && existing.sourceName !== raw.sourceName)
    ) {
      return {
        action: 'skip',
        event: existing,
        issues: [
          {
            severity: 'info',
            code: 'otherSource',
            params: { source: existing.sourceName ?? existing.source },
          },
        ],
      };
    }
    const current =
      raw.classes !== undefined
        ? comparableClasses(
            await this.classRepo.find({
              where: { eventId: existing.id },
              order: { position: 'ASC' },
            }),
          )
        : undefined;
    const { changes, protected: kept } = diffImportedEvent(
      existing,
      raw,
      current,
    );
    const issues: ImportIssue[] = kept.length
      ? [
          {
            severity: 'info',
            code: 'protectedFields',
            params: { fields: kept.map((c) => c.field).join(', ') },
          },
        ]
      : [];
    return {
      action: changes.length ? 'update' : 'unchanged',
      event: existing,
      changes,
      issues,
    };
  }

  /**
   * Scrapers only: the same source page on the same day, when the source changed its id. A page
   * that lists several events (a calendar) never matches, because the day must agree.
   */
  private async findBySourcePage(raw: RawEvent): Promise<Event | null> {
    const url = raw.sourceUrl ?? raw.externalUrl;
    if (!url) return null;
    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.source = :src', { src: EventSource.IMPORTED })
      .andWhere('e.sourceName = :name', { name: raw.sourceName })
      .andWhere('(e.sourceUrl = :url OR e.externalUrl = :url)', { url })
      .getMany();
    const sameDay = rows.filter(
      (e) => berlinDay(e.startDate) === berlinDay(raw.startDate),
    );
    return sameDay.length === 1 ? sameDay[0] : null;
  }

  /** The same race on the same day under another origin, by name and place. */
  private findDuplicate(raw: RawEvent, candidates: Candidate[]): Event | null {
    let best: { event: Event; score: number } | null = null;
    const day = berlinDay(raw.startDate);
    for (const { event, lat, lng } of candidates) {
      if (berlinDay(event.startDate) !== day) continue;
      // The same source lists it under another id: a separate record (for
      // example two classes of one race), never merged by name.
      if (
        event.sourceName === raw.sourceName &&
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
    return best?.event ?? null;
  }

  private async updateEvent(
    existing: Event,
    raw: RawEvent,
    changes: FieldChange[],
    entry: ReportEntry,
  ): Promise<void> {
    applyChanges(existing, raw, changes);
    const moved = changes.some(
      (c) => c.field === 'locationName' || c.field === 'address',
    );
    if (
      !existing.editedFields?.includes('coordinates') &&
      (!existing.coordinates || moved || raw.lat != null)
    ) {
      const coords = await this.resolveCoordinates(raw, entry);
      if (coords) {
        existing.coordinates = {
          type: 'Point',
          coordinates: [coords.lng, coords.lat],
        };
      }
    }
    // Event, classes and series links are saved together or not at all.
    await this.dataSource.transaction(async (manager) => {
      await manager.save(existing);
      if (changes.some((c) => c.field === 'classes')) {
        await this.writeClasses(manager, existing.id, raw);
      }
      await this.linkSeries(manager, existing, raw);
    });
  }

  /** Replaces the classes of an event the import owns. */
  private async writeClasses(
    manager: EntityManager,
    eventId: string,
    raw: RawEvent,
  ): Promise<void> {
    const classRepo = manager.getRepository(EventClass);
    await classRepo.delete({ eventId });
    if (!raw.classes?.length) return;
    await classRepo.save(
      raw.classes.map((c, position) =>
        classRepo.create({ ...c, eventId, position } as Partial<EventClass>),
      ),
    );
  }

  /**
   * Links the event to the series named in the record. A series is found by source and key; the
   * import creates it when missing and keeps name, kind and season of series it created up to
   * date. Series made by hand are never changed.
   */
  private async linkSeries(
    manager: EntityManager,
    event: Event,
    raw: RawEvent,
  ): Promise<void> {
    for (const ref of raw.series ?? []) {
      const [found] = await manager.query<{ id: string }[]>(
        `SELECT "id" FROM "race_series" WHERE "source_name" = $1 AND "external_key" = $2`,
        [raw.sourceName, ref.key],
      );
      let seriesId = found?.id;
      if (seriesId) {
        await manager.query(
          `UPDATE "race_series" SET "name" = $2, "kind" = $3::series_kind, "season" = COALESCE($4, "season"), "updatedAt" = now()
            WHERE "id" = $1 AND ("name" <> $2 OR "kind"::text <> $3 OR "season" IS DISTINCT FROM COALESCE($4, "season"))`,
          [seriesId, ref.name, ref.kind, ref.season],
        );
      } else {
        const year = Number(berlinDay(event.startDate).slice(0, 4));
        const slug = await this.freeSeriesSlug(
          manager,
          `${ref.name} ${ref.season ?? year}`,
        );
        const [created] = await manager.query<{ id: string }[]>(
          `INSERT INTO "race_series" ("name", "slug", "year", "discipline_slug", "kind", "season", "source_name", "external_key")
           VALUES ($1, $2, $3, $4, $5::series_kind, $6, $7, $8) RETURNING "id"`,
          [
            ref.name,
            slug,
            year,
            event.disciplineSlug,
            ref.kind,
            ref.season,
            raw.sourceName,
            ref.key,
          ],
        );
        seriesId = created.id;
      }
      await manager.query(
        `INSERT INTO "race_series_events" ("series_id", "event_id", "stageNumber", "label")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("series_id", "event_id")
         DO UPDATE SET "stageNumber" = EXCLUDED."stageNumber", "label" = EXCLUDED."label"`,
        [seriesId, event.id, ref.round, ref.roundLabel],
      );
    }
  }

  private async freeSeriesSlug(
    manager: EntityManager,
    text: string,
  ): Promise<string> {
    const base =
      text
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80) || 'serie';
    let slug = base;
    for (let n = 2; ; n++) {
      const [taken] = await manager.query<{ id: string }[]>(
        `SELECT "id" FROM "race_series" WHERE "slug" = $1`,
        [slug],
      );
      if (!taken) return slug;
      slug = `${base}-${n}`;
    }
  }

  private async createEvent(
    raw: RawEvent,
    runId: string,
    entry: ReportEntry,
  ): Promise<Event> {
    const coords = await this.resolveCoordinates(raw, entry);
    const event = this.eventRepo.create({
      name: raw.name,
      description: raw.description,
      startDate: raw.startDate,
      endDate: raw.endDate,
      startTimeKnown: raw.startTimeKnown ?? true,
      status: mapStatus(raw.status),
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
      sources: raw.sources ?? null,
      importConflicts: raw.conflicts ?? null,
      importRunId: runId,
      lastSeenAt: new Date(),
      disciplineSlug: raw.disciplineSlug,
      championship: raw.championship ?? null,
      format: raw.format ?? inferFormat(raw.name),
    });
    // Event, classes and series links are saved together or not at all.
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(event);
      await this.writeClasses(manager, saved.id, raw);
      await this.linkSeries(manager, saved, raw);
      return saved;
    });
  }

  private summarize(report: ImportReport): void {
    const summary = emptySummary();
    for (const entry of report.entries) {
      summary[entry.action]++;
      for (const issue of entry.issues) {
        if (issue.severity === 'error') summary.errors++;
        if (issue.severity === 'warning') summary.warnings++;
      }
    }
    for (const issue of report.fileIssues) {
      if (issue.severity === 'error') summary.errors++;
      if (issue.severity === 'warning') summary.warnings++;
    }
    report.summary = summary;
  }

  private async finishRun(
    run: ImportRun,
    result: ImportResult,
    report: ImportReport | null,
  ): Promise<void> {
    run.status = ImportRunStatus.COMPLETED;
    run.eventsCreated = result.created;
    run.eventsUpdated = result.updated;
    run.eventsSkipped = result.skipped;
    run.finishedAt = new Date();
    run.report = report;
    await this.importRunRepo.save(run);
    this.importRunning = false;
  }

  private async failRun(
    run: ImportRun,
    error: string,
    report: ImportReport | null = null,
  ): Promise<void> {
    run.status = ImportRunStatus.FAILED;
    run.errorLog = error;
    run.finishedAt = new Date();
    if (report) run.report = report;
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
   * source that a complete run did not find any more. Nothing is deleted.
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

  /** Public calendar events around the records' days, to find the same race elsewhere. */
  private async loadCandidates(raws: RawEvent[]): Promise<Candidate[]> {
    if (raws.length === 0) return [];
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
    return rows.entities.map((event, i) => {
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

  private async resolveCoordinates(
    raw: RawEvent,
    entry?: ReportEntry,
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
    } else if (entry) {
      entry.issues.push(
        withMessage({ severity: 'warning', code: 'geocodeFailed' }),
      );
    }

    return result;
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
