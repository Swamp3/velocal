import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Event } from './event.entity';

/** Who may start in a class. */
export enum ClassGender {
  OPEN = 'open',
  MALE = 'male',
  FEMALE = 'female',
}

/**
 * Who may start, by licence:
 * - `open`: everyone (Jedermann; licence holders usually too)
 * - `unlicensed`: only riders without a licence (Hobby class)
 * - `license`: a race licence of the federation (German Cycling); with `dayLicense` a rider
 *   without one may buy a day licence on site
 * - `uci`: a licence of a UCI-registered team (Continental, ProTeam, WorldTeam)
 */
export enum ClassLicense {
  OPEN = 'open',
  UNLICENSED = 'unlicensed',
  LICENSE = 'license',
  UCI = 'uci',
}

/** Performance classes of licensed adults in road racing (German Cycling, since 2019). */
export const LICENSE_CLASSES = ['elite_amateur', 'amateur', 'master'] as const;
export type LicenseClass = (typeof LICENSE_CLASSES)[number];

/** Level of a championship, from local to world. */
export enum ChampionshipLevel {
  CLUB = 'club',
  DISTRICT = 'district',
  STATE = 'state',
  REGIONAL = 'regional',
  NATIONAL = 'national',
  CONTINENTAL = 'continental',
  WORLD = 'world',
}

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
    enum: ClassGender,
    enumName: 'event_class_gender',
    default: ClassGender.OPEN,
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
    enum: ClassLicense,
    enumName: 'event_class_license',
    default: ClassLicense.OPEN,
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

  @Column({ type: 'timestamptz', name: 'start_time', nullable: true })
  startTime: Date | null;

  @Column({
    type: 'enum',
    enum: ChampionshipLevel,
    enumName: 'championship_level',
    nullable: true,
  })
  championship: ChampionshipLevel | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;
}
