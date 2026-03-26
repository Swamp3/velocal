import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventSearchDto, EventSort } from './dto/event-search.dto';
import { GeocodingService } from './geocoding.service';

export interface SerializedEvent {
  coordinates?: { lat: number; lng: number } | null;
  distance?: number;
  [key: string]: any;
}

export interface PaginatedEvents {
  data: SerializedEvent[];
  total: number;
  page: number;
  limit: number;
  center?: { lat: number; lng: number };
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
    private readonly geocoding: GeocodingService,
  ) {}

  async findAll(params: EventSearchDto): Promise<PaginatedEvents> {
    let { lat, lng } = params;

    if (params.zip && lat == null) {
      const geo = await this.geocoding.geocodeZip(params.zip, params.country);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    const hasGeo = lat != null && lng != null;
    const qb = this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.discipline', 'discipline');

    const status = params.status ?? EventStatus.PUBLISHED;
    qb.andWhere('event.status = :status', { status });

    if (params.q) {
      qb.andWhere('event.name ILIKE :q', { q: `%${params.q}%` });
    }

    if (params.discipline) {
      const slugs = params.discipline.split(',').map((s) => s.trim());
      qb.andWhere('event.disciplineSlug IN (:...slugs)', { slugs });
    }

    if (params.from) {
      qb.andWhere('event.startDate >= :from', { from: params.from });
    }
    if (params.to) {
      qb.andWhere('event.startDate <= :to', { to: params.to });
    }

    if (hasGeo) {
      qb.setParameters({ lng, lat });

      if (params.radius != null) {
        const radiusMeters = params.radius * 1000;
        qb.andWhere(
          'ST_DWithin(event.coordinates, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radiusM)',
          { radiusM: radiusMeters },
        );
      }
      qb.addSelect(
        'ST_Distance(event.coordinates, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)',
        'distance_m',
      );
    }

    switch (params.sort) {
      case EventSort.DISTANCE:
        if (hasGeo) {
          qb.orderBy('distance_m', 'ASC');
        }
        break;
      case EventSort.NAME:
        qb.orderBy('event.name', 'ASC');
        break;
      default:
        qb.orderBy('event.startDate', 'ASC');
    }

    qb.skip((params.page - 1) * params.limit).take(params.limit);

    if (hasGeo) {
      const { entities, raw } = await qb.getRawAndEntities();
      const total = await qb.getCount();

      const data = entities.map((entity, i) =>
        this.serializeEvent(entity, {
          distance: raw[i]?.distance_m
            ? Math.round((parseFloat(raw[i].distance_m) / 1000) * 100) / 100
            : undefined,
        }),
      );

      return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        center: { lat: lat!, lng: lng! },
      };
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((e) => this.serializeEvent(e)),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findOne(id: string): Promise<SerializedEvent> {
    return this.serializeEvent(await this.findEntity(id));
  }

  private async findEntity(id: string): Promise<Event> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  async create(dto: CreateEventDto): Promise<Event> {
    const entity = this.repo.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      registrationDeadline: dto.registrationDeadline
        ? new Date(dto.registrationDeadline)
        : undefined,
      coordinates: dto.coordinates
        ? {
            type: 'Point',
            coordinates: [dto.coordinates.lng, dto.coordinates.lat],
          }
        : undefined,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateEventDto): Promise<SerializedEvent> {
    const event = await this.findEntity(id);

    const partial: Partial<Event> = { ...dto } as Partial<Event>;

    if (dto.startDate) partial.startDate = new Date(dto.startDate);
    if (dto.endDate) partial.endDate = new Date(dto.endDate);
    if (dto.registrationDeadline)
      partial.registrationDeadline = new Date(dto.registrationDeadline);
    if (dto.coordinates) {
      partial.coordinates = {
        type: 'Point',
        coordinates: [dto.coordinates.lng, dto.coordinates.lat],
      };
    }

    Object.assign(event, partial);
    const saved = await this.repo.save(event);
    return this.serializeEvent(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(await this.findEntity(id));
  }

  private serializeEvent(
    event: Event,
    extra?: Record<string, unknown>,
  ): SerializedEvent {
    const coords = event.coordinates;
    return {
      ...event,
      coordinates:
        coords?.type === 'Point'
          ? { lat: coords.coordinates[1], lng: coords.coordinates[0] }
          : null,
      ...extra,
    };
  }
}
