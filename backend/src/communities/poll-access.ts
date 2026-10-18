import { CommunityVisibility } from './entities/community.entity';
import { SubgroupVisibility } from './entities/subgroup.entity';

/**
 * Whether a poll may be set to "public" (readable without being a member): only where the club
 * itself is not private and, for a subgroup poll, the subgroup is not invite-only. The check is
 * repeated whenever a public poll is read, so a club that turns private closes its polls again.
 */
export function canBePublic(
  community: CommunityVisibility,
  subgroup: SubgroupVisibility | null,
): boolean {
  if (community === CommunityVisibility.PRIVATE) return false;
  if (subgroup === SubgroupVisibility.INVITE) return false;
  return true;
}

/** Share of one option among the people who voted, rounded to a whole percent. */
export function pollPercent(votes: number, voters: number): number {
  if (voters <= 0) return 0;
  return Math.round((votes / voters) * 100);
}
