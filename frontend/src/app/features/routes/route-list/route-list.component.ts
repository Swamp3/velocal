import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RouteService } from '@core/services/route.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EmptyStateComponent } from '@shared/components';
import { formatDistance, Route } from '@shared/models';
import { ButtonComponent, ToastService } from '@shared/ui';

@Component({
  selector: 'app-route-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, TranslocoPipe, ButtonComponent, EmptyStateComponent],
  templateUrl: './route-list.component.html',
})
export class RouteListComponent implements OnInit {
  private readonly routeService = inject(RouteService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly routes = signal<Route[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly distance = formatDistance;

  ngOnInit(): void {
    this.routeService.listMine().subscribe({
      next: (routes) => {
        this.routes.set(routes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    const name = this.form.controls.name.value.trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    this.routeService.create({ name }).subscribe({
      next: (route) => void this.router.navigate(['/routes', route.id]),
      error: () => {
        this.creating.set(false);
        this.toast.error(this.transloco.translate('routes.error'));
      },
    });
  }
}
