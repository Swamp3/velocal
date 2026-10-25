import { categoryForAge, parseCategory } from './categories';

describe('rider categories', () => {
  it('assigns the category by age in the year', () => {
    expect(categoryForAge(8).key).toBe('u9');
    expect(categoryForAge(5).key).toBe('u7');
    expect(categoryForAge(10).key).toBe('u11');
    expect(categoryForAge(14).key).toBe('u15');
    expect(categoryForAge(18).key).toBe('u19');
    expect(categoryForAge(22).key).toBe('u23');
    expect(categoryForAge(29).key).toBe('elite');
    expect(categoryForAge(30).key).toBe('masters1');
    expect(categoryForAge(45).key).toBe('masters2');
    expect(categoryForAge(71).key).toBe('masters4');
  });

  it('reads the usual names', () => {
    expect(parseCategory('U15')).toBe('u15');
    expect(parseCategory('Junioren')).toBe('u19');
    expect(parseCategory('Masters 2')).toBe('masters2');
    expect(parseCategory('M3')).toBe('masters3');
    expect(parseCategory('Hobby')).toBeNull();
  });
});
