/**
 * Source edits driven by canvas selection.
 *
 * The canvas is a view over Mermaid text, so every toolbar action has to end up
 * as a text change — there is nowhere else for the state to live. These are
 * pure string transforms so they can be tested without a browser, and so the
 * caller keeps control of when the change is committed to the editor.
 */

import type { CanvasSelection } from './interaction.svelte';
import type { SourceMap } from './sourceMap';

export interface NodeStyle {
  /** Background colour. */
  fill?: string;
  /** Border colour. */
  stroke?: string;
  /** Label colour. */
  color?: string;
}

const STYLE_ORDER = ['fill', 'stroke', 'color'] as const;

/** Splits `fill:#fff,stroke:#000` into a record. */
const parseStyle = (declaration: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const part of declaration.split(',')) {
    const [key, ...rest] = part.split(':');
    if (key && rest.length > 0) {
      result[key.trim()] = rest.join(':').trim();
    }
  }
  return result;
};

const formatStyle = (style: Record<string, string>): string =>
  [
    ...STYLE_ORDER.filter((key) => style[key]).map((key) => `${key}:${style[key]}`),
    ...Object.entries(style)
      .filter(([key]) => !STYLE_ORDER.includes(key as (typeof STYLE_ORDER)[number]))
      .map(([key, value]) => `${key}:${value}`)
  ].join(',');

/**
 * Sets style properties on a node, merging with any existing `style` line so
 * setting a fill does not silently drop a previously chosen stroke.
 */
export const setNodeStyle = (code: string, nodeId: string, patch: NodeStyle): string => {
  const lines = code.split('\n');
  const pattern = new RegExp(`^(\\s*)style\\s+${nodeId}\\s+(.*)$`);

  for (const [index, line] of lines.entries()) {
    const match = pattern.exec(line);
    if (match) {
      const merged = { ...parseStyle(match[2]), ...patch };
      lines[index] = `${match[1]}style ${nodeId} ${formatStyle(merged)}`;
      return lines.join('\n');
    }
  }

  const declaration = formatStyle({ ...patch } as Record<string, string>);
  if (!declaration) {
    return code;
  }
  // Match the indentation of the body so the added line does not look pasted.
  const indent = /^(\s+)\S/.exec(lines[1] ?? '')?.[1] ?? '    ';
  const body = code.replace(/\s+$/, '');
  return `${body}\n${indent}style ${nodeId} ${declaration}\n`;
};

/**
 * Removes the selected element.
 *
 * Deleting a node removes every line that mentions it, since an edge to a node
 * that no longer exists would silently resurrect it as an unlabelled box.
 */
export const deleteSelection = (
  code: string,
  sourceMap: SourceMap,
  selection: CanvasSelection
): string => {
  const lines = code.split('\n');
  const doomed = new Set<number>();

  if (selection.kind === 'edge') {
    const line = sourceMap.edges[selection.id];
    if (line) {
      doomed.add(line);
    }
  } else {
    for (const line of sourceMap.nodes[selection.id] ?? []) {
      doomed.add(line);
    }
    // Also drop any style directive that targeted it.
    const stylePattern = new RegExp(`^\\s*(style|class)\\s+${selection.id}\\b`);
    for (const [index, line] of lines.entries()) {
      if (stylePattern.test(line)) {
        doomed.add(index + 1);
      }
    }
  }

  if (doomed.size === 0) {
    return code;
  }
  return lines.filter((_, index) => !doomed.has(index + 1)).join('\n');
};

/**
 * Adds an edge between two existing nodes.
 *
 * Appended as a bare `A --> B` rather than being woven into an existing line,
 * so the user's own formatting and any inline node definitions are left alone.
 */
export const connectNodes = (code: string, fromId: string, toId: string): string => {
  if (fromId === toId) {
    return code;
  }
  const lines = code.split('\n');
  // Reuse the body's indentation so the new line does not look pasted in.
  const indent =
    /^(\s+)\S/.exec(lines.find((line, index) => index > 0 && line.trim()) ?? '')?.[1] ?? '    ';
  const body = code.replace(/\s+$/, '');
  return `${body}\n${indent}${fromId} --> ${toId}\n`;
};

export type LayoutDirection = 'BT' | 'LR' | 'RL' | 'TD';

/** The direction currently declared on the diagram header, if any. */
export const readDirection = (code: string): LayoutDirection | undefined => {
  const match = /^\s*(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/im.exec(code);
  if (!match) {
    return undefined;
  }
  // TB and TD mean the same thing to Mermaid; normalise so the UI shows one.
  const value = match[1].toUpperCase();
  return value === 'TB' ? 'TD' : (value as LayoutDirection);
};

/**
 * Rewrites the flowchart header's direction.
 *
 * Only flowcharts carry direction in the header this way, so anything else is
 * returned untouched rather than being given a header it cannot parse.
 */
export const setDirection = (code: string, direction: LayoutDirection): string => {
  const pattern = /^(\s*)(flowchart|graph)(\s+)(TB|TD|BT|LR|RL)\b/im;
  if (pattern.test(code)) {
    return code.replace(pattern, `$1$2$3${direction}`);
  }
  // A bare `flowchart` with no direction is still valid; add one.
  const bare = /^(\s*)(flowchart|graph)(\s*)$/im;
  return bare.test(code) ? code.replace(bare, `$1$2 ${direction}`) : code;
};

/** Finds an unused node id derived from `base`, e.g. `API` -> `API2`. */
const freeId = (code: string, base: string): string => {
  for (let suffix = 2; suffix < 500; suffix++) {
    const candidate = `${base}${suffix}`;
    if (!new RegExp(`\\b${candidate}\\b`).test(code)) {
      return candidate;
    }
  }
  return `${base}_copy`;
};

/**
 * Copies a node's declaration under a new id. The copy is added standalone
 * rather than wired into the graph, so the user decides where it connects.
 */
export const duplicateNode = (code: string, sourceMap: SourceMap, nodeId: string): string => {
  const definitionLine = sourceMap.nodes[nodeId]?.[0];
  if (!definitionLine) {
    return code;
  }
  const lines = code.split('\n');
  const source = lines[definitionLine - 1] ?? '';
  // Take just the node reference, so duplicating a node declared inline on an
  // edge does not also clone the edge.
  const declaration = new RegExp(`${nodeId}\\s*([[({][^\\]})]*[\\])}]+)`).exec(source);
  const newId = freeId(code, nodeId);
  const indent = /^(\s*)/.exec(source)?.[1] ?? '    ';
  const copy = declaration ? `${indent}${newId}${declaration[1]}` : `${indent}${newId}[${newId}]`;
  const body = code.replace(/\s+$/, '');
  return `${body}\n${copy}\n`;
};
