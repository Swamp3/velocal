import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ApiService } from './api.service';
import { Discipline } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class DisciplineService {
  private readonly api = inject(ApiService);

  private readonly disciplines$ = this.api
    .get<Discipline[]>('/disciplines')
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

  getDisciplines(): Observable<Discipline[]> {
    return this.disciplines$;
  }
}
