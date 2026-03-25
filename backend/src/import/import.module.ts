import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { RadNetSource } from './sources/rad-net.source';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [ImportController],
  providers: [ImportService, RadNetSource],
  exports: [ImportService],
})
export class ImportModule {}
