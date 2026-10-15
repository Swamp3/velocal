import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A repeating event ("Feierabendrunde every Wednesday 18:30"). Every
 * occurrence is a normal event row pointing here, so lists, the calendar and
 * RSVPs work unchanged and single occurrences can be deleted on their own.
 */
@Entity('event_recurrences')
export class EventRecurrence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  frequency: 'weekly' | 'biweekly';

  @Column({ type: 'varchar', length: 64 })
  timezone: string;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById: string | null;

  /** Set when the series was stopped; no further events belong to it. */
  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
