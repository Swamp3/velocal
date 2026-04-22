import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Point } from 'geojson';
import { User } from './entities/user.entity';
import { UserFavorite } from './entities/user-favorite.entity';
import { UserDisciplinePref } from './entities/user-discipline-pref.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GeocodingService } from '../events/geocoding.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserFavorite)
    private readonly favoriteRepository: Repository<UserFavorite>,
    @InjectRepository(UserDisciplinePref)
    private readonly disciplinePrefRepository: Repository<UserDisciplinePref>,
    private readonly geocodingService: GeocodingService,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async update(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.userRepository.findOneByOrFail({ id: userId });

    Object.assign(user, dto);

    if (dto.homeZip !== undefined || dto.homeCountry !== undefined) {
      const zip = dto.homeZip ?? user.homeZip;
      const country = dto.homeCountry ?? user.homeCountry;

      if (zip) {
        const result = await this.geocodingService.geocodeZip(zip, country);
        user.homeCoordinates = result
          ? ({ type: 'Point', coordinates: [result.lng, result.lat] } as Point)
          : (null as unknown as Point);
      }
    }

    return this.userRepository.save(user);
  }

  // --- Favorites ---

  async getFavorites(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: UserFavorite[]; total: number }> {
    const [data, total] = await this.favoriteRepository.findAndCount({
      where: { userId },
      relations: ['event', 'event.discipline'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async addFavorite(userId: string, eventId: string): Promise<void> {
    await this.favoriteRepository
      .createQueryBuilder()
      .insert()
      .into(UserFavorite)
      .values({ userId, eventId })
      .orIgnore()
      .execute();
  }

  async removeFavorite(userId: string, eventId: string): Promise<void> {
    await this.favoriteRepository.delete({ userId, eventId });
  }

  // --- Discipline Preferences ---

  async getDisciplinePrefs(userId: string): Promise<string[]> {
    const prefs = await this.disciplinePrefRepository.find({
      where: { userId },
    });
    return prefs.map((p) => p.disciplineSlug);
  }

  async setDisciplinePrefs(
    userId: string,
    slugs: string[],
  ): Promise<string[]> {
    await this.disciplinePrefRepository.delete({ userId });

    if (slugs.length) {
      const entities = slugs.map((slug) =>
        this.disciplinePrefRepository.create({
          userId,
          disciplineSlug: slug,
        }),
      );
      await this.disciplinePrefRepository.save(entities);
    }

    return slugs;
  }
}
