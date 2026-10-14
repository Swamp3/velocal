import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type NotificationType =
  | 'event.created'
  | 'event.invite'
  | 'join.request'
  | 'join.decision';

export interface NotificationPayload {
  communityName: string;
  communitySlug: string;
  subgroupName?: string;
  subgroupSlug?: string;
  eventId?: string;
  eventName?: string;
  actorName?: string;
  decision?: 'approved' | 'rejected';
}

@Entity('notifications')
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 40 })
  type: NotificationType;

  @Column({ type: 'jsonb' })
  payload: NotificationPayload;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
