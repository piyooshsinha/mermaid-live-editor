import { describe, expect, it } from 'vitest';
import { rank, type Searchable } from './search';

const items: Searchable[] = [
  { title: 'Export SVG' },
  { title: 'Export PNG' },
  { title: 'Export as PDF' },
  { title: 'Style: Sketch', subtitle: 'Hand-drawn, like a whiteboard' },
  { title: 'Style: Terminal' },
  { title: 'Toggle dark mode', keywords: ['theme', 'light'] },
  { title: 'Save diagram' }
];

const titles = (query: string) => rank(items, query).map((hit) => hit.item.title);

describe('rank', () => {
  it('returns everything in registry order for an empty query', () => {
    expect(titles('')).toEqual(items.map((item) => item.title));
    expect(titles('   ')).toHaveLength(items.length);
  });

  it('matches a subsequence across words', () => {
    // "exsvg" should still find "Export SVG".
    expect(titles('exsvg')[0]).toBe('Export SVG');
  });

  it('ranks a whole-substring hit above a scattered one', () => {
    // "sketch" is contiguous in one title and scattered at best elsewhere.
    expect(titles('sketch')[0]).toBe('Style: Sketch');
  });

  it('prefers a prefix match', () => {
    expect(titles('save')[0]).toBe('Save diagram');
  });

  it('drops items the query cannot match at all', () => {
    expect(titles('zzzz')).toEqual([]);
  });

  it('finds items by subtitle when the title does not match', () => {
    expect(titles('whiteboard')).toContain('Style: Sketch');
  });

  it('finds items by hidden keyword', () => {
    // "theme" appears in no title.
    expect(titles('theme')).toContain('Toggle dark mode');
  });

  it('ranks a title hit above a perfect keyword match elsewhere', () => {
    // Regression: "sketch" used to surface the item that merely keywords
    // "sketch" above the item actually named Sketch.
    const ranked = rank(
      [
        { title: 'Style: Notebook', keywords: ['sketch', 'theme'] },
        { title: 'Style: Sketch', keywords: ['sketch', 'theme'] }
      ],
      'sketch'
    );
    expect(ranked[0].item.title).toBe('Style: Sketch');
  });

  it('ranks a title hit above a subtitle hit for the same query', () => {
    const ordered = titles('style');
    expect(ordered[0].startsWith('Style:')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(titles('EXPORT').length).toBeGreaterThan(0);
    expect(titles('ExPoRt')[0].startsWith('Export')).toBe(true);
  });

  it('reports the matched title positions for highlighting', () => {
    const [hit] = rank([{ title: 'Export SVG' }], 'svg');
    expect(hit.matches.map((index) => 'Export SVG'.toLowerCase()[index]).join('')).toBe('svg');
  });
});
