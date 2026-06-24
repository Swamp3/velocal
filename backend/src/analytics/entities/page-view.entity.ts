import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('page_views')
@Index(['path'])
@Index(['viewedAt'])
export class PageView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 500 })
  path: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  viewedAt: Date;
}
