import {
  LICENSE_CLASS_KEYS,
  RIDER_GENDERS,
  RIDER_LICENSES,
  type LicenseClass,
  type RiderGender,
  type RiderLicense,
} from '../../events/racing';
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

  /** Set when the owner deleted the account; the row stays as an empty shell so content keeps its references. */
  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  /** Last time a request with this account's token was verified (sign-ins included), written at most every few minutes. Visible to admins only. */
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  /** Which kinds of notification are sent as push; null means the defaults. */
  @Column({ type: 'jsonb', nullable: true })
  pushPreferences: Record<string, boolean> | null;

  /** Only used to find fitting race classes; never shown to others. */
  @Column({ type: 'int', name: 'birth_year', nullable: true })
  birthYear: number | null;

  @Column({
    type: 'enum',
    enum: RIDER_GENDERS,
    enumName: 'user_gender',
    nullable: true,
  })
  gender: RiderGender | null;

  /** Licence the rider holds: none, a federation race licence, or a UCI team licence. */
  @Column({
    type: 'enum',
    enum: RIDER_LICENSES,
    enumName: 'user_license',
    name: 'license_type',
    nullable: true,
  })
  licenseType: RiderLicense | null;

  /** Licensed adults: Elite Amateure, Amateure or Masters. */
  @Column({
    type: 'enum',
    enum: LICENSE_CLASS_KEYS,
    enumName: 'user_license_class',
    name: 'license_class',
    nullable: true,
  })
  licenseClass: LicenseClass | null;

  @Column({ default: 'de' })
  preferredLanguage: string;

  @Column({ default: 'de' })
  preferredLocale: string;

  @CreateDateColumn()
  createdAt: Date;
}
