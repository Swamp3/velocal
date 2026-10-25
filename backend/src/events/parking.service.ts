import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Point } from 'geojson';
import { EntityManager, In, Repository } from 'typeorm';
import { BadWordService } from '../common/bad-words';
import type { ParkingAreaDto } from './dto/parking-area.dto';
import { EventParkingArea } from './entities/event-parking-area.entity';
import { distanceMeters, type ParkingFee, type ParkingKind } from './parking';

/** A parking area as the API returns it. */
export interface SerializedParkingArea {
  id: string;
  name: string;
  kinds: ParkingKind[];
  coordinates: { lat: number; lng: number };
  address: string | null;
  capacity: number | null;
  fee: ParkingFee | null;
  feeNote: string | null;
  openFrom: string | null;
  openUntil: string | null;
  note: string | null;
  /** Straight-line distance to the event's place; null when the event has no coordinates. */
  distanceM: number | null;
}

/** What a parking area is made of, in the form the API takes it. */
export type ParkingAreaInput = Pick<
  ParkingAreaDto,
  'name' | 'kinds' | 'coordinates'
> &
  Partial<Omit<ParkingAreaDto, 'name' | 'kinds' | 'coordinates'>>;

/** Reads and replaces the parking areas of events. */
@Injectable()
export class ParkingService {
  constructor(
    @InjectRepository(EventParkingArea)
    private readonly areas: Repository<EventParkingArea>,
    private readonly badWords: BadWordService,
  ) {}

  /** Refuses names and notes with inappropriate language. */
  assertClean(areas: ParkingAreaInput[]): void {
    const violations = areas.flatMap((area, index) =>
      this.badWords
        .checkFields(
          { name: [area.name, area.note ?? '', area.feeNote ?? ''].join(' ') },
          ['name'],
        )
        .violations.map(() => ({ field: `parkingAreas.${index}` })),
    );
    if (violations.length) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'content_policy_violation',
        message: 'Content contains inappropriate language',
        violations,
      });
    }
  }

  /** Replaces the parking areas of these events (every occurrence of a series gets the same). */
  async write(
    manager: EntityManager,
    eventIds: string[],
    areas: ParkingAreaInput[],
  ): Promise<void> {
    if (!eventIds.length) return;
    const repo = manager.getRepository(EventParkingArea);
    await repo.delete({ eventId: In(eventIds) });
    if (!areas.length) return;
    await repo.save(
      eventIds.flatMap((eventId) =>
        areas.map((area, position) =>
          repo.create({
            eventId,
            position,
            name: area.name.trim(),
            kinds: [...new Set(area.kinds)],
            coordinates: {
              type: 'Point',
              coordinates: [area.coordinates.lng, area.coordinates.lat],
            },
            address: area.address?.trim() || null,
            capacity: area.capacity ?? null,
            fee: area.fee ?? null,
            feeNote: area.feeNote?.trim() || null,
            openFrom: area.openFrom || null,
            openUntil: area.openUntil || null,
            note: area.note?.trim() || null,
          }),
        ),
      ),
    );
  }

  /** The stored areas of an event, in the form the API takes them. */
  async stored(eventId: string): Promise<ParkingAreaInput[]> {
    const areas = await this.forEvent(eventId, null);
    return areas.map((area) => ({
      name: area.name,
      kinds: area.kinds,
      coordinates: area.coordinates,
      address: area.address,
      capacity: area.capacity,
      fee: area.fee,
      feeNote: area.feeNote,
      openFrom: area.openFrom,
      openUntil: area.openUntil,
      note: area.note,
    }));
  }

  /** The stored areas differ from these (to mark a hand edit of an imported event). */
  async differ(eventId: string, next: ParkingAreaInput[]): Promise<boolean> {
    const current = (await this.stored(eventId)).map(key);
    return current.join('|') !== next.map(key).join('|');
  }

  /** Areas of one event, with the distance to the event's place. */
  async forEvent(
    eventId: string,
    eventPoint: Point | null | undefined,
  ): Promise<SerializedParkingArea[]> {
    const rows = await this.areas.find({
      where: { eventId },
      order: { position: 'ASC' },
    });
    const venue = eventPoint
      ? { lng: eventPoint.coordinates[0], lat: eventPoint.coordinates[1] }
      : null;
    return rows.map((row) => {
      const coordinates = {
        lng: row.coordinates.coordinates[0],
        lat: row.coordinates.coordinates[1],
      };
      return {
        id: row.id,
        name: row.name,
        kinds: row.kinds,
        coordinates,
        address: row.address,
        capacity: row.capacity,
        fee: row.fee,
        feeNote: row.feeNote,
        openFrom: row.openFrom,
        openUntil: row.openUntil,
        note: row.note,
        distanceM: venue ? distanceMeters(venue, coordinates) : null,
      };
    });
  }
}

/** Comparable form of an area; coordinates to about one metre. */
function key(a: ParkingAreaInput): string {
  return JSON.stringify([
    a.name.trim(),
    [...new Set(a.kinds)].sort(),
    Number(a.coordinates.lat.toFixed(5)),
    Number(a.coordinates.lng.toFixed(5)),
    a.address?.trim() || null,
    a.capacity ?? null,
    a.fee ?? null,
    a.feeNote?.trim() || null,
    a.openFrom || null,
    a.openUntil || null,
    a.note?.trim() || null,
  ]);
}
