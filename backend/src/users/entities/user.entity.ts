import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import type { Point } from 'geojson';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  displayName: string;

  /** Real name; private to the user (and admins). Others only see the display name. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  /** Canonical `https://www.strava.com/athletes/<id>` link the user chose to share. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  stravaUrl: string | null;

  @Column({ nullable: true })
  homeZip: string;

  @Column({ nullable: true })
  homeCountry: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  homeCoordinates: Point;

  @Column({ default: false })
  isAdmin: boolean;

  /** Set when an admin blocked the account: no login, no API access. */
  @Column({ type: 'timestamptz', nullable: true })
  bannedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  banReason: string | null;

  /** Which kinds of notification are sent as push; null means the defaults. */
  @Column({ type: 'jsonb', nullable: true })
  pushPreferences: Record<string, boolean> | null;

  @Column({ default: 'de' })
  preferredLanguage: string;

  @Column({ default: 'de' })
  preferredLocale: string;

  @CreateDateColumn()
  createdAt: Date;
}
