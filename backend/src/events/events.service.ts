import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventComment } from './entities/event-comment.entity';
import { EventRsvp, EventRsvpStatus } from './entities/event-rsvp.entity';
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
    @InjectRepository(EventRsvp)
    private readonly rsvps: Repository<EventRsvp>,
    @InjectRepository(EventComment)
    private readonly comments: Repository<EventComment>,
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
    private readonly geocoding: GeocodingService,
    private readonly uploads: UploadsService,
    private readonly notifications: NotificationsService,
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
    const qb = this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.discipline', 'discipline');

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
    return this.present(await this.findEntity(id), userId);
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
      stravaUrl: host ? (host.stravaUrl ?? null) : null,
      meetupPlace: host ? host.meetupPlace || null : null,
      meetupAt: host?.meetupAt ? new Date(host.meetupAt) : null,
      meetupNote: host ? host.meetupNote || null : null,
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
    return this.present(saved, user?.id);
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
    const counts = await this.goingCounts(rows.map((event) => event.id));
    return rows.map((event) =>
      this.serializeEvent(event, { rsvpCount: counts.get(event.id) ?? 0 }),
    );
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
    const listing = dto.listing ?? EventListing.MEMBERS;
    const event = await this.create(dto, userId, {
      communityId: host.community.id,
      subgroupId: host.subgroup?.id ?? null,
      listing,
      stravaUrl: dto.stravaUrl || null,
      meetupPlace: dto.meetupPlace,
      meetupAt: dto.meetupAt,
      meetupNote: dto.meetupNote,
    });
    await this.notifications.eventCreated({
      actorId: userId,
      communityId: host.community.id,
      subgroupId: host.subgroup?.id ?? null,
      payload: {
        communityName: host.community.name,
        communitySlug: host.community.slug,
        subgroupName: host.subgroup?.name,
        subgroupSlug: host.subgroup?.slug,
        eventId: event.id,
        eventName: event.name,
      },
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

  private applyAudience(
    qb: ReturnType<Repository<Event>['createQueryBuilder']>,
    userId?: string,
  ): void {
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
  ): Promise<SerializedEvent> {
    const event = await this.findEntity(id);
    if (!(await this.canSee(event, userId))) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    await this.rsvps.upsert(
      { eventId: id, userId, status },
      { conflictPaths: ['eventId', 'userId'] },
    );
    return this.present(event, userId);
  }

  async listRsvps(
    id: string,
    userId: string,
  ): Promise<
    { userId: string; displayName: string; status: EventRsvpStatus }[]
  > {
    const event = await this.requireVisible(id, userId);
    const access = await this.hostRole(event, userId);
    if (!access.manager)
      throw communityForbidden(CommunityErrorCode.membersOnly);
    const rows = await this.rsvps.find({
      where: { eventId: id },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      userId: row.userId,
      displayName: row.user.displayName,
      status: row.status,
    }));
  }

  async listComments(id: string, userId: string) {
    const event = await this.requireVisible(id, userId);
    await this.requireHostMember(event, userId);
    const rows = await this.comments.find({
      where: { eventId: id },
      relations: { author: true },
      order: { createdAt: 'ASC' },
    });
    const access = await this.hostRole(event, userId);
    return rows.map((row) =>
      this.serializeComment(row, userId, access.manager),
    );
  }

  async addComment(id: string, userId: string, body: string) {
    const event = await this.requireVisible(id, userId);
    await this.requireHostMember(event, userId);
    const saved = await this.comments.save(
      this.comments.create({
        eventId: id,
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
  ): Promise<void> {
    const event = await this.requireVisible(id, userId);
    const comment = await this.comments.findOne({
      where: { id: commentId, eventId: id },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    const access = await this.hostRole(event, userId);
    if (comment.authorId !== userId && !access.manager) {
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

  private async requireHostMember(event: Event, userId: string): Promise<void> {
    const access = await this.hostRole(event, userId);
    if (!event.communityId || !access.member) {
      throw communityForbidden(CommunityErrorCode.membersOnly);
    }
  }

  private async present(
    event: Event,
    userId?: string,
  ): Promise<SerializedEvent> {
    const access = await this.hostRole(event, userId);
    if (event.listing === EventListing.MEMBERS && !access.member) {
      throw new NotFoundException(`Event ${event.id} not found`);
    }
    const mine = userId
      ? await this.rsvps.findOne({ where: { eventId: event.id, userId } })
      : null;
    const rsvpCount = await this.rsvps.count({
      where: { eventId: event.id, status: EventRsvpStatus.GOING },
    });
    return this.serializeEvent(event, {
      rsvpCount,
      myRsvp: mine?.status ?? null,
      canComment: !!event.communityId && access.member,
      canSeeRsvps: access.manager,
      canInvite: !!event.communityId && access.manager,
    });
  }

  private async goingCounts(ids: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (ids.length === 0) return counts;
    const rows = await this.rsvps
      .createQueryBuilder('rsvp')
      .select('rsvp.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('rsvp.eventId IN (:...ids)', { ids })
      .andWhere('rsvp.status = :going', { going: EventRsvpStatus.GOING })
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
    if (event.listing !== EventListing.MEMBERS) return true;
    const access = await this.hostRole(event, userId);
    return access.member;
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
