import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AppShellComponent } from '@core/layout/app-shell.component';
import { PageTrackingService } from '@core/services/page-tracking.service';

@Component({
  selector: 'app-root',
  imports: [AppShellComponent],
  template: '<app-shell />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly pageTracking = inject(PageTrackingService);

  ngOnInit(): void {
    this.pageTracking.init();
  }
}
