/**
 * True when this membership change would leave the community without an admin.
 * `adminCount` includes the member when their role is admin.
 */
export function isLastAdminRemoval(
  role: 'member' | 'admin',
  adminCount: number,
): boolean {
  return role === 'admin' && adminCount <= 1;
}
