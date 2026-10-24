import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { notInSuspendedCommunitySql } from '../communities/community-suspension';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { EventComment } from './entities/event-comment.entity';
import { EventClass } from './entities/event-class.entity';
import { classFitsSql } from './class-match';
import { EventClassDto } from './dto/event-class.dto';
import { EventRsvp, EventRsvpStatus } from './entities/event-rsvp.entity';
import { EventShare } from './entities/event-share.entity';
import { EventRecurrence } from './entities/event-recurrence.entity';
import { EventPaceGroup } from './entities/event-pace-group.entity';
import { EventStravaLink } from './entities/event-strava-link.entity';
import { Route } from '../routes/entities/route.entity';
import { serializeRoute } from '../routes/serialize';
import { berlinTimeOfDay } from '../import/dates';
import { IMPORT_FIELDS } from '../import/import-diff';
import {
  PaceGroupDto,
  SetPaceGroupsDto,
  SetStravaLinksDto,
  StravaLinkDto,
} from './dto/pace-groups.dto';
import { assertTimeZone, occurrenceStarts } from './recurrence';
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
  assertCommunityActive,
  communityForbidden,
  communityNotFound,
  CommunityErrorCode,
} from '../communities/community-error';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import {
  Event,
  EventListing,
  EventSource,
  EventStatus,
} from './entities/event.entity';
import { BadWordService } from '../common/bad-words';
import { CreateEventDto, RecurrenceDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  EventListView,
  EventSearchDto,
  EventSort,
} from './dto/event-search.dto';
import {
  AdminMissingDataDto,
  MissingDataType,
} from './dto/admin-missing-data.dto';
import { GeocodingService } from './geocoding.service';
import { ImageAccessService } from '../uploads/image-access.service';
import { UploadedFile, UploadsService } from '../uploads/uploads.service';

export interface SerializedEvent {
  coordinates?: { lat: number; lng: number } | null;
  distance?: number;
  [key: string]: any;
}

export interface SerializedEventClass {
  id: string;
  name: string;
  gender: string;
  ageMin: number | null;
  ageMax: number | null;
  license: string;
  startTime: Date | null;
  championship: string | null;
  note: string | null;
}

export interface SerializedEventSeries {
  id: string;
  slug: string;
  name: string;
  kind: string;
  season: string | null;
  round: number | null;
  label: string | null;
}

export interface HostQuery {
  community?: string;
  subgroup?: string;
}

interface EventScope {
  communityId: string;
  subgroupId: string | null;
  member: boolean;
  manager: boolean;
  share: EventShare | null;
  hostCommunity: { name: string; slug: string };
}

