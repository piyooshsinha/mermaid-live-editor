/**
 * Stores manual layout inside the Mermaid source itself.
 *
 * Manual positions and edge routes previously lived in editor state, which
 * meant the `.mmd` file did not describe what you saw: open it anywhere else —
 * GitHub, a docs site, another editor — and the arrangement was gone.
 *
 * Encoding it as a `%%` comment keeps one source of truth. Every other Mermaid
 * renderer ignores comment lines, so the diagram still renders correctly
 * elsewhere; it simply falls back to automatic layout. The file stays a single
 * portable, git-diffable artifact, which is the whole point of a text format.
 *
 * A plain `%% ...` comment is used rather than the `%%{ ... }%%` directive
 * form, because directives are parsed by Mermaid and an unknown one is an
 * error rather than a comment.
 */

import type { NodePosition } from '$/types';

const MARKER = '%% mermaid-editor:layout ';

export interface ManualLayout {
  edgeWaypoints: Record<string, NodePosition[]>;
  nodePositions: Record<string, NodePosition>;
}

/** Compact wire form: [x, y] pairs rather than {x, y} objects. */
interface EncodedLayout {
  e?: Record<string, [number, number][]>;
  n?: Record<string, [number, number]>;
}

/** Rounds to whole units — sub-pixel precision only bloats the diff. */
const round = (value: number): number => Math.round(value);

export const isLayoutComment = (line: string): boolean => line.trimStart().startsWith(MARKER);

/**
 * Reads the layout comment, if present. Returns undefined when the diagram has
 * no manual layout, which is what tells the caller to leave Mermaid in charge.
 */
export const readLayout = (code: string): ManualLayout | undefined => {
  const line = code.split('\n').find((candidate) => isLayoutComment(candidate));
  if (!line) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(line.trimStart().slice(MARKER.length)) as EncodedLayout;
    const nodePositions: Record<string, NodePosition> = {};
    for (const [id, [x, y]] of Object.entries(parsed.n ?? {})) {
      nodePositions[id] = { x, y };
    }
    const edgeWaypoints: Record<string, NodePosition[]> = {};
    for (const [key, points] of Object.entries(parsed.e ?? {})) {
      edgeWaypoints[key] = points.map(([x, y]) => ({ x, y }));
    }
    return { edgeWaypoints, nodePositions };
  } catch {
    // A hand-edited or truncated comment must not break the diagram; treat it
    // as absent and fall back to automatic layout.
    return undefined;
  }
};

/**
 * Writes (or removes) the layout comment, leaving the rest of the source
 * untouched. Passing undefined clears it, which is how Auto-Layout is
 * re-enabled.
 */
export const writeLayout = (code: string, layout: ManualLayout | undefined): string => {
  const lines = code.split('\n').filter((line) => !isLayoutComment(line));
  const body = lines.join('\n').replace(/\s+$/, '');

  if (!layout) {
    return `${body}\n`;
  }

  const encoded: EncodedLayout = {};
  const nodes = Object.entries(layout.nodePositions);
  if (nodes.length > 0) {
    encoded.n = Object.fromEntries(
      nodes.map(([id, { x, y }]) => [id, [round(x), round(y)] as [number, number]])
    );
  }
  const edges = Object.entries(layout.edgeWaypoints).filter(([, points]) => points.length > 0);
  if (edges.length > 0) {
    encoded.e = Object.fromEntries(
      edges.map(([key, points]) => [
        key,
        points.map(({ x, y }) => [round(x), round(y)] as [number, number])
      ])
    );
  }

  if (!encoded.n && !encoded.e) {
    return `${body}\n`;
  }
  return `${body}\n${MARKER}${JSON.stringify(encoded)}\n`;
};
