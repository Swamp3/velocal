import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

const AUTH_CACHE_MS = 10_000;
const AUTH_CACHE_MAX = 5_000;
/** The "last seen" time is written at most this often per user. */
const SEEN_WRITE_EVERY_MS = 5 * 60_000;

export interface JwtPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly cache = new Map<
    string,
    {
      until: number;
      user: { id: string; email: string; isAdmin: boolean } | null;
    }
  >();

  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  /**
   * Re-checks the account, so a ban, a deletion or a removed admin role takes
   * effect without waiting for the token to expire. The answer is cached for a
   * few seconds per user: one lookup per burst of requests instead of one per
   * request, at the price of a short delay. The same lookup keeps the user's
   * "last seen" time up to date, written at most every few minutes.
   */
  async validate(payload: JwtPayload) {
    const now = Date.now();
    let entry = this.cache.get(payload.sub);
    if (!entry || entry.until <= now) {
      const user = await this.usersService.findAuthState(payload.sub);
      entry = {
        until: now + AUTH_CACHE_MS,
        user:
          user && !user.bannedAt && !user.deletedAt
            ? { id: user.id, email: user.email, isAdmin: user.isAdmin }
            : null,
      };
      if (
        entry.user &&
        (!user?.lastSeenAt ||
          now - user.lastSeenAt.getTime() > SEEN_WRITE_EVERY_MS)
      ) {
        // Piggybacks on the lookup above; a failed write must never fail the request.
        void this.usersService.recordSeen(payload.sub).catch(() => undefined);
      }
      if (this.cache.size > AUTH_CACHE_MAX) this.cache.clear();
      this.cache.set(payload.sub, entry);
    }
    if (!entry.user) throw new UnauthorizedException('Account unavailable');
    return entry.user;
  }
}
