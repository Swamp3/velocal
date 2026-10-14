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
import { Subgroup } from './subgroup.entity';

export enum SubgroupMemberRole {
  MEMBER = 'member',
  MODERATOR = 'moderator',
}

@Entity('subgroup_members')
@Unique('UQ_subgroup_members_subgroup_user', ['subgroupId', 'userId'])
export class SubgroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'subgroup_id' })
  subgroupId: string;

  @ManyToOne(() => Subgroup, (subgroup) => subgroup.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subgroup_id' })
  subgroup: Subgroup;

  @Index('IDX_subgroup_members_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: SubgroupMemberRole,
    enumName: 'subgroup_member_role',
  })
  role: SubgroupMemberRole;

  @CreateDateColumn()
  createdAt: Date;
}
