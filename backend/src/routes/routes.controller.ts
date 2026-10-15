import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { BadWordInterceptor, CheckBadWords } from '../common/bad-words';
import { CreateRouteDto, UpdateRouteDto } from './dto/route.dto';
import { MAX_GPX_BYTES, RoutesService } from './routes.service';
import { SerializedRoute } from './serialize';

type User = { id: string; isAdmin?: boolean };

@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  create(
    @Body() dto: CreateRouteDto,
    @CurrentUser() user: User,
  ): Promise<SerializedRoute> {
    return this.routes.create(dto, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: User): Promise<SerializedRoute[]> {
    return this.routes.listMine(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: User,
  ): Promise<SerializedRoute> {
    return this.routes.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() user: User,
  ): Promise<SerializedRoute> {
    return this.routes.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.routes.remove(id, user);
  }

  @Post(':id/files')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_GPX_BYTES } }),
  )
  addFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ): Promise<SerializedRoute> {
    return this.routes.addFile(id, file, user);
  }

  @Delete(':id/files/:fileId')
  @UseGuards(JwtAuthGuard)
  removeFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
  ): Promise<SerializedRoute> {
    return this.routes.removeFile(id, fileId, user);
  }

  @Get(':id/files/:fileId/download')
  @UseGuards(OptionalJwtAuthGuard)
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res() res: Response,
    @CurrentUser() user?: User,
  ): Promise<void> {
    const { stream, filename } = await this.routes.openFile(id, fileId, user);
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    stream.pipe(res);
  }
}
