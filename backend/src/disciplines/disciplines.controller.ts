import { Controller, Get } from '@nestjs/common';
import { DisciplinesService } from './disciplines.service';
import { Discipline } from './entities/discipline.entity';

@Controller('disciplines')
export class DisciplinesController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @Get()
  findAll(): Promise<Discipline[]> {
    return this.disciplinesService.findAll();
  }
}
