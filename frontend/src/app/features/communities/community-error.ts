import { ApiError } from '@core/services/api.service';

const ERROR_KEYS: Record<string, string> = {
  'community.lastAdminDemotion': 'communities.errors.lastAdminDemotion',
  'community.lastAdminRemoval': 'communities.errors.lastAdminRemoval',
  'community.userNotFound': 'communities.errors.userNotFound',
  'community.notCommunityMember': 'communities.errors.notCommunityMember',
};

/** Translation key for a community API error. Never the server's English string. */
export function communityErrorKey(err: ApiError): string {
  const code = err.body?.['code'];
  if (typeof code === 'string' && ERROR_KEYS[code]) {
    return ERROR_KEYS[code];
  }
  return 'communities.errors.generic';
}
