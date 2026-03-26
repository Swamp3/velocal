export interface Post {
  id: string;
  title: string;
  body: string;
  slug: string;
  author: { id: string; displayName: string };
  event?: { id: string; name: string; startDate: string };
  status: PostStatus;
  isPinned: boolean;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
}

export interface PostListItem extends Omit<Post, 'body'> {
  excerpt: string;
}

export type PostStatus = 'draft' | 'published' | 'archived';

export interface CreatePostDto {
  title: string;
  body: string;
  eventId?: string;
  status?: PostStatus;
  isPinned?: boolean;
  tags?: string[];
}

export type UpdatePostDto = Partial<CreatePostDto>;
