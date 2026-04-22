import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Point } from 'geojson';
import { Discipline } from '../../disciplines/entities/discipline.entity';
import { User } from '../../users/entities/user.entity';

export enum EventStatus {
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum EventSource {
  MANUAL = 'manual',
  IMPORTED = 'imported',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate: Date;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PUBLISHED })
  status: EventStatus;

  @Column()
  locationName: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  country: string;

  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  coordinates: Point;

  @Column({ type: 'timestamptz', nullable: true })
  registrationDeadline: Date;

  @Column({ nullable: true })
  externalUrl: string;

  @Column({ nullable: true })
  externalId: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'enum', enum: EventSource, default: EventSource.MANUAL })
  source: EventSource;

  @ManyToOne(() => Discipline, { eager: true })
  @JoinColumn({ name: 'discipline_slug', referencedColumnName: 'slug' })
  discipline: Discipline;

  @Column({ name: 'discipline_slug' })
  disciplineSlug: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
