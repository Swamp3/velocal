import { CyclingEvent } from './event.model';
import { Discipline } from './discipline.model';

export interface RaceSeries {
  id: string;
  name: string;
  slug: string;
  description?: string;
  year?: number;
  discipline?: Discipline;
  imageUrl?: string;
  externalUrl?: string;
  eventCount: number;
  createdAt: string;
}

export interface RaceSeriesDetail extends RaceSeries {
  events: RaceSeriesEventEntry[];
}

export interface RaceSeriesEventEntry {
  event: CyclingEvent;
  stageNumber?: number;
  label?: string;
}
