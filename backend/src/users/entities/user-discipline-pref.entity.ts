import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Discipline } from '../../disciplines/entities/discipline.entity';

@Entity('user_discipline_prefs')
@Unique(['userId', 'disciplineSlug'])
export class UserDisciplinePref {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  disciplineSlug: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Discipline, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disciplineSlug', referencedColumnName: 'slug' })
  discipline: Discipline;
}
