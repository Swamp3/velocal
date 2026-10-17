import { buildPushMessage, categoryOf } from './push-messages';
import { mergePreferences } from './push.service';

describe('push messages', () => {
  it('maps notification types to categories', () => {
    expect(categoryOf('event.invite')).toBe('invites');
    expect(categoryOf('join.request')).toBe('membership');
    expect(categoryOf('join.decision')).toBe('membership');
    expect(categoryOf('event.created')).toBe('events');
    expect(categoryOf('community.suspended')).toBe('community');
    expect(categoryOf('post.created')).toBe('posts');
    expect(categoryOf('post.comment')).toBe('comments');
  });

  it('links a post notification to the post, also inside a subgroup', () => {
    const club = {
      communityName: 'Club',
      communitySlug: 'club',
      postId: 'p1',
      postTitle: 'Training',
      actorName: 'Anna',
    };
    const inClub = buildPushMessage('post.created', club, 'de');
    expect(inClub.url).toBe('/communities/club/posts/p1');
    expect(inClub.body).toBe('Anna: Neuer Beitrag – Training');
    const inGroup = buildPushMessage(
      'post.comment',
      { ...club, subgroupName: 'Gravel', subgroupSlug: 'gravel' },
      'en',
    );
    expect(inGroup.url).toBe('/communities/club/subgroups/gravel/posts/p1');
    expect(inGroup.body).toBe('Anna commented');
    expect(inGroup.tag).toBe('comment-p1');
  });

  it('builds a German invite with an event link', () => {
    const msg = buildPushMessage(
      'event.invite',
      {
        communityName: 'C',
        communitySlug: 'c',
        eventId: 'e/1',
        eventName: 'Ride',
      },
      'de',
    );
    expect(msg.body).toBe('Du bist zu Ride eingeladen');
    expect(msg.url).toBe('/events/e%2F1');
  });

  it('sends deletion notices to the inbox because the community is gone', () => {
    const msg = buildPushMessage(
      'community.deleted',
      { communityName: 'C', communitySlug: '' },
      'en',
    );
    expect(msg.url).toBe('/notifications');
  });

  it('merges stored preferences over the defaults', () => {
    expect(mergePreferences(null)).toEqual({
      invites: true,
      membership: true,
      events: false,
      posts: false,
      comments: true,
      community: true,
    });
    expect(mergePreferences({ events: true, invites: false })).toMatchObject({
      events: true,
      invites: false,
      membership: true,
    });
  });
});
