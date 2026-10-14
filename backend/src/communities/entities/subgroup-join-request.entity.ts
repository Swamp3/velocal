import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CommunityJoinStatus } from './community-join-request.entity';
import { Subgroup } from './subgroup.entity';

@Entity('subgroup_join_requests')
@Unique('UQ_subgroup_join_requests_subgroup_user', ['subgroupId', 'userId'])
export class SubgroupJoinRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'subgroup_id' })
  subgroupId: string;

  @ManyToOne(() => Subgroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subgroup_id' })
  subgroup: Subgroup;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: CommunityJoinStatus,
    enumName: 'community_join_status',
  })
  status: CommunityJoinStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
