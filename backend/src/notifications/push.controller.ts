import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '../common/rate-limit';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushPreferencesDto, SubscribePushDto } from './dto/push.dto';
import { PushPreferences, PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** Public: the frontend needs the key and the on/off state before sign-in checks. */
  @Get('config')
  config(): { enabled: boolean; publicKey: string } {
    return this.push.getConfig();
  }

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60 * 60 * 1000, byUser: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(
    @CurrentUser() user: { id: string },
    @Body() dto: SubscribePushDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    if (!this.push.getConfig().enabled) {
      throw new ServiceUnavailableException('Push is not configured');
    }
    await this.push.subscribe(
      user.id,
      { endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      userAgent,
    );
  }

  @Delete('subscriptions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(
    @CurrentUser() user: { id: string },
    @Query('endpoint') endpoint: string,
  ): Promise<void> {
    return this.push.unsubscribe(user.id, endpoint ?? '');
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  preferences(@CurrentUser() user: { id: string }): Promise<PushPreferences> {
    return this.push.preferences(user.id);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: PushPreferencesDto,
  ): Promise<PushPreferences> {
    return this.push.updatePreferences(user.id, dto);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async test(@CurrentUser() user: { id: string }): Promise<{ sent: number }> {
    if (!this.push.getConfig().enabled) {
      throw new ServiceUnavailableException('Push is not configured');
    }
    const result = await this.push.sendTest(user.id);
    if (result === 'cooldown') {
      throw new HttpException('Please wait', HttpStatus.TOO_MANY_REQUESTS);
    }
    return result;
  }
}
