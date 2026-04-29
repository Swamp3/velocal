import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { EventsModule } from '../events/events.module';
import { ImportRun } from './entities/import-run.entity';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { RaceResultSource } from './sources/race-result.source';
import { RadNetSource } from './sources/rad-net.source';

@Module({
  imports: [TypeOrmModule.forFeature([Event, ImportRun]), EventsModule],
  controllers: [ImportController],
  providers: [ImportService, RadNetSource, RaceResultSource],
  exports: [ImportService],
})
export class ImportModule {}
