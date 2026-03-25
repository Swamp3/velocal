import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisciplinesController } from './disciplines.controller';
import { DisciplinesService } from './disciplines.service';
import { DisciplineSeeder } from './disciplines.seeder';
import { Discipline } from './entities/discipline.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Discipline])],
  controllers: [DisciplinesController],
  providers: [DisciplinesService, DisciplineSeeder],
  exports: [DisciplinesService],
})
export class DisciplinesModule {}
