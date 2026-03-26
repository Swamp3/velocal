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
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostsService, PaginatedPosts, SerializedPost } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostSearchDto } from './dto/post-search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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
}
