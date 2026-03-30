import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '@shared/ui';
import { catchError, retry, throwError, timer } from 'rxjs';

const RETRYABLE_STATUS = new Set([0, 408, 429, 502, 503, 504]);
const MAX_RETRIES = 1;
const RETRY_DELAY = 2000;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const toast = inject(ToastService);
  const transloco = inject(TranslocoService);

  const isMutation = req.method !== 'GET';

  return next(req).pipe(
    retry({
      count: isMutation ? 0 : MAX_RETRIES,
      delay: (error: HttpErrorResponse) => {
        if (RETRYABLE_STATUS.has(error.status)) {
          return timer(RETRY_DELAY);
        }
        throw error;
      },
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        injector.get(AuthService).logout();
        injector.get(Router).navigate(['/auth/login']);
      } else if (error.status === 0) {
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