export interface MyUpcomingEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  locationName: string;
  cancelled: boolean;
  disciplineSlug: string;
  myRsvp: 'going' | 'maybe';
  /** The club the answer belongs to; the event page needs it for club events. */
  community: { slug: string; name: string } | null;
  subgroup: { slug: string; name: string } | null;
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
    @InjectRepository(EventRsvp)
    private readonly rsvps: Repository<EventRsvp>,
    @InjectRepository(EventComment)
    private readonly comments: Repository<EventComment>,
    @InjectRepository(EventShare)
    private readonly shares: Repository<EventShare>,
    @InjectRepository(EventRecurrence)
    private readonly recurrences: Repository<EventRecurrence>,
    @InjectRepository(EventPaceGroup)
    private readonly paceGroups: Repository<EventPaceGroup>,
    @InjectRepository(EventStravaLink)
    private readonly stravaLinks: Repository<EventStravaLink>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(Community)
    private readonly communities: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly communityMembers: Repository<CommunityMember>,
    @InjectRepository(Subgroup)
    private readonly subgroups: Repository<Subgroup>,
    @InjectRepository(SubgroupMember)
    private readonly subgroupMembers: Repository<SubgroupMember>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(EventClass)
    private readonly eventClasses: Repository<EventClass>,
    private readonly geocoding: GeocodingService,
    private readonly uploads: UploadsService,
    private readonly imageAccess: ImageAccessService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly badWords: BadWordService,
  ) {}

  async findAll(
    params: EventSearchDto,
    userId?: string,
  ): Promise<PaginatedEvents> {
    let { lat, lng } = params;

    if (params.zip && lat == null) {
      const geo = await this.geocoding.geocodeZip(params.zip, params.country);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    const hasGeo = lat != null && lng != null;
    const marker = params.view === EventListView.MARKER;
    const qb = this.repo.createQueryBuilder('event');
    if (marker) {
      qb.leftJoin('event.discipline', 'discipline').select([
        'event.id',
        'event.name',
        'event.startDate',
        'event.locationName',
        'event.coordinates',
        'event.disciplineSlug',
        'event.status',
        'discipline.slug',
        'discipline.nameTranslations',
      ]);
    } else {
      qb.leftJoinAndSelect('event.discipline', 'discipline');
    }

    const status = params.status ?? EventStatus.PUBLISHED;
    qb.andWhere('event.status = :status', { status });
    this.applyAudience(qb, userId);

    if (params.q) {
      qb.andWhere('event.name ILIKE :q', { q: `%${params.q}%` });
    }

    if (params.discipline) {
      const slugs = params.discipline.split(',').map((s) => s.trim());
      qb.andWhere('event.disciplineSlug IN (:...slugs)', { slugs });
    }

    if (params.fitsMe && userId) {
      const rider = await this.users.findOne({
        where: { id: userId },
        select: { id: true, birthYear: true, gender: true, licenseType: true },
      });
      if (rider) {
        const fit = classFitsSql(rider);
        qb.andWhere(fit.sql, fit.params);
      }
    }
    if (params.championship) {
      qb.andWhere(
        `(event.championship IS NOT NULL OR EXISTS (SELECT 1 FROM "event_classes" cc WHERE cc.event_id = event.id AND cc.championship IS NOT NULL))`,
      );
    }
    if (params.hideLeagues) {
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM "race_series_events" lse JOIN "race_series" ls ON ls.id = lse.series_id WHERE lse.event_id = event.id AND ls.kind = 'league')`,
      );
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
      const access = marker ? null : await this.accessMap(entities, userId);
      const racing = marker ? null : await this.racingDetails(entities.map((e) => e.id));

      const data = entities.map((entity, i) =>
        this.toListEvent(entity, marker, {
          distance: raw[i]?.distance_m
            ? Math.round((parseFloat(raw[i].distance_m) / 1000) * 100) / 100
            : undefined,
          includeCommunityFields: access?.get(entity.id)?.member ?? false,
          ...(racing ? racing(entity.id) : {}),
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

    const [rows, total] = await qb.getManyAndCount();
    const access = marker ? null : await this.accessMap(rows, userId);
    const racing = marker ? null : await this.racingDetails(rows.map((e) => e.id));
    return {
      data: rows.map((event) =>
        this.toListEvent(event, marker, {
          includeCommunityFields: access?.get(event.id)?.member ?? false,
          ...(racing ? racing(event.id) : {}),
        }),
      ),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async findOne(
    id: string,
    userId?: string,
    ctx?: HostQuery,
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    return this.present(
      event,
      userId,
      await this.shareScope(event, userId, ctx),
    );
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
      stravaUrl?: string | null;
      meetupPlace?: string | null;
      meetupAt?: string | null;
      meetupNote?: string | null;
    },
  ): Promise<Event> {
    const first = await this.buildEvent(dto, userId, host);
    const user = { id: userId ?? '', isAdmin: false };
    if (dto.paceGroups?.length)
      await this.validatePaceGroups(dto.paceGroups, user);
    return this.dataSource.transaction(async (manager) => {
      const saved = dto.recurrence
        ? await this.saveSeries(manager, first, dto.recurrence, userId)
        : await manager.save(first);
      await this.writeRideDetails(manager, saved, dto);
      if (dto.classes?.length) await this.writeClasses(manager, saved.id, dto.classes);
      return saved;
    });
  }

  /** Pace groups and Strava links given at creation go on every occurrence. */
  private async writeRideDetails(
    manager: EntityManager,
    saved: Event,
    dto: Pick<CreateEventDto, 'paceGroups' | 'stravaLinks'>,
  ): Promise<void> {
    if (!dto.paceGroups?.length && !dto.stravaLinks?.length) return;
    const ids = saved.recurrenceId
      ? (
          await manager.find(Event, {
            where: { recurrenceId: saved.recurrenceId },
            select: { id: true },
          })
        ).map((row) => row.id)
      : [saved.id];
    await this.writePaceGroups(manager, ids, dto.paceGroups ?? []);
    for (const eventId of ids) {
      await this.writeStravaLinks(
        manager,
        eventId,
        null,
        dto.stravaLinks ?? [],
      );
    }
  }

  /**
   * Saves `first` plus its repeats. Each occurrence is a real event so it can
   * be edited, RSVPed to or deleted on its own. Returns the first one.
   */
  private async saveSeries(
    manager: EntityManager,
    first: Event,
    recurrence: RecurrenceDto,
    userId?: string,
  ): Promise<Event> {
    assertTimeZone(recurrence.timezone);
    const starts = occurrenceStarts(
      first.startDate,
      recurrence.frequency,
      recurrence.timezone,
      {
        until: recurrence.until ? new Date(recurrence.until) : undefined,
        count: recurrence.count,
      },
    );
    const series = await manager.save(
      this.recurrences.create({
        frequency: recurrence.frequency,
        timezone: recurrence.timezone,
        createdById: userId ?? null,
      }),
    );
    const base = first.startDate.getTime();
    const events = starts.map((start, index) => {
      if (index === 0) return Object.assign(first, { recurrenceId: series.id });
      const shift = start.getTime() - base;
      const moved = (date: Date | null | undefined): Date | undefined =>
        date ? new Date(date.getTime() + shift) : undefined;
      return this.repo.create({
        ...first,
        id: undefined,
        recurrenceId: series.id,
        startDate: start,
        endDate: moved(first.endDate),
        registrationStart: moved(first.registrationStart),
        registrationDeadline: moved(first.registrationDeadline),
        meetupAt: first.meetupAt ? moved(first.meetupAt) : null,
      });
    });
    const saved = await manager.save(events);
    return saved[0];
  }

  private async assertOwnsRoute(
    routeId: string,
    userId?: string,
    user?: { isAdmin: boolean },
  ): Promise<void> {
    const route = await this.routes.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Route not found');
    if (user?.isAdmin) return;
    if (!userId || route.createdById !== userId) {
      throw new ForbiddenException('You can only use your own routes');
    }
  }

  /** True when `userId` can see an event that uses the route. */
  async canViewRoute(routeId: string, userId?: string): Promise<boolean> {
    const rows = await this.repo
      .createQueryBuilder('event')
      .where('event.routeId = :routeId', { routeId })
      .orWhere(
        'event.id IN (SELECT event_id FROM event_pace_groups WHERE route_id = :routeId)',
        { routeId },
      )
      .getMany();
    for (const event of rows) {
      if (await this.canSee(event, userId)) return true;
    }
    return false;
  }

  async setPaceGroups(
    id: string,
    dto: SetPaceGroupsDto,
    user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    await this.assertCanMutate(event, user);
    // Routes the event already uses stay valid even if another editor owns them.
    const existing = await this.paceGroups.find({ where: { eventId: id } });
    const keep = new Set(
      [event.routeId, ...existing.map((group) => group.routeId)].filter(
        (value): value is string => !!value,
      ),
    );
    await this.validatePaceGroups(dto.paceGroups, user, keep);
    await this.dataSource.transaction(async (manager) => {
      // Replacing the list also removes the groups' own Strava links (cascade).
      await manager.delete(EventPaceGroup, { eventId: id });
      await this.writePaceGroups(manager, [id], dto.paceGroups);
    });
    return this.present(event, user.id);
  }

  private async validatePaceGroups(
    groups: PaceGroupDto[],
    user: { id: string; isAdmin: boolean },
    keep: Set<string> = new Set(),
  ): Promise<void> {
    const violations = groups.flatMap((group, index) => {
      const texts = [
        group.name,
        ...(group.stravaLinks ?? []).map((link) => link.label ?? ''),
      ];
      return this.badWords
        .checkFields({ name: texts.join(' ') }, ['name'])
        .violations.map(() => ({ field: `paceGroups.${index}` }));
    });
    if (violations.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'content_policy_violation',
        message: 'Content contains inappropriate language',
        violations,
      });
    }
    for (const group of groups) {
      if (group.speedMaxKmh < group.speedMinKmh) {
        throw new BadRequestException('Max speed must not be below min speed');
      }
      if (group.routeId && !keep.has(group.routeId)) {
        await this.assertOwnsRoute(group.routeId, user.id, user);
      }
    }
  }

  private async writePaceGroups(
    manager: EntityManager,
    eventIds: string[],
    groups: PaceGroupDto[],
  ): Promise<void> {
    for (const eventId of eventIds) {
      for (const [index, group] of groups.entries()) {
        const saved = await manager.save(
          this.paceGroups.create({
            eventId,
            name: group.name.trim(),
            category: group.category,
            speedMinKmh: group.speedMinKmh,
            speedMaxKmh: group.speedMaxKmh,
            routeId: group.routeId || null,
            sortOrder: index,
          }),
        );
        await this.writeStravaLinks(
          manager,
          eventId,
          saved.id,
          group.stravaLinks ?? [],
        );
      }
    }
  }

  private async writeStravaLinks(
    manager: EntityManager,
    eventId: string,
    paceGroupId: string | null,
    links: StravaLinkDto[],
  ): Promise<void> {
    for (const [index, link] of links.entries()) {
      await manager.save(
        this.stravaLinks.create({
          eventId,
          paceGroupId,
          url: link.url.trim(),
          label: link.label?.trim() || null,
          sortOrder: index,
        }),
      );
    }
  }

  async setStravaLinks(
    id: string,
    dto: SetStravaLinksDto,
    user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    await this.assertCanMutate(event, user);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(EventStravaLink, {
        eventId: id,
        paceGroupId: IsNull(),
      });
      await this.writeStravaLinks(manager, id, null, dto.links);
    });
    return this.present(event, user.id);
  }

  private async rideDetails(event: Event, viewerId?: string) {
    const [groups, links] = await Promise.all([
      this.paceGroups.find({
        where: { eventId: event.id },
        order: { sortOrder: 'ASC' },
      }),
      this.stravaLinks.find({
        where: { eventId: event.id },
        order: { sortOrder: 'ASC' },
      }),
    ]);
    const routeIds = [
      ...new Set(
        [event.routeId, ...groups.map((group) => group.routeId)].filter(
          (value): value is string => !!value,
        ),
      ),
    ];
    const routeRows = routeIds.length
      ? await this.routes.find({
          where: { id: In(routeIds) },
          relations: { files: true },
        })
      : [];
    const routeById = new Map(
      routeRows.map((route) => [
        route.id,
        serializeRoute(route, !!viewerId && route.createdById === viewerId),
      ]),
    );
    const linkView = (link: EventStravaLink) => ({
      id: link.id,
      url: link.url,
      label: link.label,
    });
    return {
      route: event.routeId ? (routeById.get(event.routeId) ?? null) : null,
      stravaLinks: links.filter((l) => !l.paceGroupId).map(linkView),
      paceGroups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        category: group.category,
        speedMinKmh: group.speedMinKmh,
        speedMaxKmh: group.speedMaxKmh,
        route: group.routeId ? (routeById.get(group.routeId) ?? null) : null,
        stravaLinks: links
          .filter((l) => l.paceGroupId === group.id)
          .map(linkView),
      })),
    };
  }

  /**
   * Stops a repeating series at this event: this occurrence and every later
   * one are removed, earlier ones stay. Deleting a single occurrence is the
   * normal event delete.
   */
  async stopSeries(
    id: string,
    user?: { id: string; isAdmin: boolean },
  ): Promise<{ removed: number }> {
    const event = await this.findEntity(id);
    if (!user)
      throw new ForbiddenException('You can only modify your own events');
    await this.assertCanMutate(event, user);
    if (!event.recurrenceId) {
      throw new BadRequestException('This event is not part of a series');
    }
    const later = await this.repo
      .createQueryBuilder('event')
      .select('event.id', 'id')
      .where('event.recurrenceId = :recurrenceId', {
        recurrenceId: event.recurrenceId,
      })
      .andWhere('event.startDate >= :from', { from: event.startDate })
      .getRawMany<{ id: string }>();
    const ids = later.map((row) => row.id);
    if (ids.length > 0) await this.repo.delete(ids);
    await this.recurrences.update(event.recurrenceId, { endedAt: new Date() });
    for (const id of ids) await this.uploads.remove('events', id);
    return { removed: ids.length };
  }

  private async buildEvent(
    dto: CreateEventDto,
    userId?: string,
    host?: {
      communityId: string;
      subgroupId: string | null;
      listing: EventListing;
      stravaUrl?: string | null;
      meetupPlace?: string | null;
      meetupAt?: string | null;
      meetupNote?: string | null;
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

    assertRegistrationOrder(
      dto.registrationStart ? new Date(dto.registrationStart) : null,
      dto.registrationDeadline ? new Date(dto.registrationDeadline) : null,
    );
    if (dto.routeId) await this.assertOwnsRoute(dto.routeId, userId);
    const {
      recurrence: _recurrence,
      paceGroups: _paceGroups,
      stravaLinks: _stravaLinks,
      ...eventFields
    } = dto;
    void _recurrence;
    void _paceGroups;
    void _stravaLinks;
    const entity = this.repo.create({
      ...eventFields,
      source: userId ? EventSource.MANUAL : (dto.source ?? EventSource.MANUAL),
      createdById: userId ?? undefined,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      startTimeKnown:
        dto.startTimeKnown ?? hasBerlinTime(new Date(dto.startDate)),
      registrationStart: dto.registrationStart
        ? new Date(dto.registrationStart)
        : undefined,
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
      stravaUrl: host ? (host.stravaUrl ?? null) : null,
      meetupPlace: host ? host.meetupPlace || null : null,
      meetupAt: host?.meetupAt ? new Date(host.meetupAt) : null,
      meetupNote: host ? host.meetupNote || null : null,
    });
    return entity;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    user?: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    if (!user)
      throw new ForbiddenException('You can only modify your own events');
    await this.assertCanMutate(event, user);

    const partial: Partial<Event> = { ...dto } as Partial<Event>;
    if (!event.communityId) {
      delete partial.listing;
      delete partial.stravaUrl;
      delete partial.meetupPlace;
      delete partial.meetupAt;
      delete partial.meetupNote;
    } else {
      if (dto.stravaUrl !== undefined)
        partial.stravaUrl = dto.stravaUrl || null;
      if (dto.meetupPlace !== undefined) {
        partial.meetupPlace = dto.meetupPlace.trim() || null;
      }
      if (dto.meetupNote !== undefined) {
        partial.meetupNote = dto.meetupNote.trim() || null;
      }
      if (dto.meetupAt !== undefined) {
        partial.meetupAt = dto.meetupAt ? new Date(dto.meetupAt) : null;
      }
    }

    if (dto.routeId !== undefined) {
      if (dto.routeId && dto.routeId !== event.routeId) {
        await this.assertOwnsRoute(dto.routeId, user.id, user);
      }
      partial.routeId = dto.routeId || null;
    }

    if (dto.startDate) {
      partial.startDate = new Date(dto.startDate);
      partial.startTimeKnown =
        dto.startTimeKnown ?? hasBerlinTime(partial.startDate);
    } else if (dto.startTimeKnown !== undefined) {
      partial.startTimeKnown = dto.startTimeKnown;
    }
    if (dto.endDate) partial.endDate = new Date(dto.endDate);
    if (dto.registrationStart !== undefined) {
      partial.registrationStart = dto.registrationStart
        ? new Date(dto.registrationStart)
        : null;
    }
    if (dto.registrationDeadline !== undefined) {
      partial.registrationDeadline = dto.registrationDeadline
        ? new Date(dto.registrationDeadline)
        : null;
    }
    assertRegistrationOrder(
      partial.registrationStart !== undefined
        ? partial.registrationStart
        : event.registrationStart,
      partial.registrationDeadline !== undefined
        ? partial.registrationDeadline
        : event.registrationDeadline,
    );

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

    delete (partial as Record<string, unknown>)['classes'];
    // Corrections to an imported event survive the next import (see ImportService).
    if (event.source === EventSource.IMPORTED) {
      const edited = editedImportFields(event, partial);
      if (dto.classes !== undefined) edited.push('classes');
      if (edited.length) {
        partial.editedFields = [
          ...new Set([...(event.editedFields ?? []), ...edited]),
        ];
      }
    }

    Object.assign(event, partial);
    const saved = await this.dataSource.transaction(async (manager) => {
      const row = await manager.save(event);
      if (dto.classes !== undefined) await this.writeClasses(manager, row.id, dto.classes);
      return row;
    });
    return this.present(saved, user?.id);
  }

  /** Replaces the rating classes of an event. */
  private async writeClasses(
    manager: EntityManager,
    eventId: string,
    classes: EventClassDto[],
  ): Promise<void> {
    await manager.delete(EventClass, { eventId });
    if (!classes.length) return;
    await manager.save(
      classes.map((c, position) =>
        manager.create(EventClass, {
          eventId,
          position,
          name: c.name.trim(),
          gender: (c.gender ?? 'open') as EventClass['gender'],
          ageMin: c.ageMin ?? null,
          ageMax: c.ageMax ?? null,
          license: (c.license ?? 'none') as EventClass['license'],
          startTime: c.startTime ? new Date(c.startTime) : null,
          championship: (c.championship ?? null) as EventClass['championship'],
          note: c.note?.trim() || null,
        }),
      ),
    );
  }

  /** Admins only: the import bookkeeping of an event. */
  async getImportInfo(id: string) {
    const event = await this.findEntity(id);
    const run = event.importRunId
      ? await this.dataSource.query<
          {
            id: string;
            fileName: string | null;
            startedAt: Date;
            triggeredBy: string | null;
          }[]
        >(
          `SELECT "id", "file_name" AS "fileName", "startedAt", "triggeredBy" FROM "import_runs" WHERE "id" = $1`,
          [event.importRunId],
        )
      : [];
    return {
      source: event.source,
      sourceName: event.sourceName,
      externalId: event.externalId,
      sourceUrl: event.sourceUrl,
      lastSeenAt: event.lastSeenAt,
      missingSince: event.missingSince,
      sources: event.sources ?? [],
      conflicts: event.importConflicts ?? [],
      editedFields: event.editedFields ?? [],
      importRun: run[0] ?? null,
    };
  }

  async remove(
    id: string,
    user?: { id: string; isAdmin: boolean },
  ): Promise<void> {
    const event = await this.findEntity(id);
    if (!user)
      throw new ForbiddenException('You can only modify your own events');
    await this.assertCanMutate(event, user);

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
    await this.assertCanMutate(event, user);

    const url = await this.uploads.save('events', event.id, file);
    event.imageUrl = url;
    const saved = await this.repo.save(event);
    return this.present(saved, user.id);
  }

  async removeImage(
    id: string,
    user: { id: string; isAdmin: boolean },
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    await this.assertCanMutate(event, user);

    await this.uploads.remove('events', event.id);
    event.imageUrl = null as unknown as string;
    const saved = await this.repo.save(event);
    return this.present(saved, user.id);
  }

  /**
   * Upcoming events the user answered "going" or "maybe" for, soonest first.
   * Club events only show while the user still belongs to the club.
   */
  async listMyUpcoming(userId: string): Promise<MyUpcomingEvent[]> {
    const rows = await this.rsvps.query<Record<string, unknown>[]>(
      `SELECT e."id", e."name", e."startDate", e."endDate", e."locationName", e."status" AS "eventStatus",
              e."discipline_slug" AS "disciplineSlug", r."status" AS "myRsvp",
              c."slug" AS "communitySlug", c."name" AS "communityName",
              sg."slug" AS "subgroupSlug", sg."name" AS "subgroupName"
       FROM "event_rsvps" r
       JOIN "events" e ON e."id" = r."event_id"
       LEFT JOIN "event_shares" s ON s."id" = r."share_id"
       LEFT JOIN "communities" c ON c."id" = COALESCE(e."community_id", s."community_id")
       LEFT JOIN "subgroups" sg ON sg."id" = COALESCE(e."subgroup_id", s."subgroup_id")
       WHERE r."user_id" = $1
         AND r."status" IN ('going', 'maybe')
         AND COALESCE(e."endDate", e."startDate" + interval '1 day') >= now()
         AND ${notInSuspendedCommunitySql('e')}
         AND (
           r."share_id" IS NULL
           OR (s."subgroup_id" IS NULL AND EXISTS (
                SELECT 1 FROM "community_members" cm
                WHERE cm."community_id" = s."community_id" AND cm."user_id" = $1))
           OR (s."subgroup_id" IS NOT NULL AND (
                EXISTS (SELECT 1 FROM "subgroup_members" sm
                        WHERE sm."subgroup_id" = s."subgroup_id" AND sm."user_id" = $1)
                OR EXISTS (SELECT 1 FROM "community_members" cm
                           WHERE cm."community_id" = s."community_id" AND cm."user_id" = $1
                             AND cm."role" = 'admin')))
         )
         AND (
           e."community_id" IS NULL
           OR (e."subgroup_id" IS NULL AND EXISTS (
                SELECT 1 FROM "community_members" cm
                WHERE cm."community_id" = e."community_id" AND cm."user_id" = $1))
           OR (e."subgroup_id" IS NOT NULL AND (
                EXISTS (SELECT 1 FROM "subgroup_members" sm
                        WHERE sm."subgroup_id" = e."subgroup_id" AND sm."user_id" = $1)
                OR EXISTS (SELECT 1 FROM "community_members" cm
                           WHERE cm."community_id" = e."community_id" AND cm."user_id" = $1
                             AND cm."role" = 'admin')))
         )
       ORDER BY e."startDate" ASC
       LIMIT 50`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      startDate: (r.startDate as Date).toISOString(),
      endDate: r.endDate ? (r.endDate as Date).toISOString() : null,
      locationName: (r.locationName as string) ?? '',
      cancelled: r.eventStatus === 'cancelled',
      disciplineSlug: r.disciplineSlug as string,
      myRsvp: r.myRsvp as 'going' | 'maybe',
      community: r.communitySlug
        ? { slug: r.communitySlug as string, name: r.communityName as string }
        : null,
      subgroup: r.subgroupSlug
        ? { slug: r.subgroupSlug as string, name: r.subgroupName as string }
        : null,
    }));
  }

  async findMissingAtSource(
    page: number,
    limit: number,
  ): Promise<PaginatedEvents> {
    const [data, total] = await this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.discipline', 'discipline')
      .where("event.source = 'imported'")
      .andWhere('event.missingSince IS NOT NULL')
      .andWhere('event.startDate >= NOW()')
      .orderBy('event.missingSince', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data: data.map((e) => ({
        ...this.serializeEvent(e),
        sourceName: e.sourceName,
        sourceUrl: e.sourceUrl,
        lastSeenAt: e.lastSeenAt,
        missingSince: e.missingSince,
      })),
      total,
      page,
      limit,
    };
  }

  async findMissingData(dto: AdminMissingDataDto): Promise<PaginatedEvents> {
    const qb = this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.discipline', 'discipline')
      .andWhere('event.startDate >= NOW()')
      .andWhere('event.listing = :publicListing', {
        publicListing: EventListing.PUBLIC,
      });

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
      .andWhere('e.startDate >= NOW()')
      .andWhere('e.listing = :publicListing', {
        publicListing: EventListing.PUBLIC,
      });

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

    const sharedRows = await this.shares
      .createQueryBuilder('share')
      .innerJoinAndSelect('share.event', 'event')
      .leftJoinAndSelect('event.discipline', 'discipline')
      .where('share.communityId = :communityId', {
        communityId: host.community.id,
      })
      .andWhere(
        host.subgroup
          ? 'share.subgroupId = :subgroupId'
          : 'share.subgroupId IS NULL',
        host.subgroup ? { subgroupId: host.subgroup.id } : {},
      )
      .andWhere('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.listing = :publicListing', {
        publicListing: EventListing.PUBLIC,
      })
      .andWhere('event.startDate >= :from', { from: new Date() })
      .orderBy('event.startDate', 'ASC')
      .take(20)
      .getMany();

    const scope = {
      communityId: host.community.id,
      subgroupId: host.subgroup?.id ?? null,
    };
    const all = [
      ...rows.map((event) => ({ event, share: null as EventShare | null })),
      ...sharedRows.map((share) => ({ event: share.event, share })),
    ]
      .sort((a, b) => +a.event.startDate - +b.event.startDate)
      .slice(0, 20);
    const counts = host.canSeeMembers
      ? await this.goingCounts(
          all.map(({ event, share }) => ({
            eventId: event.id,
            shareId: share?.id ?? null,
          })),
          scope,
        )
      : new Map<string, number>();
    return all.map(({ event, share }) =>
      this.serializeEvent(event, {
        ...(host.canSeeMembers ? { rsvpCount: counts.get(event.id) ?? 0 } : {}),
        ...(share ? this.shareFields(share, host.canSeeMembers) : {}),
        hostCommunity: {
          name: host.community.name,
          slug: host.community.slug,
        },
        includeCommunityFields: host.canSeeMembers,
      }),
    );
  }

  async shareEvent(
    communitySlug: string,
    userId: string,
    dto: {
      eventId: string;
      meetupPlace?: string;
      meetupAt?: string;
      meetupNote?: string;
    },
    subgroupSlug?: string,
  ): Promise<SerializedEvent> {
    const host = await this.resolveHost(
      communitySlug,
      userId,
      subgroupSlug,
      true,
    );
    const event = await this.findEntity(dto.eventId);
    if (
      event.communityId ||
      event.listing !== EventListing.PUBLIC ||
      event.status !== EventStatus.PUBLISHED
    ) {
      throw new NotFoundException(`Event ${dto.eventId} not found`);
    }
    const subgroupId = host.subgroup?.id ?? null;
    const existing = await this.findShare(
      event.id,
      host.community.id,
      subgroupId,
    );
    // Only keys the caller sent are written, so a second share call that
    // omits the meetup does not wipe one that is already stored.
    const fields: Partial<EventShare> = {};
    if (dto.meetupPlace !== undefined) {
      fields.meetupPlace = dto.meetupPlace.trim() || null;
    }
    if (dto.meetupAt !== undefined) {
      fields.meetupAt = dto.meetupAt ? new Date(dto.meetupAt) : null;
    }
    if (dto.meetupNote !== undefined) {
      fields.meetupNote = dto.meetupNote.trim() || null;
    }
    let share: EventShare;
    if (existing) {
      share = await this.shares.save({ ...existing, ...fields });
    } else {
      share = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          this.shares.create({
            eventId: event.id,
            communityId: host.community.id,
            subgroupId,
            createdById: userId,
            meetupPlace: null,
            meetupAt: null,
            meetupNote: null,
            ...fields,
          }),
        );
        await this.notifications.eventCreated(
          {
            actorId: userId,
            communityId: host.community.id,
            subgroupId,
            payload: {
              communityName: host.community.name,
              communitySlug: host.community.slug,
              subgroupName: host.subgroup?.name,
              subgroupSlug: host.subgroup?.slug,
              eventId: event.id,
              eventName: event.name,
            },
          },
          manager,
        );
        return saved;
      });
    }
    return this.present(event, userId, {
      communityId: host.community.id,
      subgroupId,
      member: true,
      manager: true,
      share,
      hostCommunity: { name: host.community.name, slug: host.community.slug },
    });
  }

  async unshareEvent(
    communitySlug: string,
    userId: string,
    eventId: string,
    subgroupSlug?: string,
  ): Promise<void> {
    const host = await this.resolveHost(
      communitySlug,
      userId,
      subgroupSlug,
      true,
    );
    const share = await this.findShare(
      eventId,
      host.community.id,
      host.subgroup?.id ?? null,
    );
    if (!share) throw new NotFoundException('Shared event not found');
    await this.shares.delete(share.id);
  }

  private findShare(
    eventId: string,
    communityId: string,
    subgroupId: string | null,
  ): Promise<EventShare | null> {
    return this.shares.findOne({
      where: {
        eventId,
        communityId,
        subgroupId: subgroupId ?? IsNull(),
      },
    });
  }

  private shareFields(share: EventShare, includeCommunityFields: boolean) {
    if (!includeCommunityFields) return {};
    return {
      meetupPlace: share.meetupPlace,
      meetupAt: share.meetupAt,
      meetupNote: share.meetupNote,
      shared: true,
    };
  }

  /**
   * The community audience an event's attendee data belongs to: the host of a
   * community event, or the community a public event was shared with (picked
   * by the `community`/`subgroup` query). Null when neither applies, which is
   * the case for plain public events: they carry no attendee data at all.
   */
  private async shareScope(
    event: Event,
    userId: string | undefined,
    ctx?: HostQuery,
  ): Promise<EventScope | null> {
    if (event.communityId) return null;
    if (!ctx?.community) return null;
    let host: Awaited<ReturnType<EventsService['resolveHost']>>;
    try {
      host = await this.resolveHost(ctx.community, userId, ctx.subgroup, false);
    } catch {
      return null;
    }
    const share = await this.findShare(
      event.id,
      host.community.id,
      host.subgroup?.id ?? null,
    );
    if (!share) return null;
    return {
      communityId: host.community.id,
      subgroupId: host.subgroup?.id ?? null,
      member: host.canSeeMembers,
      manager: host.canManage,
      share,
      hostCommunity: { name: host.community.name, slug: host.community.slug },
    };
  }

  async createHosted(
    communitySlug: string,
    userId: string,
    dto: CreateEventDto & {
      listing?: EventListing;
      stravaUrl?: string;
      meetupPlace?: string;
      meetupAt?: string;
      meetupNote?: string;
    },
    subgroupSlug?: string,
  ): Promise<SerializedEvent> {
    const host = await this.resolveHost(
      communitySlug,
      userId,
      subgroupSlug,
      true,
    );
    if (dto.paceGroups?.length) {
      await this.validatePaceGroups(dto.paceGroups, {
        id: userId,
        isAdmin: false,
      });
    }
    const listing = dto.listing ?? EventListing.MEMBERS;
    const entity = await this.buildEvent(dto, userId, {
      communityId: host.community.id,
      subgroupId: host.subgroup?.id ?? null,
      listing,
      stravaUrl: dto.stravaUrl || null,
      meetupPlace: dto.meetupPlace,
      meetupAt: dto.meetupAt,
      meetupNote: dto.meetupNote,
    });
    const event = await this.dataSource.transaction(async (manager) => {
      const saved = dto.recurrence
        ? await this.saveSeries(manager, entity, dto.recurrence, userId)
        : await manager.save(entity);
      await this.writeRideDetails(manager, saved, dto);
      await this.notifications.eventCreated(
        {
          actorId: userId,
          communityId: host.community.id,
          subgroupId: host.subgroup?.id ?? null,
          payload: {
            communityName: host.community.name,
            communitySlug: host.community.slug,
            subgroupName: host.subgroup?.name,
            subgroupSlug: host.subgroup?.slug,
            eventId: saved.id,
            eventName: saved.name,
          },
        },
        manager,
      );
      return saved;
    });
    return this.present(event, userId);
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
    canManage: boolean;
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
    assertCommunityActive(community);
    const isAdmin = communityMember?.role === CommunityMemberRole.ADMIN;
    if (!subgroupSlug) {
      if (forCreate && !isAdmin) {
        throw communityForbidden(CommunityErrorCode.membersOnly);
      }
      return {
        community,
        subgroup: null,
        canSeeMembers: !!communityMember,
        canManage: isAdmin,
      };
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
      canManage: canModerate,
    };
  }

  private applyAudience(
    qb: ReturnType<Repository<Event>['createQueryBuilder']>,
    userId?: string,
  ): void {
    // Events of a suspended community disappear from every list.
    qb.andWhere(notInSuspendedCommunitySql('event'));
    if (!userId) {
      qb.andWhere('event.listing = :publicListing', {
        publicListing: EventListing.PUBLIC,
      });
      return;
    }

    qb.andWhere(
      `(event.listing = :publicListing OR (
        event.listing = :membersListing
        AND event.community_id IS NOT NULL
        AND (
          (event.subgroup_id IS NULL AND EXISTS (
            SELECT 1 FROM community_members cm
            WHERE cm.community_id = event.community_id AND cm.user_id = :viewerId
          ))
          OR (event.subgroup_id IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM subgroup_members sm
              WHERE sm.subgroup_id = event.subgroup_id AND sm.user_id = :viewerId
            )
            OR EXISTS (
              SELECT 1 FROM community_members cm
              WHERE cm.community_id = event.community_id
                AND cm.user_id = :viewerId
                AND cm.role = :adminRole
            )
          ))
        )
      ))`,
      {
        publicListing: EventListing.PUBLIC,
        membersListing: EventListing.MEMBERS,
        viewerId: userId,
        adminRole: CommunityMemberRole.ADMIN,
      },
    );
  }

  async invite(id: string, actorId: string, email: string) {
    const event = await this.requireVisible(id, actorId);
    const access = await this.hostRole(event, actorId);
    if (!event.communityId || !access.manager) {
      throw communityForbidden(CommunityErrorCode.membersOnly);
    }
    const normalized = email.trim().toLowerCase();
    const invitee = await this.users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalized })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
    if (!invitee) throw communityNotFound(CommunityErrorCode.userNotFound);
    if (invitee.id === actorId) {
      return { outcome: 'self' as const, emailed: false, emailSkipped: null };
    }
    const target = await this.hostRole(event, invitee.id);
    if (!target.member) {
      throw communityForbidden(CommunityErrorCode.notCommunityMember);
    }
    const community = await this.communities.findOne({
      where: { id: event.communityId },
    });
    const subgroup = event.subgroupId
      ? await this.subgroups.findOne({ where: { id: event.subgroupId } })
      : null;
    const actor = await this.users.findOne({ where: { id: actorId } });
    return this.notifications.recordInvite({
      eventId: event.id,
      eventName: event.name,
      invitee,
      actorId,
      payload: {
        communityName: community?.name ?? '',
        communitySlug: community?.slug ?? '',
        subgroupName: subgroup?.name,
        subgroupSlug: subgroup?.slug,
        eventId: event.id,
        eventName: event.name,
        actorName: actor?.displayName ?? undefined,
      },
    });
  }

  async setRsvp(
    id: string,
    userId: string,
    status: EventRsvpStatus,
    ctx?: HostQuery,
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    if (!(await this.canSee(event, userId))) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    const scope = await this.attendeeScope(event, userId, ctx);
    if (!scope?.member)
      throw communityForbidden(CommunityErrorCode.membersOnly);
    await this.saveRsvp(id, userId, scope.share?.id ?? null, status);
    return this.present(event, userId, scope);
  }

  /**
   * Partial unique indexes cannot be targeted by TypeORM's `upsert`, so the
   * conflict clause is written out. A null share is a hosted event; a set
   * share is one club's copy of a public event.
   */
  private async saveRsvp(
    eventId: string,
    userId: string,
    shareId: string | null,
    status: EventRsvpStatus,
  ): Promise<void> {
    if (shareId) {
      await this.rsvps.query(
        `INSERT INTO "event_rsvps" ("event_id", "user_id", "share_id", "status")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("event_id", "user_id", "share_id") WHERE "share_id" IS NOT NULL
         DO UPDATE SET "status" = EXCLUDED."status", "updatedAt" = now()`,
        [eventId, userId, shareId, status],
      );
      return;
    }
    await this.rsvps.query(
      `INSERT INTO "event_rsvps" ("event_id", "user_id", "status")
       VALUES ($1, $2, $3)
       ON CONFLICT ("event_id", "user_id") WHERE "share_id" IS NULL
       DO UPDATE SET "status" = EXCLUDED."status", "updatedAt" = now()`,
      [eventId, userId, status],
    );
  }

  async listRsvps(
    id: string,
    userId: string,
    ctx?: HostQuery,
  ): Promise<
    { userId: string; displayName: string; status: EventRsvpStatus }[]
  > {
    const event = await this.requireVisible(id, userId);
    const scope = await this.attendeeScope(event, userId, ctx);
    if (!scope?.member)
      throw communityForbidden(CommunityErrorCode.membersOnly);
    const qb = this.rsvps
      .createQueryBuilder('rsvp')
      .innerJoinAndSelect('rsvp.user', 'user')
      .where('rsvp.eventId = :id', { id })
      .orderBy('rsvp.createdAt', 'ASC');
    if (scope.share) {
      qb.andWhere('rsvp.shareId = :shareId', { shareId: scope.share.id });
    } else {
      qb.andWhere('rsvp.shareId IS NULL');
    }
    this.restrictToAudience(qb, 'rsvp.userId', scope);
    const rows = await qb.getMany();
    return rows.map((row) => ({
      userId: row.userId,
      displayName: row.user.displayName,
      status: row.status,
    }));
  }

  /** Attendee scope for a community-hosted event or a shared public event. */
  private async attendeeScope(
    event: Event,
    userId: string,
    ctx?: HostQuery,
  ): Promise<EventScope | null> {
    if (event.communityId) {
      const access = await this.hostRole(event, userId);
      const community = await this.communities.findOne({
        where: { id: event.communityId },
      });
      if (!community) return null;
      return {
        communityId: event.communityId,
        subgroupId: event.subgroupId,
        member: access.member,
        manager: access.manager,
        share: null,
        hostCommunity: { name: community.name, slug: community.slug },
      };
    }
    return this.shareScope(event, userId, ctx);
  }

  /** Limits RSVP rows to people who belong to the audience's community or subgroup. */
  private restrictToAudience(
    qb: {
      andWhere: (where: string, params?: Record<string, unknown>) => unknown;
    },
    userColumn: string,
    scope: { communityId: string; subgroupId: string | null },
  ): void {
    if (scope.subgroupId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM subgroup_members sm WHERE sm.subgroup_id = :scopeSubgroupId AND sm.user_id = ${userColumn})`,
        { scopeSubgroupId: scope.subgroupId },
      );
    } else {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = :scopeCommunityId AND cm.user_id = ${userColumn})`,
        { scopeCommunityId: scope.communityId },
      );
    }
  }

  /** Community audience of an event's discussion; members only. */
  private async commentScope(
    event: Event,
    userId: string,
    ctx?: HostQuery,
  ): Promise<{ shareId: string | null; manager: boolean }> {
    const scope = await this.attendeeScope(event, userId, ctx);
    if (!scope?.member)
      throw communityForbidden(CommunityErrorCode.membersOnly);
    return { shareId: scope.share?.id ?? null, manager: scope.manager };
  }

  async listComments(id: string, userId: string, ctx?: HostQuery) {
    const event = await this.requireVisible(id, userId);
    const scope = await this.commentScope(event, userId, ctx);
    const rows = await this.comments.find({
      where: { eventId: id, shareId: scope.shareId ?? IsNull() },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.serializeComment(row, userId, scope.manager));
  }

  async addComment(id: string, userId: string, body: string, ctx?: HostQuery) {
    const event = await this.requireVisible(id, userId);
    const scope = await this.commentScope(event, userId, ctx);
    const saved = await this.comments.save(
      this.comments.create({
        eventId: id,
        shareId: scope.shareId,
        authorId: userId,
        body: body.trim(),
      }),
    );
    const loaded = await this.comments.findOne({
      where: { id: saved.id },
      relations: { author: true },
    });
    if (!loaded) throw new NotFoundException('Comment not found');
    return this.serializeComment(loaded, userId, true);
  }

  async deleteComment(
    id: string,
    commentId: string,
    userId: string,
    ctx?: HostQuery,
  ): Promise<void> {
    const event = await this.requireVisible(id, userId);
    const scope = await this.commentScope(event, userId, ctx);
    const comment = await this.comments.findOne({
      where: { id: commentId, eventId: id, shareId: scope.shareId ?? IsNull() },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && !scope.manager) {
      throw communityForbidden(CommunityErrorCode.membersOnly);
    }
    await this.comments.delete(comment.id);
  }

  private async requireVisible(id: string, userId?: string): Promise<Event> {
    const event = await this.findEntity(id);
    if (!(await this.canSee(event, userId))) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  private async present(
    event: Event,
    userId?: string,
    scope?: EventScope | null,
  ): Promise<SerializedEvent> {
    const access = await this.hostRole(event, userId);
    if (event.listing === EventListing.MEMBERS && !access.member) {
      throw new NotFoundException(`Event ${event.id} not found`);
    }
    // Plain public events have no attendee data. RSVPs belong to a community
    // audience, so they are only readable by that audience's members.
    let audience: EventScope | null = scope ?? null;
    if (!audience && event.communityId && userId) {
      audience = await this.attendeeScope(event, userId);
    }
    const isMember = !!audience?.member;
    const shareId = audience?.share?.id ?? null;
    const mine =
      userId && isMember
        ? await this.rsvps.findOne({
            where: {
              eventId: event.id,
              userId,
              shareId: shareId ?? IsNull(),
            },
          })
        : null;
    const counts = isMember
      ? await this.goingCounts([{ eventId: event.id, shareId }], audience!)
      : new Map<string, number>();
    const hostCommunity = await this.hostCommunityFor(event, audience);
    const recurrence = event.recurrenceId
      ? await this.recurrences.findOne({ where: { id: event.recurrenceId } })
      : null;
    const ride = await this.rideDetails(event, userId);
    const racing = await this.racingDetails([event.id]);
    return this.serializeEvent(event, {
      ...ride,
      ...racing(event.id),
      recurrence: recurrence
        ? { id: recurrence.id, frequency: recurrence.frequency }
        : null,
      ...(isMember ? { rsvpCount: counts.get(event.id) ?? 0 } : {}),
      myRsvp: mine?.status ?? null,
      canRsvp: isMember,
      canComment: isMember,
      canSeeRsvps: isMember,
      // Managers of the club can edit the meetup of a public event shared with it.
      canEditMeetup: !!audience?.share && !!audience.manager,
      canInvite: !!event.communityId && access.manager,
      canEdit: !!event.communityId && access.manager,
      hostCommunity,
      ...(audience?.share ? this.shareFields(audience.share, isMember) : {}),
      includeCommunityFields: access.member || isMember,
    });
  }

  /** Classes and series memberships of events, loaded once for a page of events. */
  private async racingDetails(
    ids: string[],
  ): Promise<(id: string) => { classes: SerializedEventClass[]; series: SerializedEventSeries[] }> {
    if (ids.length === 0) return () => ({ classes: [], series: [] });
    const classes = await this.eventClasses.find({
      where: { eventId: In(ids) },
      order: { position: 'ASC' },
    });
    const series = await this.dataSource.query<(SerializedEventSeries & { eventId: string })[]>(
      `SELECT rse."event_id" AS "eventId", s."id", s."slug", s."name", s."kind", s."season",
              rse."stageNumber" AS "round", rse."label"
         FROM "race_series_events" rse
         JOIN "race_series" s ON s."id" = rse."series_id"
        WHERE rse."event_id" = ANY($1::uuid[])
        ORDER BY s."name"`,
      [ids],
    );
    return (id) => ({
      classes: classes
        .filter((c) => c.eventId === id)
        .map(({ id: classId, name, gender, ageMin, ageMax, license, startTime, championship, note }) => ({
          id: classId,
          name,
          gender,
          ageMin,
          ageMax,
          license,
          startTime,
          championship,
          note,
        })),
      series: series
        .filter((row) => row.eventId === id)
        .map(({ eventId: _eventId, ...rest }) => rest),
    });
  }

  private async hostCommunityFor(
    event: Event,
    audience: EventScope | null,
  ): Promise<{ name: string; slug: string } | null> {
    if (audience) return audience.hostCommunity;
    if (!event.communityId) return null;
    const community = await this.communities.findOne({
      where: { id: event.communityId },
    });
    return community ? { name: community.name, slug: community.slug } : null;
  }

  private async goingCounts(
    entries: { eventId: string; shareId: string | null }[],
    scope: { communityId: string; subgroupId: string | null },
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (entries.length === 0) return counts;
    const hostedIds = entries
      .filter((entry) => !entry.shareId)
      .map((entry) => entry.eventId);
    const shareIds = entries
      .map((entry) => entry.shareId)
      .filter((id): id is string => !!id);
    const parts: string[] = [];
    if (hostedIds.length > 0) {
      parts.push('(rsvp.shareId IS NULL AND rsvp.eventId IN (:...hostedIds))');
    }
    if (shareIds.length > 0) parts.push('rsvp.shareId IN (:...shareIds)');
    if (parts.length === 0) return counts;
    const qb = this.rsvps
      .createQueryBuilder('rsvp')
      .select('rsvp.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where(`(${parts.join(' OR ')})`, {
        ...(hostedIds.length > 0 ? { hostedIds } : {}),
        ...(shareIds.length > 0 ? { shareIds } : {}),
      })
      .andWhere('rsvp.status = :going', { going: EventRsvpStatus.GOING });
    this.restrictToAudience(qb, 'rsvp.user_id', scope);
    const rows = await qb
      .groupBy('rsvp.eventId')
      .getRawMany<{ eventId: string; count: string }>();
    for (const row of rows) counts.set(row.eventId, Number(row.count));
    return counts;
  }

  private serializeComment(
    comment: EventComment,
    userId: string,
    manager: boolean,
  ) {
    return {
      id: comment.id,
      body: comment.body,
      authorId: comment.authorId,
      authorName: comment.author?.displayName ?? null,
      canDelete: comment.authorId === userId || manager,
      createdAt: comment.createdAt,
    };
  }

  private async canSee(event: Event, userId?: string): Promise<boolean> {
    if (event.communityId && (await this.isSuspended(event.communityId))) {
      return false;
    }
    if (event.listing !== EventListing.MEMBERS) return true;
    const access = await this.hostRole(event, userId);
    return access.member;
  }

  private async isSuspended(communityId: string): Promise<boolean> {
    const community = await this.communities.findOne({
      where: { id: communityId },
      select: { id: true, suspendedAt: true },
    });
    return !!community?.suspendedAt;
  }

  private async hostRole(
    event: Event,
    userId?: string,
  ): Promise<{ member: boolean; manager: boolean }> {
    if (!event.communityId) {
      return {
        member: false,
        manager: !!userId && event.createdById === userId,
      };
    }
    if (!userId) return { member: false, manager: false };
    const communityMember = await this.communityMembers.findOne({
      where: { communityId: event.communityId, userId },
    });
    const isAdmin = communityMember?.role === CommunityMemberRole.ADMIN;
    if (!event.subgroupId) {
      return { member: !!communityMember, manager: isAdmin };
    }
    if (isAdmin) return { member: true, manager: true };
    const subgroupMember = await this.subgroupMembers.findOne({
      where: { subgroupId: event.subgroupId, userId },
    });
    return {
      member: !!subgroupMember,
      manager: subgroupMember?.role === SubgroupMemberRole.MODERATOR,
    };
  }

  private async assertCanMutate(
    event: Event,
    user: { id: string; isAdmin: boolean },
  ): Promise<void> {
    if (!(await this.canSee(event, user.id))) {
      throw new NotFoundException(`Event ${event.id} not found`);
    }
    if (event.communityId) {
      const access = await this.hostRole(event, user.id);
      if (!access.manager) {
        throw communityForbidden(CommunityErrorCode.membersOnly);
      }
      return;
    }
    this.assertOwnerOrAdmin(event, user);
  }

  private assertOwnerOrAdmin(
    event: Event,
    user: { id: string; isAdmin: boolean },
  ): void {
    if (user.isAdmin) return;
    if (event.createdById && event.createdById === user.id) return;
    throw new ForbiddenException('You can only modify your own events');
  }

  private async accessMap(
    events: Event[],
    userId?: string,
  ): Promise<Map<string, { member: boolean; manager: boolean }>> {
    const map = new Map<string, { member: boolean; manager: boolean }>();
    const communityIds = [
      ...new Set(
        events
          .map((event) => event.communityId)
          .filter((id): id is string => !!id),
      ),
    ];
    const subgroupIds = [
      ...new Set(
        events
          .map((event) => event.subgroupId)
          .filter((id): id is string => !!id),
      ),
    ];
    const communityRows =
      userId && communityIds.length > 0
        ? await this.communityMembers.find({
            where: { userId, communityId: In(communityIds) },
          })
        : [];
    const subgroupRows =
      userId && subgroupIds.length > 0
        ? await this.subgroupMembers.find({
            where: { userId, subgroupId: In(subgroupIds) },
          })
        : [];
    const communityById = new Map(
      communityRows.map((row) => [row.communityId, row]),
    );
    const subgroupById = new Map(
      subgroupRows.map((row) => [row.subgroupId, row]),
    );

    for (const event of events) {
      if (!event.communityId || !userId) {
        map.set(event.id, {
          member: false,
          manager: !!userId && event.createdById === userId,
        });
        continue;
      }
      const communityMember = communityById.get(event.communityId);
      const isAdmin = communityMember?.role === CommunityMemberRole.ADMIN;
      if (!event.subgroupId) {
        map.set(event.id, { member: !!communityMember, manager: isAdmin });
        continue;
      }
      if (isAdmin) {
        map.set(event.id, { member: true, manager: true });
        continue;
      }
      const subgroupMember = subgroupById.get(event.subgroupId);
      map.set(event.id, {
        member: !!subgroupMember,
        manager: subgroupMember?.role === SubgroupMemberRole.MODERATOR,
      });
    }
    return map;
  }

  /** List rows omit the rich-text description. Marker rows are only what the map popup renders. */
  private toListEvent(
    event: Event,
    marker: boolean,
    extra?: Record<string, unknown>,
  ): SerializedEvent {
    if (!marker) {
      const serialized = this.serializeEvent(event, extra);
      delete serialized.description;
      return serialized;
    }

    const coords = event.coordinates;
    const distance = extra?.['distance'];
    return {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      locationName: event.locationName,
      status: event.status,
      disciplineSlug: event.disciplineSlug,
      discipline: event.discipline
        ? {
            slug: event.discipline.slug,
            nameTranslations: event.discipline.nameTranslations,
          }
        : undefined,
      coordinates:
        coords?.type === 'Point'
          ? { lat: coords.coordinates[1], lng: coords.coordinates[0] }
          : null,
      ...(typeof distance === 'number' ? { distance } : {}),
    };
  }

  private serializeEvent(
    event: Event,
    extra?: Record<string, unknown>,
  ): SerializedEvent {
    const includeCommunityFields = extra?.['includeCommunityFields'] === true;
    const rest = { ...(extra ?? {}) };
    delete rest['includeCommunityFields'];
    const coords = event.coordinates;
    const serialized: SerializedEvent = {
      ...event,
      imageUrl: this.visibleImage(event),
      coordinates:
        coords?.type === 'Point'
          ? { lat: coords.coordinates[1], lng: coords.coordinates[0] }
          : null,
      ...rest,
    };
    // Who checked a source when, the sources' conflicts and the import bookkeeping are for
    // admins only (`GET admin/events/:id/import-info`).
    serialized.sources = (event.sources ?? []).map(({ name, url }) => ({
      name,
      url,
    }));
    delete serialized.importConflicts;
    delete serialized.editedFields;
    delete serialized.importRunId;
    if (!includeCommunityFields) {
      serialized.meetupPlace = null;
      serialized.meetupAt = null;
      serialized.meetupNote = null;
      serialized.stravaUrl = null;
    }
    return serialized;
  }

  private visibleImage(event: Event): string | null {
    if (!event.imageUrl) return null;
    if (event.listing !== EventListing.MEMBERS) return event.imageUrl;
    return this.imageAccess.sign(event.imageUrl, true);
  }
}

/** A time other than midnight in Europe/Berlin was given. */
function hasBerlinTime(date: Date): boolean {
  return berlinTimeOfDay(date) !== '00:00';
}

/** Fields of an imported event that this edit actually changes. */
function editedImportFields(event: Event, partial: Partial<Event>): string[] {
  const fields: string[] = [];
  const current = event as unknown as Record<string, unknown>;
  const next = partial as unknown as Record<string, unknown>;
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a instanceof Date ? a.getTime() : (a ?? null)) ===
    JSON.stringify(b instanceof Date ? b.getTime() : (b ?? null));
  for (const field of [...IMPORT_FIELDS, 'coordinates']) {
    if (!(field in next) || next[field] === undefined) continue;
    if (!same(current[field], next[field])) fields.push(field);
  }
  return fields;
}

/** Sign-up cannot open after it closes. */
function assertRegistrationOrder(
  start: Date | null | undefined,
  deadline: Date | null | undefined,
): void {
  if (start && deadline && start.getTime() > deadline.getTime()) {
    throw new BadRequestException(
      'Registration start must not be after the registration deadline',
    );
  }
}
