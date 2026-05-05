import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Event,
  EventSource,
  EventStatus,
} from '../events/entities/event.entity';
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

  async startImport(sourceName?: string, triggeredBy?: string): Promise<ImportRun> {
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

        const rawEvents = await source.fetch();
        this.logger.log(
          `Source ${source.name} returned ${rawEvents.length} events`,
        );

        for (const raw of rawEvents) {
          const result = await this.upsertEvent(raw);
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
        }

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

  private async upsertEvent(
    raw: RawEvent,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const existing = await this.findExisting(raw);

    if (existing) {
      if (existing.source !== EventSource.IMPORTED) {
        return 'skipped';
      }
      return this.updateIfChanged(existing, raw);
    }

    return this.createEvent(raw);
  }

  private async findExisting(raw: RawEvent): Promise<Event | null> {
    if (raw.externalId) {
      const byExternalId = await this.eventRepo.findOne({
        where: {
          externalId: raw.externalId,
          source: EventSource.IMPORTED,
        },
      });
      if (byExternalId) return byExternalId;
    }

    if (raw.externalUrl) {
      const byUrl = await this.eventRepo.findOne({
        where: {
          externalUrl: raw.externalUrl,
          source: EventSource.IMPORTED,
        },
      });
      if (byUrl) return byUrl;
    }

    const startOfDay = new Date(raw.startDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(raw.startDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const byNameDate = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.name = :name', { name: raw.name })
      .andWhere('e.startDate BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .andWhere('e.locationName = :loc', { loc: raw.locationName })
      .getOne();

    return byNameDate;
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

  private async createEvent(raw: RawEvent): Promise<'created'> {
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
      disciplineSlug: raw.disciplineSlug,
    });

    await this.eventRepo.save(event);
    return 'created';
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
