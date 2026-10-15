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

  @Column({ type: 'timestamptz', nullable: true })
  registrationDeadline: Date;

  @Column({ nullable: true })
  externalUrl: string;

  @Column({ nullable: true })
  externalId: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'enum', enum: EventSource, default: EventSource.MANUAL })
  source: EventSource;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
