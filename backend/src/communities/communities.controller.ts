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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { BadWordInterceptor, CheckBadWords } from '../common/bad-words';
import {
  CommunitiesService,
  JoinCommunityResult,
  PaginatedCommunities,
  SerializedCommunity,
  SerializedJoinRequest,
  SerializedMember,
} from './communities.service';
import { CommunitySearchDto } from './dto/community-search.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

const imagePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
  .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
  .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST });

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  create(
    @Body() dto: CreateCommunityDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunity> {
    return this.communitiesService.create(dto, user.id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query() query: CommunitySearchDto,
    @CurrentUser() user?: { id: string },
  ): Promise<PaginatedCommunities> {
    return this.communitiesService.findAll(query, user?.id);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunity[]> {
    return this.communitiesService.findMine(user.id);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedCommunity> {
    return this.communitiesService.findBySlug(slug, user?.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommunityDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunity> {
    return this.communitiesService.update(id, dto, user.id);
  }

  @Post(':id/hero')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadHero(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(imagePipe) file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunity> {
    return this.communitiesService.setHero(id, file, user.id);
  }

  @Delete(':id/hero')
  @UseGuards(JwtAuthGuard)
  deleteHero(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunity> {
    return this.communitiesService.removeHero(id, user.id);
  }

  @Post(':id/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(imagePipe) file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunity> {
    return this.communitiesService.setLogo(id, file, user.id);
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard)
  deleteLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedCommunity> {
    return this.communitiesService.removeLogo(id, user.id);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<JoinCommunityResult> {
    return this.communitiesService.join(id, user.id);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.communitiesService.leave(id, user.id);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedMember[]> {
    return this.communitiesService.listMembers(id, user.id);
  }

  @Patch(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedMember> {
    return this.communitiesService.updateMemberRole(id, userId, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.communitiesService.removeMember(id, userId, user.id);
  }

  @Get(':id/join-requests')
  @UseGuards(JwtAuthGuard)
  listJoinRequests(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedJoinRequest[]> {
    return this.communitiesService.listJoinRequests(id, user.id);
  }

  @Post(':id/join-requests/:requestId/approve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  approveJoinRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: { id: string },
  ): Promise<{ status: 'approved' }> {
    return this.communitiesService.approveJoinRequest(id, requestId, user.id);
  }

  @Post(':id/join-requests/:requestId/reject')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  rejectJoinRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: { id: string },
  ): Promise<{ status: 'rejected' }> {
    return this.communitiesService.rejectJoinRequest(id, requestId, user.id);
  }
}
