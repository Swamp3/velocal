import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Community } from './community.entity';
import { SubgroupMember } from './subgroup-member.entity';

export enum SubgroupVisibility {
  OPEN = 'open',
  REQUEST = 'request',
  INVITE = 'invite',
}

@Entity('subgroups')
@Unique('UQ_subgroups_community_slug', ['communityId', 'slug'])
export class Subgroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_subgroups_community_id')
  @Column({ type: 'uuid', name: 'community_id' })
  communityId: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: SubgroupVisibility,
    enumName: 'subgroup_visibility',
    default: SubgroupVisibility.OPEN,
  })
  visibility: SubgroupVisibility;

  @Column({ type: 'varchar', nullable: true })
  heroUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @OneToMany(() => SubgroupMember, (member) => member.subgroup)
  members: SubgroupMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
