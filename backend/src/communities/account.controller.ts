import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(
    @CurrentUser() user: { id: string },
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.deletion.deleteAccount(user.id, dto);
  }
}
