import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { PostsService, PaginatedPosts, SerializedPost } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostSearchDto } from './dto/post-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const imagePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
  .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
  .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST });

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(@Query() query: PostSearchDto): Promise<PaginatedPosts> {
    return this.postsService.findAll(query);
  }

  @Get('tags')
  getTags(): Promise<string[]> {
    return this.postsService.getAllTags();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string): Promise<SerializedPost> {
    return this.postsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedPost> {
    return this.postsService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<SerializedPost> {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.postsService.remove(id);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(imagePipe) file: Express.Multer.File,
  ): Promise<SerializedPost> {
    return this.postsService.setImage(id, file);
  }

  @Delete(':id/image')
  @UseGuards(JwtAuthGuard, AdminGuard)
  deleteImage(@Param('id', ParseUUIDPipe) id: string): Promise<SerializedPost> {
    return this.postsService.removeImage(id);
  }
}
