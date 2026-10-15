import { inject, Injectable } from '@angular/core';
import { CyclingEvent, PaginatedResponse } from '@shared/models';
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
  triggeredBy: string | null;
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

export interface AdminCommunityRow {
  id: string;
  slug: string;
  name: string;
  visibility: 'public' | 'request' | 'private';
  location: string | null;
  createdAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
  memberCount: number;
  subgroupCount: number;
  postCount: number;
  pollCount: number;
  eventCount: number;
  pendingRequests: number;
}

export interface AdminCommunityDetail extends AdminCommunityRow {
  description: string | null;
  stravaUrl: string | null;
  admins: { userId: string; displayName: string | null; email: string }[];
  subgroups: {
    id: string;
    slug: string;
    name: string;
    visibility: string;
    memberCount: number;
    postCount: number;
  }[];
  recentPosts: {
    id: string;
    title: string;
    createdAt: string;
    authorName: string | null;
    subgroupName: string | null;
  }[];
  recentEvents: {
    id: string;
    name: string;
    startDate: string;
    listing: string;
    subgroupName: string | null;
  }[];
}

export interface AdminCommunitySearchParams {
  q?: string;
  visibility?: 'public' | 'request' | 'private';
  sort?: 'createdAt' | 'name' | 'members' | 'pending';
  order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
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

  // --- Communities ---

  getCommunities(
    params: AdminCommunitySearchParams = {},
  ): Observable<PaginatedResponse<AdminCommunityRow>> {
    return this.api.get<PaginatedResponse<AdminCommunityRow>>(
      '/admin/communities',
      params as Record<string, string | number | boolean>,
    );
  }

  getCommunity(id: string): Observable<AdminCommunityDetail> {
    return this.api.get<AdminCommunityDetail>(`/admin/communities/${id}`);
  }

  deleteCommunity(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/communities/${id}`);
  }

  deleteCommunitySubgroup(id: string, subgroupId: string): Observable<void> {
    return this.api.delete<void>(`/admin/communities/${id}/subgroups/${subgroupId}`);
  }

  deleteCommunityPost(id: string, postId: string): Observable<void> {
    return this.api.delete<void>(`/admin/communities/${id}/posts/${postId}`);
  }

  getUser(id: string): Observable<AdminUser> {
    return this.api.get<AdminUser>(`/admin/users/${id}`);
  }

  toggleUserRole(id: string): Observable<AdminUser> {
    return this.api.patch<AdminUser>(`/admin/users/${id}/role`, {});
  }

  // --- Missing Data ---

  getMissingData(
    params: MissingDataSearchParams = {},
  ): Observable<PaginatedResponse<CyclingEvent & { missingFields: string[] }>> {
    return this.api.get('/admin/events/missing-data', params as Record<string, string | number | boolean>);
  }

  getMissingDataStats(): Observable<Record<string, number>> {
    return this.api.get<Record<string, number>>('/admin/events/missing-data/stats');
  }

  // --- Analytics ---

  getTopPages(days = 30, limit = 20): Observable<{ path: string; views: number }[]> {
    return this.api.get<{ path: string; views: number }[]>(
      '/admin/analytics/top-pages',
      { days, limit },
    );
  }

  getAnalyticsOverview(
    days = 30,
  ): Observable<AnalyticsOverview> {
    return this.api.get<AnalyticsOverview>('/admin/analytics/overview', { days });
  }
}

export interface DailyStats {
  date: string;
  views: number;
  uniqueClients: number;
}

export interface AnalyticsOverview {
  totalViews: number;
  uniquePaths: number;
  uniqueClients: number;
  daily: DailyStats[];
}

export type MissingDataType = 'url' | 'address' | 'coordinates' | 'description';

export interface MissingDataSearchParams {
  type?: MissingDataType;
  page?: number;
  limit?: number;
}
