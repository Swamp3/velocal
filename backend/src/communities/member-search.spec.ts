import { likePattern } from './member-search';

describe('likePattern', () => {
  it('wraps the text for a contains search', () => {
    expect(likePattern('max')).toBe('%max%');
  });

  it('does not let users inject wildcards', () => {
    expect(likePattern('100%_a\\b')).toBe('%100\\%\\_a\\\\b%');
  });
});
