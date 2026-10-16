import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** A pair of events an admin confirmed to be different; ids are stored in sorted order. */
@Entity('event_duplicate_ignores')
export class EventDuplicateIgnore {
  @PrimaryColumn({ type: 'uuid', name: 'event_a_id' })
  eventAId: string;

  @PrimaryColumn({ type: 'uuid', name: 'event_b_id' })
  eventBId: string;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
