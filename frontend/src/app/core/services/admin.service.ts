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
  /** Set for file imports. */
  fileName?: string | null;
}

export type ImportIssueSeverity = 'error' | 'warning' | 'info';

export interface ImportIssue {
  severity: ImportIssueSeverity;
  code: string;
  index?: number;
  externalId?: string;
  field?: string;
  params?: Record<string, string | number>;
  /** English fallback text from the server. */
  message: string;
}

export type ImportAction = 'create' | 'update' | 'unchanged' | 'skip' | 'invalid';

export interface ImportReportEntry {
  index: number;
  externalId: string | null;
  name: string | null;
  startDate: string | null;
  action: ImportAction;
  eventId?: string;
  changes?: { field: string; before: unknown; after: unknown }[];
  issues: ImportIssue[];
}

export interface ImportReport {
  sourceName: string | null;
  complete: boolean;
  fileName: string | null;
  summary: Record<ImportAction, number> & { errors: number; warnings: number };
  fileIssues: ImportIssue[];
  entries: ImportReportEntry[];
}

export interface ImportCheck {
  report: ImportReport;
  canImport: boolean;
  needsConfirmation: boolean;
}

/** Admin view of where an imported event came from. */
export interface EventImportInfo {
  source: string;
  sourceName: string | null;
  externalId: string | null;
  sourceUrl: string | null;
  lastSeenAt: string | null;
  missingSince: string | null;
  sources: { name: string; url: string; checkedAt?: string; updatedAt?: string }[];
  conflicts: { field: string; values?: unknown[]; selectedSource?: string; reason?: string }[];
  editedFields: string[];
  importRun: { id: string; fileName: string | null; startedAt: string; triggeredBy: string | null } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  emailVerified: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  createdAt: string;
  /** Last sign-in; null for accounts that have not signed in since this was tracked. */
  lastSeenAt?: string | null;
}

export interface DuplicateEvent {
  id: string;
  name: string;
  startDate: string;
  locationName: string;
  address: string | null;
  status: string;
  disciplineSlug: string;
  source: 'manual' | 'imported' | string;
  sourceName: string | null;
  sourceUrl: string | null;
  externalUrl: string | null;
  lastSeenAt: string | null;
  missingSince: string | null;
  createdAt: string;
}

export interface DuplicateGroup {
  key: string;
  date: string;
  score: number;
  reasons: ('sameName' | 'similarName' | 'sameLocation' | 'nearby')[];
  events: DuplicateEvent[];
}

export type MissingAtSourceEvent = CyclingEvent & {
  sourceName: string | null;
  sourceUrl: string | null;
  lastSeenAt: string | null;
  missingSince: string | null;
};

export interface AdminUserSearchParams {
  q?: string;
  role?: 'admin' | 'user';
  status?: 'banned';
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'lastSeenAt' | 'email' | 'displayName';
  order?: 'ASC' | 'DESC';
}

export interface SlugChange {
  type: 'community' | 'subgroup';
  id: string;
  name: string;
  oldSlug: string;
  newSlug: string;
  problem: 'invalid' | 'reserved' | 'taken' | null;
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
  openReports: number;
  suspendedAt: string | null;
  suspendedReason: string | null;
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
  sort?: 'createdAt' | 'name' | 'members' | 'pending' | 'reports';
  order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface AdminReport {
  id: string;
  status: ReportStatus;
  targetType: 'community' | 'post' | 'comment';
  targetId: string;
  targetLabel: string;
  reason: 'spam' | 'abuse' | 'inappropriate' | 'illegal' | 'other';
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  communityId: string | null;
  communityName: string | null;
  communitySlug: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reportsOnTarget: number;
}

export interface AuditEntry {
  id: string;
  actorLabel: string;
  action: string;
  targetType: string | null;
  targetLabel: string | null;
  communityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
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

  /** Dry run: what importing this file would do. Writes nothing. */
  checkImportFile(file: unknown, fileName: string): Observable<ImportCheck> {
    return this.api.post<ImportCheck>(
      `/import/events/check?fileName=${encodeURIComponent(fileName)}`,
      file,
    );
  }

  importFile(file: unknown, fileName: string, acceptWarnings: boolean): Observable<ImportJob> {
    const query = `fileName=${encodeURIComponent(fileName)}&acceptWarnings=${acceptWarnings}`;
    return this.api.post<ImportJob>(`/import/events?${query}`, file);
  }

