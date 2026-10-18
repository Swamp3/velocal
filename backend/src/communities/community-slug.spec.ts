import {
  pickSlug,
  planSlugReplace,
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

describe('planSlugReplace', () => {
  const reserved = new Set(['mine', 'new']);
  const items = [
    { id: '1', scope: 'c', slug: 'rokk-cycling' },
    { id: '2', scope: 'c', slug: 'other' },
  ];
  const taken = new Map([['c', new Set(['rokk-cycling', 'other'])]]);

  it('replaces the text in matching slugs only', () => {
    expect(planSlugReplace(items, 'rokk', 'rokka', reserved, taken)).toEqual([
      {
        id: '1',
        scope: 'c',
        slug: 'rokk-cycling',
        newSlug: 'rokka-cycling',
        problem: null,
      },
    ]);
  });

  it('flags invalid, reserved and taken results', () => {
    expect(
      planSlugReplace(items, 'rokk-', 'Ä ', reserved, taken)[0].problem,
    ).toBe('invalid');
    expect(
      planSlugReplace(items, 'rokk-cycling', 'new', reserved, taken)[0].problem,
    ).toBe('reserved');
    expect(
      planSlugReplace(items, 'rokk-cycling', 'other', reserved, taken)[0]
        .problem,
    ).toBe('taken');
  });

  it('flags two items that would end up with the same slug', () => {
    const both = [
      { id: '1', scope: 'c', slug: 'a-x' },
      { id: '2', scope: 'c', slug: 'a-y' },
    ];
    const plan = planSlugReplace(
      both,
      'a-',
      'b',
      reserved,
      new Map([['c', new Set(['a-x', 'a-y'])]]),
    );
    expect(plan.map((p) => p.problem)).toEqual([null, null]);
    const same = planSlugReplace(
      [
        { id: '1', scope: 'c', slug: 'a-x' },
        { id: '2', scope: 'c', slug: 'b-x' },
      ],
      'a-',
      'b-',
      reserved,
      new Map([['c', new Set(['a-x', 'b-x'])]]),
    );
    expect(same[0].problem).toBe('taken');
  });

  it('treats the same slug in different scopes as free', () => {
    const plan = planSlugReplace(
      [{ id: '1', scope: 'c1', slug: 'a-x' }],
      'a-',
      'b-',
      reserved,
      new Map([['c2', new Set(['b-x'])]]),
    );
    expect(plan[0].problem).toBeNull();
  });
});
