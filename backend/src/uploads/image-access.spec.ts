import {
  imageAccessMatches,
  imageAccessToken,
  signImageUrl,
} from './image-access';

const secret = 'test-secret';

describe('signImageUrl', () => {
  it('leaves public urls unchanged', () => {
    const url = '/api/uploads/community-heroes/abc/hero.webp?v=1';
    expect(signImageUrl(url, false, secret)).toBe(url);
    expect(signImageUrl(null, true, secret)).toBeNull();
  });

  it('appends a token that matches the subject and id, not the variant', () => {
    const signed = signImageUrl(
      '/api/uploads/community-heroes/abc/hero.webp?v=1',
      true,
      secret,
    );
    expect(signed).toContain('access=');
    const token = new URL(signed ?? '', 'http://localhost').searchParams.get(
      'access',
    );
    expect(
      imageAccessMatches('community-heroes', 'abc', token ?? undefined, secret),
    ).toBe(true);
    expect(
      imageAccessMatches(
        'community-heroes',
        'other',
        token ?? undefined,
        secret,
      ),
    ).toBe(false);
    expect(imageAccessToken('community-heroes', 'abc', secret)).toBe(token);
  });
});
