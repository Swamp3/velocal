import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { BadWordInterceptor } from './bad-word.interceptor';
import { BadWordService } from './bad-word.service';

function createMockContext(body: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => () => {},
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  } as unknown as ExecutionContext;
}

const mockNext: CallHandler = { handle: () => of('ok') };

describe('BadWordInterceptor', () => {
  let interceptor: BadWordInterceptor;
  let reflector: Reflector;
  let service: BadWordService;

  beforeEach(() => {
    service = new BadWordService();
    reflector = new Reflector();
    interceptor = new BadWordInterceptor(reflector, service);
  });

  it('should pass through when no @CheckBadWords metadata is set', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const ctx = createMockContext({ name: 'fuck this' });
    interceptor.intercept(ctx, mockNext).subscribe({
      next: (val) => {
        expect(val).toBe('ok');
        done();
      },
    });
  });

  it('should pass through when text is clean', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(['name', 'description']);

    const ctx = createMockContext({ name: 'Sunday Ride', description: 'Fun cycling event' });
    interceptor.intercept(ctx, mockNext).subscribe({
      next: (val) => {
        expect(val).toBe('ok');
        done();
      },
    });
  });

  it('should throw 422 UnprocessableEntityException for bad words', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['name', 'description']);

    const ctx = createMockContext({ name: 'Nice event', description: 'This is shit' });

    expect(() => interceptor.intercept(ctx, mockNext)).toThrow();

    try {
      interceptor.intercept(ctx, mockNext);
    } catch (err: unknown) {
      const response = (err as { getResponse: () => Record<string, unknown> }).getResponse();
      expect(response).toMatchObject({
        statusCode: 422,
        error: 'content_policy_violation',
        violations: [{ field: 'description' }],
      });
    }
  });

  it('should report the correct violating fields', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['name', 'description', 'locationName']);

    const ctx = createMockContext({
      name: 'Fuck race',
      description: 'A clean description',
      locationName: 'Arschloch Park',
    });

    try {
      interceptor.intercept(ctx, mockNext);
    } catch (err: unknown) {
      const response = (err as { getResponse: () => Record<string, unknown> }).getResponse();
      expect((response as { violations: { field: string }[] }).violations).toEqual([
        { field: 'name' },
        { field: 'locationName' },
      ]);
    }
  });
});
