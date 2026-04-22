import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('otp_tokens')
@Index('IDX_otp_tokens_email', ['email'])
export class OtpToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  codeHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn()
  createdAt: Date;
}
