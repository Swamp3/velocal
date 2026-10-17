import { commentRecipients } from './comment-recipients';

describe('comment recipients', () => {
  it('notifies the author and earlier commenters once, never the commenter', () => {
    expect(
      commentRecipients(
        ['author', 'anna', 'ben', 'anna', 'me'],
        ['author', 'anna', 'ben', 'me'],
        'me',
      ),
    ).toEqual(['author', 'anna', 'ben']);
  });

  it('skips people who can no longer see the post', () => {
    expect(commentRecipients(['author', 'gone'], ['author'], 'me')).toEqual([
      'author',
    ]);
  });

  it('is empty when only the commenter took part', () => {
    expect(commentRecipients(['me'], ['me'], 'me')).toEqual([]);
  });
});
