import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Event } from '../../events/entities/event.entity';
import { PostTag } from './post-tag.entity';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ unique: true })
  slug: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'author_id' })
  authorId: string;

  @ManyToOne(() => Event, { nullable: true, eager: false })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'event_id', nullable: true })
  eventId: string;

  @Column({ type: 'varchar', default: PostStatus.PUBLISHED })
  status: PostStatus;

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date;

  @OneToMany(() => PostTag, (tag) => tag.post, { cascade: true, eager: true })
  tags: PostTag[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
