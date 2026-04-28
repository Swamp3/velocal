import { BadWordService } from './bad-word.service';

describe('BadWordService', () => {
  let service: BadWordService;

  beforeEach(() => {
    service = new BadWordService();
  });

  describe('checkFields', () => {
    it('should return clean for innocuous text', () => {
      const result = service.checkFields(
        { name: 'Sunday Morning Ride', description: 'A fun cycling event' },
        ['name', 'description'],
      );
      expect(result.clean).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect a bad word (case-insensitive)', () => {
      const result = service.checkFields(
        { name: 'What the FUCK' },
        ['name'],
      );
      expect(result.clean).toBe(false);
      expect(result.violations).toEqual([{ field: 'name' }]);
    });

    it('should detect German profanity', () => {
      const result = service.checkFields(
        { description: 'Du bist ein Arschloch' },
        ['description'],
      );
      expect(result.clean).toBe(false);
      expect(result.violations).toEqual([{ field: 'description' }]);
    });

    it('should detect a bad phrase', () => {
      const result = service.checkFields(
        { name: 'Fick dich event' },
        ['name'],
      );
      expect(result.clean).toBe(false);
    });

    it('should use word boundaries to avoid false positives', () => {
      const result = service.checkFields(
        { name: 'Scunthorpe Cycling Classic', description: 'A class event' },
        ['name', 'description'],
      );
      expect(result.clean).toBe(true);
    });

    it('should skip non-string or empty fields', () => {
      const result = service.checkFields(
        { name: '', description: undefined as unknown as string, count: 42 },
        ['name', 'description', 'count', 'missing'],
      );
      expect(result.clean).toBe(true);
    });

    it('should report multiple violating fields', () => {
      const result = service.checkFields(
        { name: 'Shit race', locationName: 'Arschloch Straße' },
        ['name', 'locationName'],
      );
      expect(result.clean).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations.map((v) => v.field)).toEqual([
        'name',
        'locationName',
      ]);
    });

    it('should strip zero-width characters before checking', () => {
      const result = service.checkFields(
        { name: 'f\u200Bu\u200Bc\u200Bk' },
        ['name'],
      );
      expect(result.clean).toBe(false);
    });

    it('should only check requested fields', () => {
      const result = service.checkFields(
        { name: 'Nice event', description: 'This is shit' },
        ['name'],
      );
      expect(result.clean).toBe(true);
    });
  });
});
