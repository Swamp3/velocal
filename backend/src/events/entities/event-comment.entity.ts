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

@Entity('event_comments')
export class EventComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_comments_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  /**
   * Set when the comment belongs to a public event shared with a community:
   * it is then visible to that audience only. Null for community-hosted events.
   */
  @Index('IDX_event_comments_share_id')
  @Column({ type: 'uuid', name: 'share_id', nullable: true })
  shareId: string | null;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
