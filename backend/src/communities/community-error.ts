import { ConflictException } from '@nestjs/common';

export const CommunityErrorCode = {
  lastAdminDemotion: 'community.lastAdminDemotion',
  lastAdminRemoval: 'community.lastAdminRemoval',
  userNotFound: 'community.userNotFound',
  notCommunityMember: 'community.notCommunityMember',
} as const;

export type CommunityErrorCode =
  (typeof CommunityErrorCode)[keyof typeof CommunityErrorCode];

/** Stable `code` for the client to translate. `message` stays the code too. */
export function communityConflict(code: CommunityErrorCode): ConflictException {
  return new ConflictException({ code, message: code });
}
