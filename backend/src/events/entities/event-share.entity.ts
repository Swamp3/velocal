import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Community } from '../../communities/entities/community.entity';
import { Subgroup } from '../../communities/entities/subgroup.entity';
import { Event } from './event.entity';

/**
 * A public event that a community (or one of its subgroups) also lists
 * internally, with its own meetup details. The event itself stays public and
 * untouched; everything members-only lives here.
 */
@Entity('event_shares')
export class EventShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_shares_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Index('IDX_event_shares_community_id')
  @Column({ type: 'uuid', name: 'community_id' })
  communityId: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  /** Null shares with the whole community; set shares with one subgroup. */
  @Column({ type: 'uuid', name: 'subgroup_id', nullable: true })
  subgroupId: string | null;

  @ManyToOne(() => Subgroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subgroup_id' })
  subgroup: Subgroup | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'meetup_place',
    nullable: true,
  })
  meetupPlace: string | null;

  @Column({
    type: 'timestamptz',
    name: 'meetup_at',
    nullable: true,
  })
  meetupAt: Date | null;

  @Column({ type: 'text', name: 'meetup_note', nullable: true })
  meetupNote: string | null;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
