import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '@shared/ui';
import { catchError, throwError, retry, timer } from 'rxjs';

const RETRYABLE_STATUS = new Set([0, 408, 429, 502, 503, 504]);
const MAX_RETRIES = 1;
const RETRY_DELAY = 2000;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const transloco = inject(TranslocoService);

  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: HttpErrorResponse) => {
        if (RETRYABLE_STATUS.has(error.status)) {
          return timer(RETRY_DELAY);
        }
        throw error;
      },
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        toast.error(transloco.translate('errors.offline'));
      } else if (error.status === 408) {
        toast.error(transloco.translate('errors.timeout'));
      } else if (error.status >= 500) {
        toast.error(transloco.translate('errors.serverError'));
      }

      return throwError(() => error);
    }),
  );
};
