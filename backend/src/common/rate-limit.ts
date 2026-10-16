import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** Request body field that identifies the account (e.g. `email`). */
  keyField?: string;
  /** Count per signed-in user (needs a JWT guard before this one). */
  byUser?: boolean;
  /** One shared counter for everybody, for public endpoints without an identity. */
  global?: boolean;
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Small in-memory fixed-window limiter keyed by route + account identifier.
 * Keyed on the body field rather than the client IP because the backend sits
 * behind two proxies, where `req.ip` would be the shared proxy address.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const req = context.switchToHttp().getRequest<{
      body?: Record<string, unknown>;
      route?: { path?: string };
      user?: { id?: string };
    }>();
    let raw: unknown;
    if (options.global) raw = 'all';
    else if (options.byUser) raw = req.user?.id;
    else raw = options.keyField ? req.body?.[options.keyField] : undefined;
    if (typeof raw !== 'string' || !raw) return true; // DTO validation rejects it

    const now = Date.now();
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }

    const key = `${req.route?.path ?? ''}:${raw.toLowerCase().trim().slice(0, 320)}`;
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }
    entry.count += 1;
    if (entry.count > options.limit) {
      throw new HttpException(
        'Too many requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
