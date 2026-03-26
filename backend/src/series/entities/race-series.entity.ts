import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Discipline } from '../../disciplines/entities/discipline.entity';
import { User } from '../../users/entities/user.entity';
import { RaceSeriesEvent } from './race-series-event.entity';

@Entity('race_series')
export class RaceSeries {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  year: number;

  @Index()
  @Column({ name: 'discipline_slug', nullable: true })
  disciplineSlug: string;

  @ManyToOne(() => Discipline, { eager: true, nullable: true })
  @JoinColumn({ name: 'discipline_slug', referencedColumnName: 'slug' })
  discipline: Discipline;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  externalUrl: string;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @OneToMany(() => RaceSeriesEvent, (rse) => rse.series)
  seriesEvents: RaceSeriesEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
