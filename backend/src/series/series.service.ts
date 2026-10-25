import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RaceSeries } from './entities/race-series.entity';
import { RaceSeriesEvent } from './entities/race-series-event.entity';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { AddSeriesEventDto } from './dto/add-series-event.dto';
import { UpdateSeriesEventDto } from './dto/update-series-event.dto';
import { SeriesSearchDto } from './dto/series-search.dto';
import { UploadedFile, UploadsService } from '../uploads/uploads.service';

export interface SerializedSeries {
  id: string;
  name: string;
  slug: string;
  description?: string;
  year?: number;
  kind: 'series' | 'cup' | 'league';
  season?: string;
  discipline?: unknown;
  imageUrl?: string;
  externalUrl?: string;
  eventCount: number;
  createdAt: Date;
}

export interface PaginatedSeries {
  data: SerializedSeries[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class SeriesService {
  constructor(
    @InjectRepository(RaceSeries)
    private readonly repo: Repository<RaceSeries>,
    @InjectRepository(RaceSeriesEvent)
    private readonly seriesEventRepo: Repository<RaceSeriesEvent>,
    private readonly uploads: UploadsService,
  ) {}

  async findAll(params: SeriesSearchDto): Promise<PaginatedSeries> {
    const qb = this.repo
      .createQueryBuilder('series')
      .leftJoinAndSelect('series.discipline', 'discipline');

    if (params.q) {
      qb.andWhere('series.name ILIKE :q', { q: `%${params.q}%` });
    }
    if (params.discipline) {
      qb.andWhere('series.disciplineSlug = :disc', {
        disc: params.discipline,
      });
    }
    if (params.year != null) {
      qb.andWhere('series.year = :year', { year: params.year });
    }

    qb.orderBy('series.year', 'DESC', 'NULLS LAST')
      .addOrderBy('series.name', 'ASC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    const [data, total] = await qb.getManyAndCount();
    const counts = await this.eventCounts(data.map((s) => s.id));
    for (const s of data) {
      (s as RaceSeries & { eventCount?: number }).eventCount =
        counts.get(s.id) ?? 0;
    }

    return {
      data: data.map((s) => this.serialize(s)),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  private async eventCounts(ids: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (ids.length === 0) return counts;
    const rows = await this.seriesEventRepo
      .createQueryBuilder('rse')
      .select('rse.seriesId', 'seriesId')
      .addSelect('COUNT(*)', 'count')
      .where('rse.seriesId IN (:...ids)', { ids })
      .groupBy('rse.seriesId')
      .getRawMany<{ seriesId: string; count: string }>();
    for (const row of rows) counts.set(row.seriesId, Number(row.count));
    return counts;
  }

  async findBySlug(slug: string): Promise<Record<string, unknown>> {
    const series = await this.repo.findOne({
      where: { slug },
      relations: {
        discipline: true,
        seriesEvents: { event: { discipline: true } },
      },
    });
    if (!series) {
      throw new NotFoundException(`Series "${slug}" not found`);
    }

    const sortedEvents = (series.seriesEvents ?? []).sort((a, b) => {
      if (a.stageNumber != null && b.stageNumber != null)
        return a.stageNumber - b.stageNumber;
      if (a.stageNumber != null) return -1;
      if (b.stageNumber != null) return 1;
      return 0;
    });

    return {
      ...this.serialize(series),
      events: sortedEvents.map((se) => ({
        event: this.serializeEvent(se.event),
        stageNumber: se.stageNumber,
        label: se.label,
      })),
    };
  }

  async findByEventId(eventId: string): Promise<SerializedSeries[]> {
    const entries = await this.seriesEventRepo.find({
      where: { eventId },
      relations: {
        series: { discipline: true, seriesEvents: true },
      },
    });

    return entries.map((e) => this.serialize(e.series));
  }

  async create(
    dto: CreateSeriesDto,
    userId?: string,
  ): Promise<SerializedSeries> {
    const slug = await this.generateSlug(dto.name, dto.year);
    const entity = this.repo.create({
      ...dto,
      slug,
      createdById: userId,
    });
    const saved = await this.repo.save(entity);
    return { ...this.serialize(saved), eventCount: 0 };
  }

  async update(
    id: string,
    dto: UpdateSeriesDto,
    user?: { id: string; isAdmin: boolean },
  ): Promise<SerializedSeries> {
    const series = await this.findEntity(id);

    if (user) {
      this.assertOwnerOrAdmin(series, user);
    }

    Object.assign(series, dto);

    if (dto.name != null || dto.year !== undefined) {
      series.slug = await this.generateSlug(
        dto.name ?? series.name,
        dto.year !== undefined ? dto.year : series.year,
        id,
      );
    }

    const saved = await this.repo.save(series);
    const count = await this.seriesEventRepo.count({
      where: { seriesId: id },
    });
    return { ...this.serialize(saved), eventCount: count };
  }

  async remove(
    id: string,
    user?: { id: string; isAdmin: boolean },
  ): Promise<void> {
    const series = await this.findEntity(id);
    if (user) {
      this.assertOwnerOrAdmin(series, user);
    }
    await this.uploads.remove('series', series.id);
    await this.repo.remove(series);
  }

  async setImage(
    id: string,
    file: UploadedFile,
    user: { id: string; isAdmin: boolean },
  ): Promise<SerializedSeries> {
    const series = await this.findEntity(id);
    this.assertOwnerOrAdmin(series, user);

    series.imageUrl = await this.uploads.save('series', series.id, file);
    const saved = await this.repo.save(series);
    const count = await this.seriesEventRepo.count({ where: { seriesId: id } });
    return { ...this.serialize(saved), eventCount: count };
  }

  async removeImage(
    id: string,
    user: { id: string; isAdmin: boolean },
  ): Promise<SerializedSeries> {
    const series = await this.findEntity(id);
    this.assertOwnerOrAdmin(series, user);

    await this.uploads.remove('series', series.id);
    series.imageUrl = null as unknown as string;
    const saved = await this.repo.save(series);
    const count = await this.seriesEventRepo.count({ where: { seriesId: id } });
    return { ...this.serialize(saved), eventCount: count };
  }

  private assertOwnerOrAdmin(
    series: RaceSeries,
    user: { id: string; isAdmin: boolean },
  ): void {
    if (user.isAdmin) return;
    if (series.createdById && series.createdById === user.id) return;
    throw new ForbiddenException('You can only modify your own series');
  }

  async addEvent(seriesId: string, dto: AddSeriesEventDto): Promise<void> {
    await this.findEntity(seriesId);

    const exists = await this.seriesEventRepo.findOne({
      where: { seriesId, eventId: dto.eventId },
    });
    if (exists) {
      throw new ConflictException('Event is already part of this series');
    }

    const entry = this.seriesEventRepo.create({
      seriesId,
      eventId: dto.eventId,
      stageNumber: dto.stageNumber,
      label: dto.label,
    });
    await this.seriesEventRepo.save(entry);
  }

  async updateEvent(
    seriesId: string,
    eventId: string,
    dto: UpdateSeriesEventDto,
  ): Promise<void> {
    const entry = await this.seriesEventRepo.findOne({
      where: { seriesId, eventId },
    });
    if (!entry) {
      throw new NotFoundException('Event not found in this series');
    }
    Object.assign(entry, dto);
    await this.seriesEventRepo.save(entry);
  }

  async removeEvent(seriesId: string, eventId: string): Promise<void> {
    const entry = await this.seriesEventRepo.findOne({
      where: { seriesId, eventId },
    });
    if (!entry) {
      throw new NotFoundException('Event not found in this series');
    }
    await this.seriesEventRepo.remove(entry);
  }

  private async findEntity(id: string): Promise<RaceSeries> {
    const series = await this.repo.findOne({ where: { id } });
    if (!series) {
      throw new NotFoundException(`Series ${id} not found`);
    }
    return series;
  }

  private async generateSlug(
    name: string,
    year?: number,
    excludeId?: string,
  ): Promise<string> {
    let base = name
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (year != null) {
      base += `-${year}`;
    }

    let slug = base;
    let suffix = 2;

    while (true) {
      const qb = this.repo
        .createQueryBuilder('s')
        .where('s.slug = :slug', { slug });
      if (excludeId) {
        qb.andWhere('s.id != :id', { id: excludeId });
      }
      const existing = await qb.getOne();
      if (!existing) break;
      slug = `${base}-${suffix}`;
      suffix++;
    }

    return slug;
  }

  private serialize(series: RaceSeries): SerializedSeries {
    return {
      id: series.id,
      name: series.name,
      slug: series.slug,
      description: series.description ?? undefined,
      year: series.year ?? undefined,
      kind: series.kind,
      season: series.season ?? undefined,
      discipline: series.discipline ?? undefined,
      imageUrl: series.imageUrl ?? undefined,
      externalUrl: series.externalUrl ?? undefined,
      eventCount:
        (series as any).eventCount ?? series.seriesEvents?.length ?? 0,
      createdAt: series.createdAt,
    };
  }

  private serializeEvent(event: any): Record<string, unknown> {
    const coords = event.coordinates;
    return {
      ...event,
      coordinates:
        coords?.type === 'Point'
          ? { lat: coords.coordinates[1], lng: coords.coordinates[0] }
          : null,
    };
  }
}
