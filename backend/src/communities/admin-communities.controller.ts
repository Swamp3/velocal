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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminCommunitiesService } from './admin-communities.service';
import { SuspendCommunityDto } from './dto/report.dto';
import { RenameSlugDto, SlugReplaceDto } from './dto/admin-slug.dto';
import { AdminCommunitySearchDto } from './dto/admin-community-search.dto';

/** Review and moderation of all communities for site admins. */
@Controller('admin/communities')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCommunitiesController {
  constructor(private readonly admin: AdminCommunitiesService) {}

  @Get()
  list(@Query() dto: AdminCommunitySearchDto) {
    return this.admin.list(dto);
  }

  /** Find-and-replace in the addresses of communities and subgroups (preview unless `apply`). */
  @Post('slug-replace')
  @HttpCode(HttpStatus.OK)
  replaceSlugs(
    @Body() dto: SlugReplaceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.admin.replaceSlugs(dto, user.id);
  }

  @Patch(':id/slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  renameSlug(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameSlugDto,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.admin.renameSlug(id, dto.slug, user.id);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.detail(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommunity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.admin.removeCommunity(id, user.id);
  }

  @Delete(':id/subgroups/:subgroupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubgroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subgroupId', ParseUUIDPipe) subgroupId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.admin.removeSubgroup(id, subgroupId, user.id);
  }

  @Delete(':id/posts/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.admin.removePost(id, postId, user.id);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.admin.removeComment(id, commentId, user.id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendCommunityDto,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.admin.suspend(id, dto.reason, user.id);
  }

  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsuspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.admin.unsuspend(id, user.id);
  }
}
