import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Event } from './event.entity';

/** Who may start in a class. */
export enum ClassGender {
  OPEN = 'open',
  MALE = 'male',
  FEMALE = 'female',
}

/**
 * Licence a rider needs, from the lowest: `none` (open to everyone, a day licence is bought on
 * site), `hobby` (hobby/Jedermann licence), `license` (race licence of the federation).
 */
export enum ClassLicense {
  NONE = 'none',
  HOBBY = 'hobby',
  LICENSE = 'license',
}

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

  @Column({ type: 'enum', enum: ClassGender, enumName: 'event_class_gender', default: ClassGender.OPEN })
  gender: ClassGender;

  @Column({ type: 'int', name: 'age_min', nullable: true })
  ageMin: number | null;

  @Column({ type: 'int', name: 'age_max', nullable: true })
  ageMax: number | null;

  @Column({ type: 'enum', enum: ClassLicense, enumName: 'event_class_license', default: ClassLicense.NONE })
  license: ClassLicense;

  @Column({ type: 'timestamptz', name: 'start_time', nullable: true })
  startTime: Date | null;

  @Column({ type: 'enum', enum: ChampionshipLevel, enumName: 'championship_level', nullable: true })
  championship: ChampionshipLevel | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;
}
