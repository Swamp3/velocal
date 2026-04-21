import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  Event,
  EventSource,
  EventStatus,
} from '../events/entities/event.entity';
import { GeocodingService } from '../events/geocoding.service';
import {
  ImportResult,
  ImportSource,
  RawEvent,
} from './interfaces/import-source.interface';
import { RaceResultSource } from './sources/race-result.source';
import { RadNetSource } from './sources/rad-net.source';

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_JOB_HISTORY = 20;

export type ImportJobStatus = 'running' | 'completed' | 'failed';

export interface ImportJob {
  id: string;
  source: string | null;
  status: ImportJobStatus;
  startedAt: string;
  finishedAt: string | null;
  result: ImportResult | null;
  error: string | null;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly sources: ImportSource[];
  private readonly cooldownMs: number;
  private lastImportAt: Date | null = null;
  private importRunning = false;
  private readonly jobs = new Map<string, ImportJob>();

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    private readonly config: ConfigService,
    private readonly geocoding: GeocodingService,
    radNetSource: RadNetSource,
    raceResultSource: RaceResultSource,
  ) {
    this.sources = [radNetSource, raceResultSource];
    this.cooldownMs =
      (this.config.get<number>('IMPORT_COOLDOWN_MINUTES') ?? 5) * 60 * 1000 ||
      DEFAULT_COOLDOWN_MS;
  }

  startImport(sourceName?: string): ImportJob {
    if (this.importRunning) {
      throw new ConflictException('An import is already running');
    }

    if (this.lastImportAt) {
      const elapsed = Date.now() - this.lastImportAt.getTime();
      if (elapsed < this.cooldownMs) {
        const remainingSec = Math.ceil((this.cooldownMs - elapsed) / 1000);
        throw new ConflictException(
          `Import on cooldown. Try again in ${remainingSec}s`,
        );
      }
    }

    const job: ImportJob = {
      id: randomUUID(),
      source: sourceName ?? null,
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      result: null,
      error: null,
    };

    this.jobs.set(job.id, job);
    this.trimJobHistory();
    this.importRunning = true;

    void this.executeImport(job);

    return job;
  }

  getJob(id: string): ImportJob | null {
    return this.jobs.get(id) ?? null;
  }

  getSourceNames(): string[] {
    return this.sources.map((s) => s.name);
  }

  private async executeImport(job: ImportJob): Promise<void> {
    const sources = job.source
      ? this.sources.filter((s) => s.name === job.source)
      : this.sources;

    if (sources.length === 0) {
      this.logger.warn(`No import source found for: ${job.source}`);
      this.finishJob(job, { created: 0, updated: 0, skipped: 0 });
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

      this.finishJob(job, { created, updated, skipped });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import job ${job.id} failed: ${message}`);
      this.failJob(job, message);
    }
  }

  private finishJob(job: ImportJob, result: ImportResult): void {
    job.status = 'completed';
    job.result = result;
    job.finishedAt = new Date().toISOString();
    this.importRunning = false;
    this.lastImportAt = new Date();
  }

  private failJob(job: ImportJob, error: string): void {
    job.status = 'failed';
    job.error = error;
    job.finishedAt = new Date().toISOString();
    this.importRunning = false;
    this.lastImportAt = new Date();
  }

  private trimJobHistory(): void {
    if (this.jobs.size <= MAX_JOB_HISTORY) return;
    const excess = this.jobs.size - MAX_JOB_HISTORY;
    const keys = Array.from(this.jobs.keys()).slice(0, excess);
    for (const key of keys) {
      this.jobs.delete(key);
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
