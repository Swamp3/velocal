import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { BAD_WORD_FIELDS_KEY } from './check-bad-words.decorator';
import { BadWordService } from './bad-word.service';

@Injectable()
export class BadWordInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly badWordService: BadWordService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const fields = this.reflector.get<string[] | undefined>(
      BAD_WORD_FIELDS_KEY,
      context.getHandler(),
    );

    if (!fields?.length) return next.handle();

    const body = context.switchToHttp().getRequest().body ?? {};
    const result = this.badWordService.checkFields(body, fields);

    if (!result.clean) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'content_policy_violation',
        message: 'Content contains inappropriate language',
        violations: result.violations,
      });
    }

    return next.handle();
  }
}
