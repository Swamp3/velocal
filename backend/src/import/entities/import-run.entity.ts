import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ImportRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('import_runs')
export class ImportRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'enum', enum: ImportRunStatus, default: ImportRunStatus.RUNNING })
  status: ImportRunStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  eventsCreated: number;

  @Column({ type: 'int', default: 0 })
  eventsUpdated: number;

  @Column({ type: 'int', default: 0 })
  eventsSkipped: number;

  @Column({ type: 'text', nullable: true })
  errorLog: string | null;

  @Column({ type: 'varchar', nullable: true })
  triggeredBy: string | null;
}
