import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(_err: unknown, user: T): T | null {
    return user || null;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
