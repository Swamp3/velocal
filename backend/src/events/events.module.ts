import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { GeocodingService } from './geocoding.service';
import { Event } from './entities/event.entity';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), UploadsModule],
  controllers: [EventsController],
  providers: [EventsService, GeocodingService],
  exports: [EventsService, GeocodingService],
})
export class EventsModule {}
