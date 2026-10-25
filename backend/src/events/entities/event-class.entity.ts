import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  CHAMPIONSHIP_LEVELS,
  CLASS_GENDERS,
  CLASS_LICENSES,
  type ChampionshipLevel,
  type ClassGender,
  type ClassLicense,
  type LicenseClass,
} from '../racing';
import { Event } from './event.entity';

/**
 * A rating class (Wertungsklasse) of an event: one race, one result list. Ages are the age a rider
 * reaches in the year of the event (cycling counts by year of birth).
 */
@Entity('event_classes')
export class EventClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_event_classes_event_id')
  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({
    type: 'enum',
    enum: CLASS_GENDERS,
    enumName: 'event_class_gender',
    default: 'open',
  })
  gender: ClassGender;

  @Column({ type: 'int', name: 'age_min', nullable: true })
  ageMin: number | null;

  @Column({ type: 'int', name: 'age_max', nullable: true })
  ageMax: number | null;

  /** Age category the class is for (`u15`, `elite`, `masters2` …); ages are filled from it. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  category: string | null;

  @Column({
    type: 'enum',
    enum: CLASS_LICENSES,
    enumName: 'event_class_license',
    default: 'open',
  })
  license: ClassLicense;

  /** With `license`: riders without one may start with a day licence. */
  @Column({ type: 'boolean', name: 'day_license', default: false })
  dayLicense: boolean;

  /** Licence classes admitted (e.g. `amateur` and `master`); null for all. */
  @Column({
    type: 'text',
    name: 'license_classes',
    array: true,
    nullable: true,
  })
  licenseClasses: LicenseClass[] | null;

  /** Length of the race or route (touring events list their routes as classes). */
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 1,
    name: 'distance_km',
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value ?? null,
      from: (value: string | null) => (value == null ? null : Number(value)),
    },
  })
  distanceKm: number | null;

  @Column({ type: 'int', name: 'elevation_m', nullable: true })
  elevationM: number | null;

  @Column({ type: 'timestamptz', name: 'start_time', nullable: true })
  startTime: Date | null;

  @Column({
    type: 'enum',
    enum: CHAMPIONSHIP_LEVELS,
    enumName: 'championship_level',
    nullable: true,
  })
  championship: ChampionshipLevel | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;
}
