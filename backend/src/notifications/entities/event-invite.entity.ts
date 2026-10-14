import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { User } from '../../users/entities/user.entity';

@Entity('event_invites')
@Unique('UQ_event_invites_event_user', ['eventId', 'userId'])
export class EventInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_invites_event_id')
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

  @Column({ type: 'uuid', name: 'invited_by_id', nullable: true })
  invitedById: string | null;

  @Column({ type: 'timestamptz', name: 'emailed_at', nullable: true })
  emailedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
