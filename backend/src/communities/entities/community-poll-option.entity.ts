import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CommunityPoll } from './community-poll.entity';

@Entity('community_poll_options')
export class CommunityPollOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'poll_id' })
  pollId: string;

  @ManyToOne(() => CommunityPoll, (poll) => poll.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poll_id' })
  poll: CommunityPoll;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'int' })
  position: number;
}
