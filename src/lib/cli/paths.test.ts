import { describe, expect, it } from 'vitest';
import { isExcluded } from './paths';

describe('isExcluded', () => {
  it('skips files inside excluded directories', () => {
    expect(isExcluded('node_modules/foo/README.md')).toBe(true);
    expect(isExcluded('a/b/node_modules/c/d.md')).toBe(true);
    expect(isExcluded('.git/COMMIT_EDITMSG')).toBe(true);
  });

  it('keeps ordinary project files', () => {
    expect(isExcluded('docs/architecture.md')).toBe(false);
    expect(isExcluded('README.md')).toBe(false);
  });

  it('matches whole path segments, not substrings', () => {
    // A real doc about node_modules must not be skipped.
    expect(isExcluded('docs/node_modules_guide.md')).toBe(false);
    expect(isExcluded('src/distribution/notes.md')).toBe(false);
  });

  it('handles Windows separators', () => {
    expect(isExcluded('a\\node_modules\\b.md')).toBe(true);
  });

  it('honours a custom exclude list', () => {
    expect(isExcluded('docs/x.md', ['docs'])).toBe(true);
    expect(isExcluded('node_modules/x.md', ['docs'])).toBe(false);
  });
});