  getImportReport(id: string): Observable<{ report: ImportReport | null }> {
    return this.api.get<{ report: ImportReport | null }>(`/import/jobs/${id}/report`);
  }

  getEventImportInfo(eventId: string): Observable<EventImportInfo> {
    return this.api.get<EventImportInfo>(`/admin/events/${eventId}/import-info`);
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

  deleteCommunityComment(id: string, commentId: string): Observable<void> {
    return this.api.delete<void>(`/admin/communities/${id}/comments/${commentId}`);
  }

  renameCommunitySlug(id: string, slug: string): Observable<void> {
    return this.api.patch<void>(`/admin/communities/${id}/slug`, { slug });
  }

  /** Preview (or with `apply`, perform) a find-and-replace in community/subgroup addresses. */
  replaceSlugs(body: {
    find: string;
    replace: string;
    target: 'communities' | 'subgroups' | 'both';
    apply?: boolean;
    ids?: string[];
  }): Observable<{ applied: boolean; changes: SlugChange[] }> {
    return this.api.post(`/admin/communities/slug-replace`, body);
  }

  suspendCommunity(id: string, reason: string): Observable<void> {
    return this.api.post<void>(`/admin/communities/${id}/suspend`, { reason });
  }

  unsuspendCommunity(id: string): Observable<void> {
    return this.api.post<void>(`/admin/communities/${id}/unsuspend`, {});
  }

  // --- Reports ---

  getReports(status: ReportStatus, page = 1): Observable<PaginatedResponse<AdminReport>> {
    return this.api.get<PaginatedResponse<AdminReport>>('/admin/reports', { status, page });
  }

  getOpenReportCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>('/admin/reports/open-count');
  }

  resolveReport(
    id: string,
    status: 'resolved' | 'dismissed',
    note?: string,
  ): Observable<{ status: string }> {
    return this.api.patch<{ status: string }>(`/admin/reports/${id}`, { status, note });
  }

  // --- Audit log ---

  getAuditLog(
    params: { q?: string; action?: string; page?: number } = {},
  ): Observable<PaginatedResponse<AuditEntry>> {
    return this.api.get<PaginatedResponse<AuditEntry>>(
      '/admin/audit',
      params as Record<string, string | number | boolean>,
    );
  }

  deleteCommunityPost(id: string, postId: string): Observable<void> {
    return this.api.delete<void>(`/admin/communities/${id}/posts/${postId}`);
  }

  getUser(id: string): Observable<AdminUser> {
    return this.api.get<AdminUser>(`/admin/users/${id}`);
  }

  banUser(id: string, reason: string): Observable<AdminUser> {
    return this.api.post<AdminUser>(`/admin/users/${id}/ban`, { reason });
  }

  unbanUser(id: string): Observable<AdminUser> {
    return this.api.post<AdminUser>(`/admin/users/${id}/unban`, {});
  }

  toggleUserRole(id: string): Observable<AdminUser> {
    return this.api.patch<AdminUser>(`/admin/users/${id}/role`, {});
  }

  // --- Missing Data ---

  getMissingData(
    params: MissingDataSearchParams = {},
  ): Observable<PaginatedResponse<CyclingEvent & { missingFields: string[] }>> {
    return this.api.get(
      '/admin/events/missing-data',
      params as Record<string, string | number | boolean>,
    );
  }

  getDuplicateGroups(
    params: { page?: number; limit?: number; includePast?: boolean } = {},
  ): Observable<{ data: DuplicateGroup[]; total: number }> {
    return this.api.get('/admin/events/duplicates', params as Record<string, string | number | boolean>);
  }

  ignoreDuplicates(eventIds: string[]): Observable<void> {
    return this.api.post<void>('/admin/events/duplicates/ignore', { eventIds });
  }

  getMissingAtSource(
    params: { page?: number; limit?: number } = {},
  ): Observable<PaginatedResponse<MissingAtSourceEvent>> {
    return this.api.get('/admin/events/missing-source', params as Record<string, string | number | boolean>);
  }

  getMissingDataStats(): Observable<Record<string, number>> {
    return this.api.get<Record<string, number>>('/admin/events/missing-data/stats');
  }

  // --- Analytics ---

  getTopPages(days = 30, limit = 20): Observable<{ path: string; views: number }[]> {
    return this.api.get<{ path: string; views: number }[]>('/admin/analytics/top-pages', {
      days,
      limit,
    });
  }

  getAnalyticsOverview(days = 30): Observable<AnalyticsOverview> {
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
