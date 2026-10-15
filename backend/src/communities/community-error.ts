import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export const CommunityErrorCode = {
  lastAdminDemotion: 'community.lastAdminDemotion',
  lastAdminRemoval: 'community.lastAdminRemoval',
  userNotFound: 'community.userNotFound',
  notCommunityMember: 'community.notCommunityMember',
  inviteOnly: 'community.inviteOnly',
  membersOnly: 'community.membersOnly',
  pollClosed: 'community.pollClosed',
  suspended: 'community.suspended',
  alreadyReported: 'community.alreadyReported',
} as const;

export type CommunityErrorCode =
  (typeof CommunityErrorCode)[keyof typeof CommunityErrorCode];

/** Stable `code` for the client to translate. `message` stays the code too. */
export function communityConflict(code: CommunityErrorCode): ConflictException {
  return new ConflictException({ code, message: code });
}

export function communityForbidden(
  code: CommunityErrorCode,
): ForbiddenException {
  return new ForbiddenException({ code, message: code });
}

export function communityNotFound(code: CommunityErrorCode): NotFoundException {
  return new NotFoundException({ code, message: code });
}

/** Blocks every read and write inside a community that a site admin suspended. */
export function assertCommunityActive(community: {
  suspendedAt?: Date | null;
}): void {
  if (community.suspendedAt) {
    throw communityForbidden(CommunityErrorCode.suspended);
  }
}
