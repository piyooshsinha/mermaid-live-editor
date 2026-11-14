/**
 * Maps rendered diagram elements back to the lines that declare them.
 *
 * This is what lets clicking a node or an arrow highlight the corresponding
 * Mermaid source. Mermaid does not emit source positions, so the mapping is
 * rebuilt by scanning the text with the same grammar the renderer accepts.
 *
 * Kept separate from `export/parse.ts` on purpose: that module builds a
 * structural model for format conversion and deliberately discards positions,
 * whereas this one cares only about positions and ignores structure.
 */

export interface SourceMap {
  /** Edge key (`L_A_B_0`) to the 1-based line that declares it. */
  edges: Record<string, number>;
  /** Node id to every 1-based line that mentions it, definition first. */
  nodes: Record<string, number[]>;
}

// Mirrors the connector forms in export/parse.ts: -->, ---, -.->, ==>, with an
// optional |label| between the connector and the target.
const EDGE_LINE = /^(.+?)\s*(-{2,}>|-{2,}|-\.-+>|-\.-+|={2,}>)\s*(?:\|[^|]*\|)?\s*(.+)$/;

const SHAPE_OPENERS = ['([', '((', '[[', '[(', '{', '(', '['];

/** Strips a node reference down to its id: `A[Label]` and `A` both give `A`. */
const idOf = (raw: string): string | undefined => {
  const text = raw.trim().replace(/;$/, '');
  if (!text) {
    return undefined;
  }
  let cut = text.length;
  for (const opener of SHAPE_OPENERS) {
    const at = text.indexOf(opener);
    if (at > 0) {
      cut = Math.min(cut, at);
    }
  }
  const id = text.slice(0, cut).trim();
  return /^[\w-]+$/.test(id) ? id : undefined;
};

/** True when the reference carries a label, i.e. it is the definition site. */
const isDefinition = (raw: string): boolean =>
  SHAPE_OPENERS.some((opener) => raw.trim().indexOf(opener) > 0);

/**
 * Builds the map. Lines are 1-based so they can be handed straight to an
 * editor. Node lines are ordered with the labelled definition first, since
 * that is the line a user most likely wants revealed.
 */
export const buildSourceMap = (code: string): SourceMap => {
  const nodes: Record<string, number[]> = {};
  const definitionLine: Record<string, number> = {};
  const edges: Record<string, number> = {};
  const pairCount: Record<string, number> = {};

  const note = (id: string, line: number, definition: boolean) => {
    nodes[id] ??= [];
    if (!nodes[id].includes(line)) {
      nodes[id].push(line);
    }
    if (definition && definitionLine[id] === undefined) {
      definitionLine[id] = line;
    }
  };

  const lines = code.split('\n');
  for (const [index, rawLine] of lines.entries()) {
    const line = index + 1;
    const text = rawLine.trim();
    if (!text || text.startsWith('%%')) {
      continue;
    }
    // Declarations that carry styling or grouping, not graph structure.
    if (
      /^(flowchart|graph|subgraph|end|style|classDef|class|click|linkStyle|direction)\b/i.test(text)
    ) {
      continue;
    }

    const edge = EDGE_LINE.exec(text.replace(/;$/, ''));
    if (edge) {
      const from = idOf(edge[1]);
      const to = idOf(edge[3]);
      if (from && to) {
        note(from, line, isDefinition(edge[1]));
        note(to, line, isDefinition(edge[3]));
        // Mermaid suffixes repeated pairs, so count occurrences in order.
        const pair = `${from}_${to}`;
        const occurrence = pairCount[pair] ?? 0;
        pairCount[pair] = occurrence + 1;
        edges[`L_${from}_${to}_${occurrence}`] = line;
      }
      continue;
    }

    const standalone = idOf(text);
    if (standalone && isDefinition(text)) {
      note(standalone, line, true);
    }
  }

  // Put the definition line first so callers can reveal the best line.
  for (const [id, lineNumbers] of Object.entries(nodes)) {
    const definition = definitionLine[id];
    if (definition !== undefined) {
      nodes[id] = [definition, ...lineNumbers.filter((value) => value !== definition)];
    }
  }

  return { edges, nodes };
};
