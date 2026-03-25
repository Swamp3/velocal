import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discipline } from './entities/discipline.entity';
import { DISCIPLINE_SEEDS } from './disciplines.seed';

@Injectable()
export class DisciplineSeeder implements OnModuleInit {
  private readonly logger = new Logger(DisciplineSeeder.name);

  constructor(
    @InjectRepository(Discipline)
    private readonly repo: Repository<Discipline>,
  ) {}

  async onModuleInit() {
    await this.repo.upsert(DISCIPLINE_SEEDS, ['slug']);
    this.logger.log(`Seeded ${DISCIPLINE_SEEDS.length} disciplines`);
  }
}
