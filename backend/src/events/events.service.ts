import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CommunityMember,
  CommunityMemberRole,
} from '../communities/entities/community-member.entity';
import {
  Community,
  CommunityVisibility,
} from '../communities/entities/community.entity';
import {
  SubgroupMember,
  SubgroupMemberRole,
} from '../communities/entities/subgroup-member.entity';
import {
  Subgroup,
  SubgroupVisibility,
} from '../communities/entities/subgroup.entity';
import {
  communityForbidden,
  CommunityErrorCode,
} from '../communities/community-error';
import {
  Event,
  EventListing,
  EventSource,
  EventStatus,
} from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventSearchDto, EventSort } from './dto/event-search.dto';
import {
  AdminMissingDataDto,
  MissingDataType,
} from './dto/admin-missing-data.dto';
import { GeocodingService } from './geocoding.service';
import { UploadedFile, UploadsService } from '../uploads/uploads.service';

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
    @InjectRepository(Community)
    private readonly communities: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly communityMembers: Repository<CommunityMember>,
    @InjectRepository(Subgroup)
    private readonly subgroups: Repository<Subgroup>,
    @InjectRepository(SubgroupMember)
    private readonly subgroupMembers: Repository<SubgroupMember>,
    private readonly geocoding: GeocodingService,
    private readonly uploads: UploadsService,
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
    qb.andWhere('event.listing = :publicListing', {
      publicListing: EventListing.PUBLIC,
    });

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

  async findOne(id: string, userId?: string): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    if (!(await this.canSee(event, userId))) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return this.serializeEvent(event);
  }

  private async findEntity(id: string): Promise<Event> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  async create(
    dto: CreateEventDto,
    userId?: string,
    host?: {
      communityId: string;
      subgroupId: string | null;
      listing: EventListing;
    },
  ): Promise<Event> {
    let coordinates = dto.coordinates;

    if (!coordinates && dto.locationName) {
      const geo = await this.geocoding.geocodeLocation(
        dto.locationName,
        dto.address,
        dto.country,
      );
      if (geo) coordinates = geo;
    }

    const entity = this.repo.create({
      ...dto,
      source: userId ? EventSource.MANUAL : (dto.source ?? EventSource.MANUAL),
      createdById: userId ?? undefined,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      registrationDeadline: dto.registrationDeadline
        ? new Date(dto.registrationDeadline)
        : undefined,
      coordinates: coordinates
        ? {
            type: 'Point',
            coordinates: [coordinates.lng, coordinates.lat],
          }
        : undefined,
      communityId: host?.communityId ?? null,
      subgroupId: host?.subgroupId ?? null,
      listing: host?.listing ?? EventListing.PUBLIC,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    user?: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    if (!(await this.canSee(event, user?.id))) {
      throw new NotFoundException(`Event ${id} not found`);
    }

    if (user) {
      this.assertOwnerOrAdmin(event, user);
    }

    const partial: Partial<Event> = { ...dto } as Partial<Event>;

    if (dto.startDate) partial.startDate = new Date(dto.startDate);
    if (dto.endDate) partial.endDate = new Date(dto.endDate);
    if (dto.registrationDeadline)
      partial.registrationDeadline = new Date(dto.registrationDeadline);

    let coordinates = dto.coordinates;
    if (
      !coordinates &&
      dto.locationName &&
      dto.locationName !== event.locationName
    ) {
      const geo = await this.geocoding.geocodeLocation(
        dto.locationName,
        dto.address ?? event.address,
        dto.country ?? event.country,
      );
      if (geo) coordinates = geo;
    }

    if (coordinates) {
      partial.coordinates = {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat],
      };
    }

    Object.assign(event, partial);
    const saved = await this.repo.save(event);
    return this.serializeEvent(saved);
  }

  async remove(
    id: string,
    user?: { id: string; isAdmin: boolean },
  ): Promise<void> {
    const event = await this.findEntity(id);
    if (!(await this.canSee(event, user?.id))) {
      throw new NotFoundException(`Event ${id} not found`);
    }

    if (user) {
      this.assertOwnerOrAdmin(event, user);
    }

    // Best-effort cleanup — removing the event row has to succeed either way.
    await this.uploads.remove('events', event.id);
    await this.repo.remove(event);
  }

  async setImage(
    id: string,
    file: UploadedFile,
    user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    this.assertOwnerOrAdmin(event, user);

    const url = await this.uploads.save('events', event.id, file);
    event.imageUrl = url;
    const saved = await this.repo.save(event);
    return this.serializeEvent(saved);
  }

  async removeImage(
    id: string,
    user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    this.assertOwnerOrAdmin(event, user);

    await this.uploads.remove('events', event.id);
    event.imageUrl = null as unknown as string;
    const saved = await this.repo.save(event);
    return this.serializeEvent(saved);
  }

  async findMissingData(dto: AdminMissingDataDto): Promise<PaginatedEvents> {
    const qb = this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.discipline', 'discipline')
      .andWhere('event.startDate >= NOW()');

    switch (dto.type) {
      case MissingDataType.URL:
        qb.andWhere("(event.externalUrl IS NULL OR event.externalUrl = '')");
        break;
      case MissingDataType.ADDRESS:
        qb.andWhere("(event.address IS NULL OR event.address = '')");
        break;
      case MissingDataType.COORDINATES:
        qb.andWhere('event.coordinates IS NULL');
        break;
      case MissingDataType.DESCRIPTION:
        qb.andWhere("(event.description IS NULL OR event.description = '')");
        break;
      default:
        qb.andWhere(
          "((event.externalUrl IS NULL OR event.externalUrl = '') " +
            "OR (event.address IS NULL OR event.address = '') " +
            'OR event.coordinates IS NULL ' +
            "OR (event.description IS NULL OR event.description = ''))",
        );
    }

    qb.orderBy('event.startDate', 'ASC');

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((e) => ({
        ...this.serializeEvent(e),
        missingFields: this.detectMissing(e),
      })),
      total,
      page,
      limit,
    };
  }

  async getMissingDataStats(): Promise<Record<string, number>> {
    const future = this.repo
      .createQueryBuilder('e')
      .andWhere('e.startDate >= NOW()');

    const [url, address, coordinates, description] = await Promise.all([
      future
        .clone()
        .andWhere("(e.externalUrl IS NULL OR e.externalUrl = '')")
        .getCount(),
      future
        .clone()
        .andWhere("(e.address IS NULL OR e.address = '')")
        .getCount(),
      future.clone().andWhere('e.coordinates IS NULL').getCount(),
      future
        .clone()
        .andWhere("(e.description IS NULL OR e.description = '')")
        .getCount(),
    ]);

    return { url, address, coordinates, description };
  }

  private detectMissing(event: Event): string[] {
    const missing: string[] = [];
    if (!event.externalUrl) missing.push('url');
    if (!event.address) missing.push('address');
    if (!event.coordinates) missing.push('coordinates');
    if (!event.description) missing.push('description');
    return missing;
  }

  async listHosted(
    communitySlug: string,
    userId: string | undefined,
    subgroupSlug?: string,
  ): Promise<SerializedEvent[]> {
    const host = await this.resolveHost(
      communitySlug,
      userId,
      subgroupSlug,
      false,
    );
    const qb = this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.discipline', 'discipline')
      .where('event.communityId = :communityId', {
        communityId: host.community.id,
      })
      .andWhere('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.startDate >= :from', { from: new Date() });
    if (host.subgroup) {
      qb.andWhere('event.subgroupId = :subgroupId', {
        subgroupId: host.subgroup.id,
      });
    } else {
      qb.andWhere('event.subgroupId IS NULL');
    }
    if (!host.canSeeMembers) {
      qb.andWhere('event.listing = :publicListing', {
        publicListing: EventListing.PUBLIC,
      });
    }
    qb.orderBy('event.startDate', 'ASC').take(20);
    const rows = await qb.getMany();
    return rows.map((event) => this.serializeEvent(event));
  }

  async createHosted(
    communitySlug: string,
    userId: string,
    dto: CreateEventDto & { listing?: EventListing },
    subgroupSlug?: string,
  ): Promise<SerializedEvent> {
    const host = await this.resolveHost(
      communitySlug,
      userId,
      subgroupSlug,
      true,
    );
    const listing = dto.listing ?? EventListing.MEMBERS;
    const event = await this.create(dto, userId, {
      communityId: host.community.id,
      subgroupId: host.subgroup?.id ?? null,
      listing,
    });
    return this.serializeEvent(event);
  }

  private async resolveHost(
    communitySlug: string,
    userId: string | undefined,
    subgroupSlug: string | undefined,
    forCreate: boolean,
  ): Promise<{
    community: Community;
    subgroup: Subgroup | null;
    canSeeMembers: boolean;
  }> {
    const community = await this.communities.findOne({
      where: { slug: communitySlug },
    });
    if (!community) throw new NotFoundException('Community not found');
    const communityMember = userId
      ? await this.communityMembers.findOne({
          where: { communityId: community.id, userId },
        })
      : null;
    if (
      community.visibility === CommunityVisibility.PRIVATE &&
      !communityMember
    ) {
      throw new NotFoundException('Community not found');
    }
    const isAdmin = communityMember?.role === CommunityMemberRole.ADMIN;
    if (!subgroupSlug) {
      if (forCreate && !isAdmin) {
        throw communityForbidden(CommunityErrorCode.membersOnly);
      }
      return { community, subgroup: null, canSeeMembers: !!communityMember };
    }
    const subgroup = await this.subgroups.findOne({
      where: { communityId: community.id, slug: subgroupSlug },
    });
    if (!subgroup) throw new NotFoundException('Subgroup not found');
    const subgroupMember = userId
      ? await this.subgroupMembers.findOne({
          where: { subgroupId: subgroup.id, userId },
        })
      : null;
    if (
      subgroup.visibility === SubgroupVisibility.INVITE &&
      !isAdmin &&
      !subgroupMember
    ) {
      throw new NotFoundException('Subgroup not found');
    }
    const canModerate =
      isAdmin || subgroupMember?.role === SubgroupMemberRole.MODERATOR;
    if (forCreate && !canModerate) {
      throw communityForbidden(CommunityErrorCode.membersOnly);
    }
    return {
      community,
      subgroup,
      canSeeMembers: !!subgroupMember || !!isAdmin,
    };
  }

  private async canSee(event: Event, userId?: string): Promise<boolean> {
    if (event.listing !== EventListing.MEMBERS) return true;
    if (!userId || !event.communityId) return false;
    const communityMember = await this.communityMembers.findOne({
      where: { communityId: event.communityId, userId },
    });
    if (!event.subgroupId) return !!communityMember;
    if (communityMember?.role === CommunityMemberRole.ADMIN) return true;
    const subgroupMember = await this.subgroupMembers.findOne({
      where: { subgroupId: event.subgroupId, userId },
    });
    return !!subgroupMember;
  }

  private assertOwnerOrAdmin(
    event: Event,
    user: { id: string; isAdmin: boolean },
  ): void {
    if (user.isAdmin) return;
    if (event.createdById && event.createdById === user.id) return;
    throw new ForbiddenException('You can only modify your own events');
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
