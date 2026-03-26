import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';
import { RaceSeries } from './entities/race-series.entity';
import { RaceSeriesEvent } from './entities/race-series-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RaceSeries, RaceSeriesEvent])],
  controllers: [SeriesController],
  providers: [SeriesService],
  exports: [SeriesService],
})
export class SeriesModule {}
