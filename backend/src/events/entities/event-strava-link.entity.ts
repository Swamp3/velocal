import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventPaceGroup } from './event-pace-group.entity';
import { Event } from './event.entity';

/** A Strava event/route link on an event, or on one of its pace groups. */
@Entity('event_strava_links')
export class EventStravaLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_strava_links_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  /** Null links the whole event. */
  @Column({ type: 'uuid', name: 'pace_group_id', nullable: true })
  paceGroupId: string | null;

  @ManyToOne(() => EventPaceGroup, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pace_group_id' })
  paceGroup: EventPaceGroup | null;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;
}
