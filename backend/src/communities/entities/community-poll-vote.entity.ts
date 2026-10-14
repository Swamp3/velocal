import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CommunityPollOption } from './community-poll-option.entity';

@Entity('community_poll_votes')
@Unique('UQ_community_poll_votes_option_user', ['optionId', 'userId'])
export class CommunityPollVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'option_id' })
  optionId: string;

  @ManyToOne(() => CommunityPollOption, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'option_id' })
  option: CommunityPollOption;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
