import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  // The server render is anonymous. Attaching the token before hydration makes
  // the replayed response miss the transfer cache and the client paints a
  // different tree than the HTML it was given.
  const token = auth.hydrated() ? auth.getToken() : null;

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req);
};
