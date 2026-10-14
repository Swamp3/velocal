import { inject, Injectable } from '@angular/core';
import {
  Community,
  CommunityJoinRequest,
  CommunityMember,
  CommunityRole,
  CreateCommunityDto,
  JoinCommunityResult,
  PaginatedResponse,
  UpdateCommunityDto,
} from '@shared/models';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CommunitySearchParams {
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly api = inject(ApiService);

  /** Public and request-to-join communities. Private communities are omitted. */
  list(params: CommunitySearchParams = {}): Observable<PaginatedResponse<Community>> {
    return this.api.get('/communities', params as Record<string, string | number | boolean>);
  }

  mine(): Observable<Community[]> {
    return this.api.get('/communities/mine');
  }

  getBySlug(slug: string): Observable<Community> {
    return this.api.get(`/communities/${slug}`);
  }

  create(dto: CreateCommunityDto): Observable<Community> {
    return this.api.post('/communities', dto);
  }

  update(id: string, dto: UpdateCommunityDto): Observable<Community> {
    return this.api.patch(`/communities/${id}`, dto);
  }

  join(id: string): Observable<JoinCommunityResult> {
    return this.api.post(`/communities/${id}/join`, {});
  }

  /** 204 No Content. */
  leave(id: string): Observable<void> {
    return this.api.post(`/communities/${id}/leave`, {});
  }

  members(id: string): Observable<CommunityMember[]> {
    return this.api.get(`/communities/${id}/members`);
  }

  /**
   * Role change. The body is ignored — callers refetch members.
   * Last-admin changes fail with 409.
   */
  updateMemberRole(id: string, userId: string, role: CommunityRole): Observable<unknown> {
    return this.api.patch(`/communities/${id}/members/${userId}`, { role });
  }

  /** 204 No Content. Last-admin removal fails with 409. */
  removeMember(id: string, userId: string): Observable<void> {
    return this.api.delete(`/communities/${id}/members/${userId}`);
  }

  joinRequests(id: string): Observable<CommunityJoinRequest[]> {
    return this.api.get(`/communities/${id}/join-requests`);
  }

  approveRequest(id: string, requestId: string): Observable<{ status: 'approved' }> {
    return this.api.post(`/communities/${id}/join-requests/${requestId}/approve`, {});
  }

  rejectRequest(id: string, requestId: string): Observable<{ status: 'rejected' }> {
    return this.api.post(`/communities/${id}/join-requests/${requestId}/reject`, {});
  }
}
