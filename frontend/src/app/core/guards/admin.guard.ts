import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.currentUser()?.isAdmin) return true;

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  return router.createUrlTree(['/events']);
};
