import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard, but never rejects the request — a missing or invalid
 * token just means `request.user` stays unset. Use on endpoints that are
 * public but behave differently for an authenticated (e.g. admin) caller.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
