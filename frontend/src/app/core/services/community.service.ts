import { inject, Injectable } from '@angular/core';
import {
  Community,
  CommunityComment,
  CommunityJoinRequest,
  CommunityPost,
  CommunityMember,
  CommunityRole,
  CreateCommunityDto,
  JoinCommunityResult,
  JoinSubgroupResult,
  PaginatedResponse,
  Subgroup,
  SubgroupMember,
  SubgroupRole,
  SubgroupVisibility,
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

  invite(id: string, email: string): Observable<Community> {
    return this.api.post(`/communities/${id}/invites`, { email });
  }

  listSubgroups(communitySlug: string): Observable<Subgroup[]> {
    return this.api.get(`/communities/${communitySlug}/subgroups`);
  }

  getSubgroup(communitySlug: string, slug: string): Observable<Subgroup> {
    return this.api.get(`/communities/${communitySlug}/subgroups/${slug}`);
  }

  createSubgroup(
    communitySlug: string,
    dto: { name: string; description?: string; visibility?: SubgroupVisibility },
  ): Observable<Subgroup> {
    return this.api.post(`/communities/${communitySlug}/subgroups`, dto);
  }

  updateSubgroup(
    communitySlug: string,
    slug: string,
    dto: { name?: string; description?: string | null; visibility?: SubgroupVisibility },
  ): Observable<Subgroup> {
    return this.api.patch(`/communities/${communitySlug}/subgroups/${slug}`, dto);
  }

  joinSubgroup(communitySlug: string, slug: string): Observable<JoinSubgroupResult> {
    return this.api.post(`/communities/${communitySlug}/subgroups/${slug}/join`, {});
  }

  leaveSubgroup(communitySlug: string, slug: string): Observable<void> {
    return this.api.post(`/communities/${communitySlug}/subgroups/${slug}/leave`, {});
  }

  subgroupMembers(communitySlug: string, slug: string): Observable<SubgroupMember[]> {
    return this.api.get(`/communities/${communitySlug}/subgroups/${slug}/members`);
  }

  updateSubgroupRole(
    communitySlug: string,
    slug: string,
    userId: string,
    role: SubgroupRole,
  ): Observable<unknown> {
    return this.api.patch(`/communities/${communitySlug}/subgroups/${slug}/members/${userId}`, {
      role,
    });
  }

  removeSubgroupMember(communitySlug: string, slug: string, userId: string): Observable<void> {
    return this.api.delete(`/communities/${communitySlug}/subgroups/${slug}/members/${userId}`);
  }

  subgroupJoinRequests(communitySlug: string, slug: string): Observable<CommunityJoinRequest[]> {
    return this.api.get(`/communities/${communitySlug}/subgroups/${slug}/join-requests`);
  }

  approveSubgroupRequest(
    communitySlug: string,
    slug: string,
    requestId: string,
  ): Observable<{ status: 'approved' }> {
    return this.api.post(
      `/communities/${communitySlug}/subgroups/${slug}/join-requests/${requestId}/approve`,
      {},
    );
  }

  rejectSubgroupRequest(
    communitySlug: string,
    slug: string,
    requestId: string,
  ): Observable<{ status: 'rejected' }> {
    return this.api.post(
      `/communities/${communitySlug}/subgroups/${slug}/join-requests/${requestId}/reject`,
      {},
    );
  }

  inviteToSubgroup(communitySlug: string, slug: string, email: string): Observable<Subgroup> {
    return this.api.post(`/communities/${communitySlug}/subgroups/${slug}/invites`, { email });
  }

  listPosts(communitySlug: string, subgroupSlug?: string | null): Observable<CommunityPost[]> {
    return this.api.get(this.postsPath(communitySlug, subgroupSlug));
  }

  createPost(
    communitySlug: string,
    body: string,
    subgroupSlug?: string | null,
  ): Observable<CommunityPost> {
    return this.api.post(this.postsPath(communitySlug, subgroupSlug), { body });
  }

  getPost(
    communitySlug: string,
    postId: string,
    subgroupSlug?: string | null,
  ): Observable<CommunityPost> {
    return this.api.get(`${this.postsPath(communitySlug, subgroupSlug)}/${postId}`);
  }

  deletePost(
    communitySlug: string,
    postId: string,
    subgroupSlug?: string | null,
  ): Observable<void> {
    return this.api.delete(`${this.postsPath(communitySlug, subgroupSlug)}/${postId}`);
  }

  listComments(
    communitySlug: string,
    postId: string,
    subgroupSlug?: string | null,
  ): Observable<CommunityComment[]> {
    return this.api.get(`${this.postsPath(communitySlug, subgroupSlug)}/${postId}/comments`);
  }

  addComment(
    communitySlug: string,
    postId: string,
    body: string,
    subgroupSlug?: string | null,
  ): Observable<CommunityComment> {
    return this.api.post(`${this.postsPath(communitySlug, subgroupSlug)}/${postId}/comments`, {
      body,
    });
  }

  deleteComment(
    communitySlug: string,
    postId: string,
    commentId: string,
    subgroupSlug?: string | null,
  ): Observable<void> {
    return this.api.delete(
      `${this.postsPath(communitySlug, subgroupSlug)}/${postId}/comments/${commentId}`,
    );
  }

  private postsPath(communitySlug: string, subgroupSlug?: string | null): string {
    const base = `/communities/${communitySlug}`;
    return subgroupSlug ? `${base}/subgroups/${subgroupSlug}/posts` : `${base}/posts`;
  }
}
