import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Community } from './community.entity';
import { CommunityPollOption } from './community-poll-option.entity';
import { Subgroup } from './subgroup.entity';

export enum PollResultsVisibility {
  MEMBERS = 'members',
  MANAGERS = 'managers',
}

/** Who may open the poll: only members of its host, or anyone with the link (read only). */
export enum PollVisibility {
  MEMBERS = 'members',
  PUBLIC = 'public',
}

/** One host: the community (`subgroupId` null) or exactly one subgroup. */
@Entity('community_polls')
export class CommunityPoll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_community_polls_community_id')
  @Column({ type: 'uuid', name: 'community_id' })
  communityId: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Index('IDX_community_polls_subgroup_id')
  @Column({ type: 'uuid', name: 'subgroup_id', nullable: true })
  subgroupId: string | null;

  @ManyToOne(() => Subgroup, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subgroup_id' })
  subgroup: Subgroup | null;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'varchar' })
  question: string;

  @Column({ default: false })
  multiple: boolean;

  @Column({
    type: 'enum',
    enum: PollResultsVisibility,
    enumName: 'poll_results_visibility',
    default: PollResultsVisibility.MEMBERS,
  })
  resultsVisibility: PollResultsVisibility;

  @Column({
    type: 'enum',
    enum: PollVisibility,
    enumName: 'poll_visibility',
    default: PollVisibility.MEMBERS,
  })
  visibility: PollVisibility;

  @Column({ type: 'timestamptz', nullable: true })
  closesAt: Date | null;

  @OneToMany(() => CommunityPollOption, (option) => option.poll)
  options: CommunityPollOption[];

  @CreateDateColumn()
  createdAt: Date;
}
