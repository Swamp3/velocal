import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('disciplines')
export class Discipline {
  @PrimaryColumn()
  slug: string;

  @Column({ type: 'jsonb' })
  nameTranslations: Record<string, string>;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: 0 })
  sortOrder: number;
}
