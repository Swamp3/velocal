import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SeoService } from '@core/services/seo.service';
import { AddToCalendarComponent } from '@shared/components';

@Component({
  selector: 'app-imprint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, AddToCalendarComponent],
  templateUrl: './imprint.component.html',
})
export class ImprintComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setMeta({
      title: 'VeloCal — Impressum',
      description: 'Impressum und Anbieterkennzeichnung gemäß § 5 TMG.',
      url: this.seo.pageUrl('/impressum'),
      noindex: true,
    });
  }
}
