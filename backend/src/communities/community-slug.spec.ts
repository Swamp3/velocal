import {
  pickSlug,
  RESERVED_COMMUNITY_SLUGS,
  RESERVED_SUBGROUP_SLUGS,
  slugBase,
} from './community-slug';

describe('slugBase', () => {
  it('transliterates German characters and drops punctuation', () => {
    expect(slugBase('Größe & Übung', 'community')).toBe('groesse-uebung');
  });

  it('drops other accents instead of cutting the word', () => {
    expect(slugBase('Rokkā', 'community')).toBe('rokka');
    expect(slugBase('Café Évian Çà', 'community')).toBe('cafe-evian-ca');
  });

  it('uses the fallback when the name has no slug characters', () => {
    expect(slugBase('!!!', 'community')).toBe('community');
    expect(slugBase('   ', 'group')).toBe('group');
  });
});

describe('pickSlug', () => {
  it('skips community route slugs', () => {
    expect(pickSlug('mine', RESERVED_COMMUNITY_SLUGS, new Set())).toBe(
      'mine-2',
    );
    expect(pickSlug('new', RESERVED_COMMUNITY_SLUGS, new Set())).toBe('new-2');
  });

  it('skips the subgroup create route', () => {
    expect(pickSlug('new', RESERVED_SUBGROUP_SLUGS, new Set())).toBe('new-2');
  });

  it('keeps walking past taken suffixes', () => {
    expect(
      pickSlug(
        'rheinradler',
        new Set(),
        new Set(['rheinradler', 'rheinradler-2']),
      ),
    ).toBe('rheinradler-3');
  });
});
