import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Event,
  EventSource,
  EventStatus,
} from '../events/entities/event.entity';
import {
  ImportResult,
  ImportSource,
  RawEvent,
} from './interfaces/import-source.interface';
import { RadNetSource } from './sources/rad-net.source';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly sources: ImportSource[];

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    radNetSource: RadNetSource,
  ) {
    this.sources = [radNetSource];
  }

  async runImport(sourceName?: string): Promise<ImportResult> {
    const sources = sourceName
      ? this.sources.filter((s) => s.name === sourceName)
      : this.sources;

    if (sources.length === 0) {
      this.logger.warn(`No import source found for: ${sourceName}`);
      return { created: 0, updated: 0, skipped: 0 };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

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

    return { created, updated, skipped };
  }

  getSourceNames(): string[] {
    return this.sources.map((s) => s.name);
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

    if (existing.name !== raw.name) {
      existing.name = raw.name;
      changed = true;
    }
    if (existing.locationName !== raw.locationName) {
      existing.locationName = raw.locationName;
      changed = true;
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

    if (!changed) return 'skipped';

    await this.eventRepo.save(existing);
    return 'updated';
  }

  private async createEvent(raw: RawEvent): Promise<'created'> {
    const status = this.mapStatus(raw.status);

    const event = this.eventRepo.create({
      name: raw.name,
      description: raw.description,
      startDate: raw.startDate,
      endDate: raw.endDate,
      status,
      locationName: raw.locationName,
      address: raw.address,
      country: raw.country ?? 'DE',
      coordinates:
        raw.lat != null && raw.lng != null
          ? { type: 'Point', coordinates: [raw.lng, raw.lat] }
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
