import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Point } from 'geojson';
import { Community } from '../../communities/entities/community.entity';
import { Discipline } from '../../disciplines/entities/discipline.entity';
import { Subgroup } from '../../communities/entities/subgroup.entity';
import { User } from '../../users/entities/user.entity';

export enum EventListing {
  PUBLIC = 'public',
  MEMBERS = 'members',
}

export enum EventStatus {
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/** Where a piece of information about an event was found (shown publicly: name and link). */
export interface EventSourceRef {
  name: string;
  url: string;
  /** Admins only: when the collector last checked the source. */
  checkedAt?: string;
  /** Admins only: last update the source itself states. */
  updatedAt?: string;
}

/** A field on which the sources disagree, and which value was chosen (admins only). */
export interface EventConflict {
  field: string;
  values?: unknown[];
  selectedSource?: string;
  reason?: string;
}

export enum EventSource {
  MANUAL = 'manual',
  IMPORTED = 'imported',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date;

  /**
   * False when only the day is known. `startDate`/`endDate` then hold midnight in Europe/Berlin
   * and no time is shown.
   */
  @Column({ type: 'boolean', name: 'start_time_known', default: true })
  startTimeKnown: boolean;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PUBLISHED })
  status: EventStatus;

  @Column()
  locationName: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  country: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  coordinates: Point;

  /** When sign-up opens (Anmeldestart). */
  @Column({ type: 'timestamptz', nullable: true })
  registrationStart: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  registrationDeadline: Date | null;

  @Column({ nullable: true })
  externalUrl: string;

  @Column({ nullable: true })
  externalId: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'enum', enum: EventSource, default: EventSource.MANUAL })
  source: EventSource;

  /** Which scraper created the event, e.g. `rad-net` (imported events only). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceName: string | null;

  /** The page of the source that lists the event; stays even if `externalUrl` is edited. */
  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  /** Last import run in which the source still listed the event. */
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  /** Set when a complete import run no longer found an upcoming event at its source. */
  @Column({ type: 'timestamptz', nullable: true })
  missingSince: Date | null;

  @ManyToOne(() => Discipline, { eager: true })
  @JoinColumn({ name: 'discipline_slug', referencedColumnName: 'slug' })
  discipline: Discipline;

  @Column({ name: 'discipline_slug' })
  disciplineSlug: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  /** Null means the event is not hosted by a community. */
  @Index('IDX_events_community_id')
  @Column({ type: 'uuid', name: 'community_id', nullable: true })
  communityId: string | null;

  @ManyToOne(() => Community, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community | null;

  /** Null hosts the event on the community. Set hosts it on exactly one subgroup. */
  @Index('IDX_events_subgroup_id')
  @Column({ type: 'uuid', name: 'subgroup_id', nullable: true })
  subgroupId: string | null;

  @ManyToOne(() => Subgroup, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subgroup_id' })
  subgroup: Subgroup | null;

  @Column({
    type: 'enum',
    enum: EventListing,
    enumName: 'event_listing',
    default: EventListing.PUBLIC,
  })
  listing: EventListing;

  @Column({ type: 'varchar', length: 500, name: 'strava_url', nullable: true })
  stravaUrl: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'meetup_place',
    nullable: true,
  })
  meetupPlace: string | null;

  @Column({ type: 'timestamptz', name: 'meetup_at', nullable: true })
  meetupAt: Date | null;

  @Column({ type: 'text', name: 'meetup_note', nullable: true })
  meetupNote: string | null;

  @Column({ type: 'uuid', name: 'route_id', nullable: true })
  routeId: string | null;

  /** Set when the event is one occurrence of a repeating series. */
  @Index('IDX_events_recurrence_id')
  @Column({ type: 'uuid', name: 'recurrence_id', nullable: true })
  recurrenceId: string | null;

  /** Sources of the event's data; name and link are public. */
  @Column({ type: 'jsonb', nullable: true })
  sources: EventSourceRef[] | null;

  /** Admins only: conflicts between sources noted by the collector. */
  @Column({ type: 'jsonb', name: 'import_conflicts', nullable: true })
  importConflicts: EventConflict[] | null;

  /** Import run that created the event (file and scraper imports). */
  @Column({ type: 'uuid', name: 'import_run_id', nullable: true })
  importRunId: string | null;

  /**
   * Fields a person changed after the event was imported. Imports never overwrite them, so a
   * correction made by hand survives the next import.
   */
  @Column({ type: 'text', name: 'edited_fields', array: true, default: () => "'{}'" })
  editedFields: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
