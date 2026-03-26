import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { RaceSeries } from './race-series.entity';
import { Event } from '../../events/entities/event.entity';

@Entity('race_series_events')
@Unique(['seriesId', 'eventId'])
export class RaceSeriesEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'series_id' })
  seriesId: string;

  @ManyToOne(() => RaceSeries, (s) => s.seriesEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series: RaceSeries;

  @Index()
  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'int', nullable: true })
  stageNumber: number;

  @Column({ nullable: true })
  label: string;
}
