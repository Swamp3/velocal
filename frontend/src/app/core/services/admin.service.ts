import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type ImportJobStatus = 'running' | 'completed' | 'failed';

export interface ImportJob {
  id: string;
  source: string | null;
  status: ImportJobStatus;
  startedAt: string;
  finishedAt: string | null;
  result: { created: number; updated: number; skipped: number } | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  getImportJobs(): Observable<ImportJob[]> {
    return this.api.get<ImportJob[]>('/import/jobs');
  }

  getImportJob(id: string): Observable<ImportJob> {
    return this.api.get<ImportJob>(`/import/jobs/${id}`);
  }

  triggerImport(source?: string): Observable<ImportJob> {
    return this.api.post<ImportJob>('/import/trigger', { source });
  }

  getImportSources(): Observable<string[]> {
    return this.api.get<string[]>('/import/sources');
  }
}
