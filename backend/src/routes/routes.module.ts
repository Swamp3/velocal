import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../events/events.module';
import { RouteFile } from './entities/route-file.entity';
import { Route } from './entities/route.entity';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Route, RouteFile]), EventsModule],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
