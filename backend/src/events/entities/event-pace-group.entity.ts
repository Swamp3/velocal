import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Route } from '../../routes/entities/route.entity';
import { Event } from './event.entity';

export const PACE_CATEGORIES = [
  'social',
  'endurance',
  'training',
  'dropride',
  'race',
] as const;
export type PaceCategory = (typeof PACE_CATEGORIES)[number];

/** A ride group of an event with its own speed range, e.g. "B-Gruppe 26-28 km/h". */
@Entity('event_pace_groups')
export class EventPaceGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_pace_groups_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  category: PaceCategory;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 1,
    name: 'speed_min_kmh',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  speedMinKmh: number;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 1,
    name: 'speed_max_kmh',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  speedMaxKmh: number;

  @Column({ type: 'uuid', name: 'route_id', nullable: true })
  routeId: string | null;

  @ManyToOne(() => Route, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_id' })
  route: Route | null;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;
}
