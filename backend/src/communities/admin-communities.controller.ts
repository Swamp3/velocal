import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminCommunitiesService } from './admin-communities.service';
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

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.detail(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommunity(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.admin.removeCommunity(id);
  }

  @Delete(':id/subgroups/:subgroupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubgroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subgroupId', ParseUUIDPipe) subgroupId: string,
  ): Promise<void> {
    return this.admin.removeSubgroup(id, subgroupId);
  }

  @Delete(':id/posts/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<void> {
    return this.admin.removePost(id, postId);
  }
}
