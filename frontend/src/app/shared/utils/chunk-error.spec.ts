import { isChunkLoadError } from './chunk-error';

describe('isChunkLoadError', () => {
  it("recognises the browsers' messages for a failed dynamic import", () => {
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: https://x/chunk-ABC.js'),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(
      isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js')),
    ).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('Cannot match any routes'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({ message: 'x' })).toBe(false);
  });
});
