import { inject, Injectable } from '@angular/core';
import { PaginatedResponse } from '@shared/models';
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

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminUserSearchParams {
  q?: string;
  role?: 'admin' | 'user';
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'email' | 'displayName';
  order?: 'ASC' | 'DESC';
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  // --- Imports ---

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

  // --- Users ---

  getUsers(params: AdminUserSearchParams = {}): Observable<PaginatedResponse<AdminUser>> {
    return this.api.get<PaginatedResponse<AdminUser>>(
      '/admin/users',
      params as Record<string, string | number | boolean>,
    );
  }

  getUser(id: string): Observable<AdminUser> {
    return this.api.get<AdminUser>(`/admin/users/${id}`);
  }

  toggleUserRole(id: string): Observable<AdminUser> {
    return this.api.patch<AdminUser>(`/admin/users/${id}/role`, {});
  }
}
