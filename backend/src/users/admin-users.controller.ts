import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { AdminUserSearchDto } from './dto/admin-user-search.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

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
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}
