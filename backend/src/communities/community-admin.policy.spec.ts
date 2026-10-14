import { isLastAdminRemoval } from './community-admin.policy';

describe('isLastAdminRemoval', () => {
  it('returns false for a member when one admin exists', () => {
    expect(isLastAdminRemoval('member', 1)).toBe(false);
  });

  it('returns false for an admin when two admins exist', () => {
    expect(isLastAdminRemoval('admin', 2)).toBe(false);
  });

  it('returns true for an admin when they are the only admin', () => {
    expect(isLastAdminRemoval('admin', 1)).toBe(true);
  });

  it('returns true for an admin when the admin count is zero', () => {
    expect(isLastAdminRemoval('admin', 0)).toBe(true);
  });
});
