/**
 * Who gets a comment notification: the people who took part in the thread and can still see it
 * (`audience`), once each, and never the commenter.
 */
export function commentRecipients(
  participants: string[],
  audience: string[],
  actorId: string,
): string[] {
  const allowed = new Set(audience);
  return [...new Set(participants)].filter(
    (id) => id !== actorId && allowed.has(id),
  );
}
