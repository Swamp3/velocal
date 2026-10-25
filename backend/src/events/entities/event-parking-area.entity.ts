import type { Point } from 'geojson';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PARKING_FEES, type ParkingFee, type ParkingKind } from '../parking';
import { Event } from './event.entity';

/** A place where participants (or teams, spectators …) of an event should park. Public. */
@Entity('event_parking_areas')
export class EventParkingArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_parking_areas_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** At least one of PARKING_KINDS. */
  @Column({ type: 'text', array: true })
  kinds: ParkingKind[];

  /** The place to drive to: entrance, or the middle of a small car park. */
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  coordinates: Point;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  /** Rough number of vehicles. */
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({
    type: 'enum',
    enum: PARKING_FEES,
    enumName: 'parking_fee',
    nullable: true,
  })
  fee: ParkingFee | null;

  /** E.g. "5 € per day". */
  @Column({ type: 'varchar', length: 80, name: 'fee_note', nullable: true })
  feeNote: string | null;

  /** `HH:mm` on the event day(s). */
  @Column({ type: 'varchar', length: 5, name: 'open_from', nullable: true })
  openFrom: string | null;

  @Column({ type: 'varchar', length: 5, name: 'open_until', nullable: true })
  openUntil: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;
}
