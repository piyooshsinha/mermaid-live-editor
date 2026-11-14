/**
 * Ranking for the command palette.
 *
 * A palette lives or dies on whether the thing you want is the first hit, so
 * matching is subsequence-based (typing "exsvg" finds "Export SVG") but scored
 * so that better-shaped matches win: a prefix beats a word start, a word start
 * beats a letter buried mid-word, and contiguous runs beat scattered letters.
 *
 * Pure and synchronous — it runs on every keystroke over the whole registry.
 */

export interface Searchable {
  /** Extra terms that should match but are not shown, e.g. "dark" for a theme. */
  keywords?: readonly string[];
  /** Shown under the title; also searched, at lower weight. */
  subtitle?: string;
  title: string;
}

export interface Ranked<T> {
  item: T;
  /** Indices into the lowercased title that matched, for highlighting. */
  matches: number[];
  score: number;
}

const WORD_BOUNDARY = /[\s\-_/.]/;

/**
 * Scores one subsequence match, returning undefined when the query does not
 * fit at all. Higher is better.
 */
const scoreOne = (
  text: string,
  query: string
): { matches: number[]; score: number } | undefined => {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  if (needle.length === 0) {
    return { matches: [], score: 0 };
  }

  const matches: number[] = [];
  let score = 0;
  let cursor = 0;
  let previousIndex = -2;

  for (const character of needle) {
    const found = haystack.indexOf(character, cursor);
    if (found === -1) {
      return undefined;
    }
    matches.push(found);

    // Contiguous with the previous match: the strongest signal of intent.
    if (found === previousIndex + 1) {
      score += 8;
    }
    // Start of the string, or of a word within it.
    if (found === 0) {
      score += 12;
    } else if (WORD_BOUNDARY.test(haystack[found - 1])) {
      score += 6;
    }
    // Later matches are weaker, so "ex" prefers "Export" over "Index".
    score -= Math.min(found, 20) * 0.1;

    previousIndex = found;
    cursor = found + 1;
  }

  // A whole-substring hit is unambiguous; make sure it outranks a scatter.
  if (haystack.includes(needle)) {
    score += 25;
    if (haystack.startsWith(needle)) {
      score += 20;
    }
  }
  // Shorter titles are more likely to be the thing meant by a short query.
  score -= haystack.length * 0.05;

  return { matches, score };
};

/**
 * Ranks items against a query. An empty query returns everything in registry
 * order, which is what makes the palette useful before you type anything.
 */
export const rank = <T extends Searchable>(items: readonly T[], query: string): Ranked<T>[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return items.map((item) => ({ item, matches: [], score: 0 }));
  }

  const results: Ranked<T>[] = [];
  for (const item of items) {
    const title = scoreOne(item.title, trimmed);
    // Subtitle and keyword hits count, but never outrank a title hit.
    const subtitle = item.subtitle ? scoreOne(item.subtitle, trimmed) : undefined;
    const keyword = item.keywords
      ?.map((word) => scoreOne(word, trimmed))
      .filter((hit) => hit !== undefined)
      .sort((a, b) => b.score - a.score)[0];

    // Non-title hits are scaled down rather than offset by a constant. A flat
    // penalty let a perfect keyword match outscore a genuine title match —
    // searching "sketch" surfaced the preset that merely has "sketch" as a
    // keyword above the one actually called Sketch. Scaling keeps a weaker
    // field from ever overtaking the name the user is reading.
    const best = title
      ? { matches: title.matches, score: title.score }
      : subtitle
        ? { matches: [], score: subtitle.score * 0.35 }
        : keyword
          ? { matches: [], score: keyword.score * 0.4 }
          : undefined;

    if (best) {
      results.push({ item, matches: best.matches, score: best.score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
};
