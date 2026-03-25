import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discipline } from './entities/discipline.entity';

@Injectable()
export class DisciplinesService {
  constructor(
    @InjectRepository(Discipline)
    private readonly repo: Repository<Discipline>,
  ) {}

  findAll(): Promise<Discipline[]> {
    return this.repo.find({ order: { sortOrder: 'ASC' } });
  }
}
