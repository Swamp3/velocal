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

/** One browser or installed app that agreed to receive Web Push messages. */
@Entity('push_subscriptions')
@Index('IDX_push_subscriptions_user', ['userId'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', unique: true })
  endpoint: string;

  @Column({ type: 'varchar', length: 200 })
  p256dh: string;

  @Column({ type: 'varchar', length: 100 })
  auth: string;

  @Column({ type: 'varchar', length: 300, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'int', name: 'failure_count', default: 0 })
  failureCount: number;

  @Column({ type: 'timestamptz', name: 'last_success_at', nullable: true })
  lastSuccessAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
