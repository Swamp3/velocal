import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Event } from './event.entity';

export enum EventRsvpStatus {
  GOING = 'going',
  MAYBE = 'maybe',
  DECLINED = 'declined',
}

/**
 * One RSVP per person per audience. Hosted events use a null `shareId`
 * (partial unique index `UQ_event_rsvps_hosted`). A public event shared with
 * a club uses that share's id (`UQ_event_rsvps_share`), so the same person
 * can answer differently in each club.
 */
@Entity('event_rsvps')
export class EventRsvp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_rsvps_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Set when the RSVP belongs to a public event shared with a community.
   * Null for community-hosted events.
   */
  @Index('IDX_event_rsvps_share_id')
  @Column({ type: 'uuid', name: 'share_id', nullable: true })
  shareId: string | null;

  @Column({
    type: 'enum',
    enum: EventRsvpStatus,
    enumName: 'event_rsvp_status',
  })
  status: EventRsvpStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
