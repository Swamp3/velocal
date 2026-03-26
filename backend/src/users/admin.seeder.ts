import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class AdminSeeder implements OnModuleInit {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_EMAIL', 'admin@velocal.dev');
    const password = this.config.get<string>('ADMIN_PASSWORD', 'admin1234');

    const existing = await this.userRepo.findOneBy({ email });
    if (existing) {
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        await this.userRepo.save(existing);
        this.logger.log(`Promoted existing user ${email} to admin`);
      }
      return;
    }

    const user = this.userRepo.create({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      displayName: 'Admin',
      isAdmin: true,
    });

    await this.userRepo.save(user);
    this.logger.log(`Seeded admin user: ${email}`);
  }
}
