import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  templateUrl: './terms.component.html',
})
export class TermsComponent implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setMeta({
      title: 'VeloCal — Nutzungsbedingungen',
      description: 'Nutzungsbedingungen für VeloCal.',
      url: this.seo.pageUrl('/nutzungsbedingungen'),
      noindex: true,
    });
  }
}
