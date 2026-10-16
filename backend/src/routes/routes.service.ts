import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Repository } from 'typeorm';
import { EventsService } from '../events/events.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/route.dto';
import { RouteFile } from './entities/route-file.entity';
import { Route } from './entities/route.entity';
import { gpxStats, gpxTrack, looksLikeGpx, TrackPoint } from './gpx';
import { SerializedRoute, serializeRoute } from './serialize';

export const MAX_GPX_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_ROUTE = 20;
const MAX_ROUTES_PER_USER = 100;
const TRACK_CACHE_SIZE = 50;

type Viewer = { id: string; isAdmin?: boolean } | undefined;

@Injectable()
export class RoutesService {
  private readonly trackCache = new Map<string, TrackPoint[]>();
  private readonly rootDir = resolve(process.env.UPLOADS_DIR ?? '/app/uploads');

  constructor(
    @InjectRepository(Route) private readonly routes: Repository<Route>,
    @InjectRepository(RouteFile) private readonly files: Repository<RouteFile>,
    private readonly events: EventsService,
  ) {}

  async create(dto: CreateRouteDto, userId: string): Promise<SerializedRoute> {
    if (
      (await this.routes.countBy({ createdById: userId })) >=
      MAX_ROUTES_PER_USER
    ) {
      throw new BadRequestException('Too many routes');
    }
    const saved = await this.routes.save(
      this.routes.create({
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdById: userId,
      }),
    );
    return serializeRoute({ ...saved, files: [] }, true);
  }

  async listMine(userId: string): Promise<SerializedRoute[]> {
    const rows = await this.routes.find({
      where: { createdById: userId },
      relations: { files: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((route) => serializeRoute(route, true));
  }

  async findOne(id: string, viewer: Viewer): Promise<SerializedRoute> {
    const route = await this.requireViewable(id, viewer);
    return serializeRoute(route, this.canEdit(route, viewer));
  }

  async update(
    id: string,
    dto: UpdateRouteDto,
    viewer: Viewer,
  ): Promise<SerializedRoute> {
    const route = await this.requireEditable(id, viewer);
    if (dto.name !== undefined) route.name = dto.name.trim();
    if (dto.description !== undefined) {
      route.description = dto.description?.trim() || null;
    }
    await this.routes.save({
      id: route.id,
      name: route.name,
      description: route.description,
    });
    return serializeRoute(route, true);
  }

  async remove(id: string, viewer: Viewer): Promise<void> {
    const route = await this.requireEditable(id, viewer);
    await this.routes.delete(route.id);
    await rm(join(this.rootDir, 'routes', route.id), {
      recursive: true,
      force: true,
    });
  }

  async addFile(
    id: string,
    upload: { buffer: Buffer; originalname: string; size: number },
    viewer: Viewer,
  ): Promise<SerializedRoute> {
    const route = await this.requireEditable(id, viewer);
    if (route.files.length >= MAX_FILES_PER_ROUTE) {
      throw new BadRequestException('Too many files for one route');
    }
    if (upload.size > MAX_GPX_BYTES) {
      throw new BadRequestException('GPX file is too large');
    }
    const text = upload.buffer.toString('utf8');
    if (text.includes('\0') || !looksLikeGpx(text)) {
      throw new BadRequestException('This is not a GPX file');
    }
    const stats = gpxStats(text);
    if (stats.points < 2) {
      throw new BadRequestException('The GPX file contains no track');
    }

    const fileId = randomUUID();
    const dir = join(this.rootDir, 'routes', route.id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${fileId}.gpx`), upload.buffer);

    const label =
      upload.originalname
        .replace(/\.gpx$/i, '')
        .trim()
        .slice(0, 200) || 'Track';
    const sortOrder = route.files.length
      ? Math.max(...route.files.map((file) => file.sortOrder)) + 1
      : 0;
    await this.files.save(
      this.files.create({
        id: fileId,
        routeId: route.id,
        label,
        sizeBytes: upload.size,
        distanceM: stats.distanceM,
        ascentM: stats.ascentM,
        bounds: stats.bounds,
        sortOrder,
      }),
    );
    return this.findOne(route.id, viewer);
  }

  async removeFile(
    id: string,
    fileId: string,
    viewer: Viewer,
  ): Promise<SerializedRoute> {
    const route = await this.requireEditable(id, viewer);
    const file = route.files.find((row) => row.id === fileId);
    if (!file) throw new NotFoundException('File not found');
    await this.files.delete(file.id);
    await rm(join(this.rootDir, 'routes', route.id, `${file.id}.gpx`), {
      force: true,
    });
    return this.findOne(route.id, viewer);
  }

  async openFile(
    id: string,
    fileId: string,
    viewer: Viewer,
  ): Promise<{ stream: NodeJS.ReadableStream; filename: string }> {
    const route = await this.requireViewable(id, viewer);
    const file = route.files.find((row) => row.id === fileId);
    if (!file) throw new NotFoundException('File not found');
    const path = join(this.rootDir, 'routes', route.id, `${file.id}.gpx`);
    const safeName = file.label.replace(/[^\w.\- ]+/g, '_') || 'track';
    return { stream: createReadStream(path), filename: `${safeName}.gpx` };
  }

  /**
   * A thinned copy of the track for the map page. Files never change, so the
   * result is kept in memory for a while instead of re-reading the GPX.
   */
  async openTrack(
    id: string,
    fileId: string,
    viewer: Viewer,
  ): Promise<TrackPoint[]> {
    const route = await this.requireViewable(id, viewer);
    const file = route.files.find((row) => row.id === fileId);
    if (!file) throw new NotFoundException('File not found');
    const cached = this.trackCache.get(file.id);
    if (cached) {
      this.trackCache.delete(file.id);
      this.trackCache.set(file.id, cached);
      return cached;
    }
    const path = join(this.rootDir, 'routes', route.id, `${file.id}.gpx`);
    const text = await readFile(path, 'utf8').catch(() => {
      throw new NotFoundException('File not found');
    });
    const track = gpxTrack(text);
    this.trackCache.set(file.id, track);
    if (this.trackCache.size > TRACK_CACHE_SIZE) {
      const oldest = this.trackCache.keys().next().value as string;
      this.trackCache.delete(oldest);
    }
    return track;
  }

  private canEdit(route: Route, viewer: Viewer): boolean {
    return !!viewer && (route.createdById === viewer.id || !!viewer.isAdmin);
  }

  private async load(id: string): Promise<Route> {
    const route = await this.routes.findOne({
      where: { id },
      relations: { files: true },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  private async requireEditable(id: string, viewer: Viewer): Promise<Route> {
    const route = await this.load(id);
    if (!viewer) throw new ForbiddenException('Log in to edit routes');
    if (!this.canEdit(route, viewer)) {
      throw new ForbiddenException('You can only edit your own routes');
    }
    return route;
  }

  /** Owner, or anyone who can see an event that uses the route. */
  private async requireViewable(id: string, viewer: Viewer): Promise<Route> {
    const route = await this.load(id);
    if (this.canEdit(route, viewer)) return route;
    if (await this.events.canViewRoute(route.id, viewer?.id)) return route;
    throw new NotFoundException('Route not found');
  }
}
