export type CommunityVisibility = 'public' | 'request' | 'private';

export type CommunityRole = 'member' | 'admin';

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CommunityVisibility;
  heroUrl: string | null;
  logoUrl: string | null;
  memberCount: number;
  myRole: CommunityRole | null;
  myJoinRequest: 'pending' | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMember {
  userId: string;
  displayName: string | null;
  role: CommunityRole;
  joinedAt: string;
}

export interface CommunityJoinRequest {
  id: string;
  userId: string;
  displayName: string | null;
  createdAt: string;
}

export interface CreateCommunityDto {
  name: string;
  description?: string;
  visibility?: CommunityVisibility;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string | null;
  visibility?: CommunityVisibility;
}

export type JoinCommunityResult =
  | { outcome: 'joined'; community: Community }
  | { outcome: 'pending' };

/** Up to two initials for a logo fallback. */
export function communityInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1] ?? '';
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

/** Badge color for a community visibility value. */
export function communityVisibilityVariant(
  visibility: CommunityVisibility,
): 'success' | 'warning' | 'neutral' {
  if (visibility === 'public') return 'success';
  if (visibility === 'request') return 'warning';
  return 'neutral';
}
