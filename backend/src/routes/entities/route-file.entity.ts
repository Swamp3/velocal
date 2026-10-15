import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Route } from './route.entity';

@Entity('route_files')
export class RouteFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_route_files_route_id')
  @Column({ type: 'uuid', name: 'route_id' })
  routeId: string;

  @ManyToOne(() => Route, (route) => route.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  /** Shown name; defaults to the uploaded file name without extension. */
  @Column({ type: 'varchar', length: 200 })
  label: string;

  @Column({ type: 'int', name: 'size_bytes' })
  sizeBytes: number;

  @Column({ type: 'int', name: 'distance_m', nullable: true })
  distanceM: number | null;

  @Column({ type: 'int', name: 'ascent_m', nullable: true })
  ascentM: number | null;

  /** [minLat, minLon, maxLat, maxLon]; lets a later map preview fit the track. */
  @Column({ type: 'jsonb', nullable: true })
  bounds: [number, number, number, number] | null;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
