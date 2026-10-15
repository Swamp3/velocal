import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Community } from './community.entity';

export const REPORT_TARGETS = ['community', 'post', 'comment'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  'spam',
  'abuse',
  'inappropriate',
  'illegal',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

/** A member's report of a community, post or comment, waiting for a site admin. */
@Entity('reports')
@Index('IDX_reports_status_created', ['status', 'createdAt'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'reporter_id', nullable: true })
  reporterId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User | null;

  /** Kept when the community is deleted, so the report history survives. */
  @Column({ type: 'uuid', name: 'community_id', nullable: true })
  communityId: string | null;

  @ManyToOne(() => Community, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'community_id' })
  community: Community | null;

  @Column({ type: 'varchar', length: 20, name: 'target_type' })
  targetType: ReportTarget;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId: string;

  /** Title or excerpt copied at report time; the content may be removed later. */
  @Column({ type: 'varchar', length: 300, name: 'target_label' })
  targetLabel: string;

  @Column({ type: 'varchar', length: 20 })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 12, default: 'open' })
  status: ReportStatus;

  @Column({ type: 'uuid', name: 'resolved_by_id', nullable: true })
  resolvedById: string | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'text', name: 'resolution_note', nullable: true })
  resolutionNote: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
