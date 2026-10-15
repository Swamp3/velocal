import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per moderation or admin action. Names are copied into the row
 * (`actorLabel`, `targetLabel`) because the user or content may be gone later.
 */
@Entity('admin_audit_log')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 200, name: 'actor_label' })
  actorLabel: string;

  /** e.g. `community.delete`, `community.suspend`, `report.resolve`. */
  @Index('IDX_admin_audit_log_action')
  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Column({ type: 'varchar', length: 30, name: 'target_type', nullable: true })
  targetType: string | null;

  @Column({ type: 'uuid', name: 'target_id', nullable: true })
  targetId: string | null;

  @Column({
    type: 'varchar',
    length: 300,
    name: 'target_label',
    nullable: true,
  })
  targetLabel: string | null;

  /** The community the action concerned, kept after the community is deleted. */
  @Column({ type: 'uuid', name: 'community_id', nullable: true })
  communityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Index('IDX_admin_audit_log_created')
  @CreateDateColumn()
  createdAt: Date;
}
