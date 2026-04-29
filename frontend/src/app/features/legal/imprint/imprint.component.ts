import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { SeoService } from '@core/services/seo.service';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-imprint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
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
