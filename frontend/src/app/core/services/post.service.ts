import { inject, Injectable } from '@angular/core';
import {
  CreatePostDto,
  PaginatedResponse,
  Post,
  PostListItem,
  UpdatePostDto,
} from '@shared/models';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PostSearchParams {
  q?: string;
  tag?: string;
  eventId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly api = inject(ApiService);

  getPosts(params: PostSearchParams = {}): Observable<PaginatedResponse<PostListItem>> {
    return this.api.get('/posts', params as Record<string, string | number | boolean>);
  }

  getPost(slug: string): Observable<Post> {
    return this.api.get(`/posts/${slug}`);
  }

  getTags(): Observable<string[]> {
    return this.api.get('/posts/tags');
  }

  createPost(dto: CreatePostDto): Observable<Post> {
    return this.api.post('/posts', dto);
  }

  updatePost(id: string, dto: UpdatePostDto): Observable<Post> {
    return this.api.patch(`/posts/${id}`, dto);
  }

  deletePost(id: string): Observable<void> {
    return this.api.delete(`/posts/${id}`);
  }
}
