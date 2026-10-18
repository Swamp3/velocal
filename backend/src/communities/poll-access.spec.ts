import { canBePublic, pollPercent } from './poll-access';
import { CommunityVisibility } from './entities/community.entity';
import { SubgroupVisibility } from './entities/subgroup.entity';

describe('poll access', () => {
  it('allows public polls only where the host is publicly visible', () => {
    expect(canBePublic(CommunityVisibility.PUBLIC, null)).toBe(true);
    expect(canBePublic(CommunityVisibility.REQUEST, null)).toBe(true);
    expect(canBePublic(CommunityVisibility.PRIVATE, null)).toBe(false);
    expect(
      canBePublic(CommunityVisibility.PUBLIC, SubgroupVisibility.OPEN),
    ).toBe(true);
    expect(
      canBePublic(CommunityVisibility.PUBLIC, SubgroupVisibility.INVITE),
    ).toBe(false);
  });

  it('computes percentages of voters', () => {
    expect(pollPercent(0, 0)).toBe(0);
    expect(pollPercent(1, 3)).toBe(33);
    expect(pollPercent(2, 3)).toBe(67);
    expect(pollPercent(5, 5)).toBe(100);
  });
});
