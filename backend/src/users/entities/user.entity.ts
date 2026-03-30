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

  @Column({ default: 'de' })
  preferredLocale: string;

  @CreateDateColumn()
  createdAt: Date;
}
