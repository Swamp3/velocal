import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RouteFile } from './route-file.entity';

/** A route ("Strecke") that can hold several GPX files, e.g. variants or stages. */
@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @OneToMany(() => RouteFile, (file) => file.route)
  files: RouteFile[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
