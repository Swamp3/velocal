import { SERIES_KINDS, type SeriesKind } from '../../events/racing';
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

  /**
   * `series`: a loose series. `cup`: races counting for one ranking (Läufe). `league`: a league
   * with matchdays in one season (Spieltage).
   */
  @Column({
    type: 'enum',
    enum: SERIES_KINDS,
    enumName: 'series_kind',
    default: 'series',
  })
  kind: SeriesKind;

  /** Season label for seasons across years, e.g. `2026/27`. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  season: string | null;

  /** Set when an import created the series: it is found again by source and key. */
  @Column({ type: 'varchar', length: 40, name: 'source_name', nullable: true })
  sourceName: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'external_key',
    nullable: true,
  })
  externalKey: string | null;

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
