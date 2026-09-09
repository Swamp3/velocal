import { inject, Injectable } from '@angular/core';
import { ChangelogEntry } from '@shared/models';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ChangelogService {
  private readonly api = inject(ApiService);

  getChangelog(): Observable<ChangelogEntry[]> {
    return this.api.get('/changelog');
  }
}
