/**
 * Finds the Mermaid sources inside a file.
 *
 * A `.mmd` file is one diagram; a Markdown file may hold several in fenced
 * blocks. Both are reduced to the same shape so the validator does not care
 * which it was handed.
 *
 * Every block records the file line it starts on. That is what lets a parser
 * error inside a README point at the right line of the README rather than at
 * line 3 of an anonymous snippet — which is the difference between a CI failure
 * you can act on and one you have to go hunting for.
 */

export interface DiagramBlock {
  code: string;
  /** 1-based line in the file where the diagram's first line sits. */
  startLine: number;
}

/** Fence openers we treat as Mermaid, e.g. ```mermaid or ~~~mermaid */
const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})\s*mermaid\b/i;

/**
 * Extracts fenced Mermaid blocks from Markdown.
 *
 * The closing fence must use the same character and be at least as long as the
 * opener, per CommonMark, so a block containing a shorter fence is not cut off
 * early.
 */
export const extractFromMarkdown = (source: string): DiagramBlock[] => {
  const lines = source.split('\n');
  const blocks: DiagramBlock[] = [];

  for (let index = 0; index < lines.length; index++) {
    const open = FENCE_OPEN.exec(lines[index]);
    if (!open) {
      continue;
    }
    const marker = open[2];
    const closer = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`);
    const start = index + 1;
    const body: string[] = [];

    let cursor = start;
    while (cursor < lines.length && !closer.test(lines[cursor])) {
      body.push(lines[cursor]);
      cursor++;
    }

    // An unterminated fence is a Markdown problem, not a diagram one; take
    // what is there so the diagram still gets checked.
    if (body.length > 0) {
      blocks.push({ code: body.join('\n'), startLine: start + 1 });
    }
    index = cursor;
  }

  return blocks;
};

/** Whether a path should be read as Markdown rather than as a bare diagram. */
export const isMarkdown = (path: string): boolean => /\.(md|markdown|mdx)$/i.test(path);

/** Reduces any supported file to the diagrams it contains. */
export const blocksIn = (path: string, source: string): DiagramBlock[] =>
  isMarkdown(path)
    ? extractFromMarkdown(source)
    : source.trim()
      ? [{ code: source, startLine: 1 }]
      : [];
