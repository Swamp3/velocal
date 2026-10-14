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
import { User } from '../../users/entities/user.entity';
import { Community } from './community.entity';

export enum CommunityMemberRole {
  MEMBER = 'member',
  ADMIN = 'admin',
}

@Entity('community_members')
@Unique('UQ_community_members_community_user', ['communityId', 'userId'])
export class CommunityMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id' })
  communityId: string;

  @ManyToOne(() => Community, (community) => community.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Index('IDX_community_members_user_id')
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: CommunityMemberRole,
    enumName: 'community_member_role',
  })
  role: CommunityMemberRole;

  @CreateDateColumn()
  createdAt: Date;
}
