import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BadWordInterceptor, CheckBadWords } from '../common/bad-words';
import {
  CommunityPostsService,
  SerializedCommunityComment,
  SerializedCommunityPost,
} from './community-posts.service';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';
import { CreateCommunityPostDto } from './dto/create-community-post.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CommunityPostsController {
  constructor(private readonly posts: CommunityPostsService) {}

  @Get('communities/:communitySlug/posts')
  listCommunity(
    @Param('communitySlug') communitySlug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityPost[]> {
    return this.posts.list(communitySlug, user.id);
  }

  @Post('communities/:communitySlug/posts')
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('title', 'body')
  createCommunity(
    @Param('communitySlug') communitySlug: string,
    @Body() dto: CreateCommunityPostDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityPost> {
    return this.posts.create(communitySlug, user.id, dto);
  }

  @Get('communities/:communitySlug/posts/:postId')
  findCommunity(
    @Param('communitySlug') communitySlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityPost> {
    return this.posts.findOne(communitySlug, postId, user.id);
  }

  @Delete('communities/:communitySlug/posts/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommunity(
    @Param('communitySlug') communitySlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.posts.remove(communitySlug, postId, user.id);
  }

  @Get('communities/:communitySlug/posts/:postId/comments')
  listCommunityComments(
    @Param('communitySlug') communitySlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityComment[]> {
    return this.posts.listComments(communitySlug, postId, user.id);
  }

  @Post('communities/:communitySlug/posts/:postId/comments')
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('body')
  addCommunityComment(
    @Param('communitySlug') communitySlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommunityCommentDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityComment> {
    return this.posts.addComment(communitySlug, postId, user.id, dto);
  }

  @Delete('communities/:communitySlug/posts/:postId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommunityComment(
    @Param('communitySlug') communitySlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.posts.removeComment(communitySlug, postId, commentId, user.id);
  }

  @Get('communities/:communitySlug/subgroups/:subgroupSlug/posts')
  listSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityPost[]> {
    return this.posts.list(communitySlug, user.id, subgroupSlug);
  }

  @Post('communities/:communitySlug/subgroups/:subgroupSlug/posts')
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('title', 'body')
  createSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Body() dto: CreateCommunityPostDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityPost> {
    return this.posts.create(communitySlug, user.id, dto, subgroupSlug);
  }

  @Get('communities/:communitySlug/subgroups/:subgroupSlug/posts/:postId')
  findSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityPost> {
    return this.posts.findOne(communitySlug, postId, user.id, subgroupSlug);
  }

  @Delete('communities/:communitySlug/subgroups/:subgroupSlug/posts/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubgroup(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.posts.remove(communitySlug, postId, user.id, subgroupSlug);
  }

  @Get(
    'communities/:communitySlug/subgroups/:subgroupSlug/posts/:postId/comments',
  )
  listSubgroupComments(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityComment[]> {
    return this.posts.listComments(
      communitySlug,
      postId,
      user.id,
      subgroupSlug,
    );
  }

  @Post(
    'communities/:communitySlug/subgroups/:subgroupSlug/posts/:postId/comments',
  )
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('body')
  addSubgroupComment(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommunityCommentDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunityComment> {
    return this.posts.addComment(
      communitySlug,
      postId,
      user.id,
      dto,
      subgroupSlug,
    );
  }

  @Delete(
    'communities/:communitySlug/subgroups/:subgroupSlug/posts/:postId/comments/:commentId',
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubgroupComment(
    @Param('communitySlug') communitySlug: string,
    @Param('subgroupSlug') subgroupSlug: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.posts.removeComment(
      communitySlug,
      postId,
      commentId,
      user.id,
      subgroupSlug,
    );
  }
}
