import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { BanUserDto } from './dto/ban-user.dto';
import { UsersService } from './users.service';
import { AdminUserSearchDto } from './dto/admin-user-search.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query() dto: AdminUserSearchDto) {
    return this.usersService.adminList(dto);
  }

  @Get(':id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findById(id);
    if (!user) return null;
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  @Patch(':id/role')
  async toggleRole(
    @Param('id', ParseUUIDPipe) targetId: string,
    @CurrentUser() caller: { id: string },
  ) {
    if (caller.id === targetId) {
      throw new BadRequestException('Cannot change your own admin role');
    }

    const user = await this.usersService.toggleAdmin(targetId);
    await this.audit.record({
      actorId: caller.id,
      action: user.isAdmin ? 'user.promote' : 'user.demote',
      targetType: 'user',
      targetId,
      targetLabel: user.displayName || user.email,
    });
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  @Post(':id/ban')
  async ban(
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() dto: BanUserDto,
    @CurrentUser() caller: { id: string },
  ) {
    if (caller.id === targetId) {
      throw new BadRequestException('Cannot ban yourself');
    }
    const target = await this.usersService.findById(targetId);
    if (!target) throw new NotFoundException('User not found');
    if (target.isAdmin) {
      throw new BadRequestException('Remove admin rights before banning');
    }
    const user = await this.usersService.setBan(targetId, dto.reason.trim());
    await this.audit.record({
      actorId: caller.id,
      action: 'user.ban',
      targetType: 'user',
      targetId,
      targetLabel: user.displayName || user.email,
      details: { reason: user.banReason },
    });
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  @Post(':id/unban')
  async unban(
    @Param('id', ParseUUIDPipe) targetId: string,
    @CurrentUser() caller: { id: string },
  ) {
    const user = await this.usersService.setBan(targetId, null);
    await this.audit.record({
      actorId: caller.id,
      action: 'user.unban',
      targetType: 'user',
      targetId,
      targetLabel: user.displayName || user.email,
    });
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}
