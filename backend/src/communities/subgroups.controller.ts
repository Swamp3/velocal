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
import { CreateSubgroupDto } from './dto/create-subgroup.dto';
import { InviteSubgroupMemberDto } from './dto/invite-subgroup-member.dto';
import { UpdateSubgroupRoleDto } from './dto/update-subgroup-role.dto';
import { UpdateSubgroupDto } from './dto/update-subgroup.dto';
import {
  JoinSubgroupResult,
  SerializedSubgroup,
  SerializedSubgroupJoinRequest,
  SerializedSubgroupMember,
  SubgroupsService,
} from './subgroups.service';

const imagePipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
  .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
  .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST });

@Controller('communities/:communitySlug/subgroups')
export class SubgroupsController {
  constructor(private readonly subgroups: SubgroupsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  create(
    @Param('communitySlug') communitySlug: string,
    @Body() dto: CreateSubgroupDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.create(communitySlug, dto, user.id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Param('communitySlug') communitySlug: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedSubgroup[]> {
    return this.subgroups.list(communitySlug, user?.id);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user?: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.findBySlug(communitySlug, slug, user?.id);
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(BadWordInterceptor)
  @CheckBadWords('name', 'description')
  update(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @Body() dto: UpdateSubgroupDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.update(communitySlug, slug, dto, user.id);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.subgroups.remove(communitySlug, slug, user.id);
  }

  @Post(':slug/hero')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadHero(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @UploadedFile(imagePipe) file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.setHero(communitySlug, slug, file, user.id);
  }

  @Delete(':slug/hero')
  @UseGuards(JwtAuthGuard)
  removeHero(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.removeHero(communitySlug, slug, user.id);
  }

  @Post(':slug/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadLogo(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @UploadedFile(imagePipe) file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.setLogo(communitySlug, slug, file, user.id);
  }

  @Delete(':slug/logo')
  @UseGuards(JwtAuthGuard)
  removeLogo(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.removeLogo(communitySlug, slug, user.id);
  }

  @Post(':slug/join')
  @UseGuards(JwtAuthGuard)
  join(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ): Promise<JoinSubgroupResult> {
    return this.subgroups.join(communitySlug, slug, user.id);
  }

  @Post(':slug/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.subgroups.leave(communitySlug, slug, user.id);
  }

  @Get(':slug/members')
  @UseGuards(JwtAuthGuard)
  listMembers(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroupMember[]> {
    return this.subgroups.listMembers(communitySlug, slug, user.id);
  }

  @Patch(':slug/members/:userId')
  @UseGuards(JwtAuthGuard)
  updateMemberRole(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateSubgroupRoleDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroupMember> {
    return this.subgroups.updateMemberRole(
      communitySlug,
      slug,
      userId,
      dto,
      user.id,
    );
  }

  @Delete(':slug/members/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    return this.subgroups.removeMember(communitySlug, slug, userId, user.id);
  }

  @Get(':slug/join-requests')
  @UseGuards(JwtAuthGuard)
  listJoinRequests(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroupJoinRequest[]> {
    return this.subgroups.listJoinRequests(communitySlug, slug, user.id);
  }

  @Post(':slug/join-requests/:requestId/approve')
  @UseGuards(JwtAuthGuard)
  approve(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: { id: string },
  ): Promise<{ status: 'approved' }> {
    return this.subgroups.approveJoinRequest(
      communitySlug,
      slug,
      requestId,
      user.id,
    );
  }

  @Post(':slug/join-requests/:requestId/reject')
  @UseGuards(JwtAuthGuard)
  reject(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: { id: string },
  ): Promise<{ status: 'rejected' }> {
    return this.subgroups.rejectJoinRequest(
      communitySlug,
      slug,
      requestId,
      user.id,
    );
  }

  @Post(':slug/invites')
  @UseGuards(JwtAuthGuard)
  invite(
    @Param('communitySlug') communitySlug: string,
    @Param('slug') slug: string,
    @Body() dto: InviteSubgroupMemberDto,
    @CurrentUser() user: { id: string },
  ): Promise<SerializedSubgroup> {
    return this.subgroups.invite(
      communitySlug,
      slug,
      { userId: dto.userId, email: dto.email },
      user.id,
    );
  }
}
