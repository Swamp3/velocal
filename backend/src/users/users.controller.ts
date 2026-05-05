import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DisciplinePrefsDto } from './dto/discipline-prefs.dto';
import type { User } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }) {
    const profile = await this.usersService.findById(user.id);
    return this.sanitize(profile);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return this.sanitize(updated);
  }

  @Get('me/favorites')
  getFavorites(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.getFavorites(user.id, page, limit);
  }

  @Post('me/favorites/:eventId')
  @HttpCode(HttpStatus.CREATED)
  addFavorite(
    @CurrentUser() user: { id: string },
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.usersService.addFavorite(user.id, eventId);
  }

  @Delete('me/favorites/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFavorite(
    @CurrentUser() user: { id: string },
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.usersService.removeFavorite(user.id, eventId);
  }

  @Get('me/discipline-prefs')
  getDisciplinePrefs(@CurrentUser() user: { id: string }) {
    return this.usersService.getDisciplinePrefs(user.id);
  }

  @Put('me/discipline-prefs')
  setDisciplinePrefs(
    @CurrentUser() user: { id: string },
    @Body() dto: DisciplinePrefsDto,
  ) {
    return this.usersService.setDisciplinePrefs(user.id, dto.disciplineSlugs);
  }

  private sanitize(user: User | null) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return { ...rest, hasPassword: !!passwordHash };
  }
}
