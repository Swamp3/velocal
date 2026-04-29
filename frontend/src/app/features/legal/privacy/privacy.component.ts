import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setMeta({
      title: 'VeloCal — Datenschutzerklärung',
      description: 'Datenschutzerklärung gemäß DSGVO.',
      url: this.seo.pageUrl('/datenschutz'),
      noindex: true,
    });
  }
}
