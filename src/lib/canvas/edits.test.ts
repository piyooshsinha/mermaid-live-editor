import { describe, expect, it } from 'vitest';
import { deleteSelection, duplicateNode, readDirection, setDirection, setNodeStyle } from './edits';
import type { CanvasSelection } from './interaction.svelte';
import { buildSourceMap } from './sourceMap';

const CODE = [
  'flowchart TD',
  '    A[Start] --> B{Choice}',
  '    B -->|yes| C[Done]',
  '    B -->|no| A'
].join('\n');

const selection = (kind: CanvasSelection['kind'], id: string): CanvasSelection => ({
  id,
  kind,
  lines: [],
  rect: new DOMRect()
});

describe('setNodeStyle', () => {
  it('appends a style line when the node has none', () => {
    const next = setNodeStyle(CODE, 'A', { fill: '#fee' });
    expect(next).toContain('style A fill:#fee');
  });

  it('merges into an existing style line instead of replacing it', () => {
    const withStyle = `${CODE}\n    style A fill:#fee`;
    const next = setNodeStyle(withStyle, 'A', { stroke: '#333' });
    expect(next).toContain('style A fill:#fee,stroke:#333');
    // Only one style line for A.
    expect(next.match(/style A /g)).toHaveLength(1);
  });

  it('overwrites a property that is set again', () => {
    const withStyle = `${CODE}\n    style A fill:#fee`;
    expect(setNodeStyle(withStyle, 'A', { fill: '#0f0' })).toContain('style A fill:#0f0');
  });

  it('does not confuse nodes whose ids share a prefix', () => {
    const code = 'flowchart TD\n    A --> AB\n    style AB fill:#fee';
    const next = setNodeStyle(code, 'A', { fill: '#00f' });
    expect(next).toContain('style AB fill:#fee');
    expect(next).toContain('style A fill:#00f');
  });

  it('leaves the code untouched when the patch is empty', () => {
    expect(setNodeStyle(CODE, 'A', {})).toBe(CODE);
  });
});

describe('deleteSelection', () => {
  it('removes only the selected edge line', () => {
    const map = buildSourceMap(CODE);
    const next = deleteSelection(CODE, map, selection('edge', 'L_B_C_0'));
    expect(next).not.toContain('B -->|yes| C');
    expect(next).toContain('A[Start] --> B{Choice}');
    expect(next).toContain('B -->|no| A');
  });

  it('removes every line mentioning a deleted node', () => {
    const map = buildSourceMap(CODE);
    const next = deleteSelection(CODE, map, selection('node', 'B'));
    // Leaving an edge to B would resurrect it as an unlabelled box.
    expect(next).not.toContain('B');
    expect(next.trim()).toBe('flowchart TD');
  });

  it('also removes style directives targeting the deleted node', () => {
    const code = `${CODE}\n    style C fill:#fee`;
    const map = buildSourceMap(code);
    const next = deleteSelection(code, map, selection('node', 'C'));
    expect(next).not.toContain('style C');
  });

  it('returns the code unchanged when nothing maps to the selection', () => {
    const map = buildSourceMap(CODE);
    expect(deleteSelection(CODE, map, selection('edge', 'L_X_Y_0'))).toBe(CODE);
  });
});

describe('direction', () => {
  it('reads the declared direction', () => {
    expect(readDirection(CODE)).toBe('TD');
    expect(readDirection('flowchart LR\n  A --> B')).toBe('LR');
  });

  it('normalises TB to TD, since Mermaid treats them the same', () => {
    expect(readDirection('flowchart TB\n  A --> B')).toBe('TD');
  });

  it('rewrites the header without touching the body', () => {
    const next = setDirection(CODE, 'LR');
    expect(next.split('\n')[0]).toBe('flowchart LR');
    expect(next).toContain('A[Start] --> B{Choice}');
  });

  it('adds a direction to a bare flowchart header', () => {
    expect(setDirection('flowchart\n  A --> B', 'RL')).toContain('flowchart RL');
  });

  it('leaves non-flowchart diagrams untouched', () => {
    const sequence = 'sequenceDiagram\n  A->>B: hi';
    expect(setDirection(sequence, 'LR')).toBe(sequence);
    expect(readDirection(sequence)).toBeUndefined();
  });
});

describe('duplicateNode', () => {
  it('copies the shape and label under a fresh id', () => {
    const next = duplicateNode(CODE, buildSourceMap(CODE), 'B');
    expect(next).toContain('B2{Choice}');
  });

  it('does not clone the edge a node was declared on', () => {
    const next = duplicateNode(CODE, buildSourceMap(CODE), 'A');
    const added = next.split('\n').at(-2) ?? '';
    expect(added).toContain('A2[Start]');
    expect(added).not.toContain('-->');
  });

  it('picks an id that is not already taken', () => {
    const code = 'flowchart TD\n    A[One]\n    A2[Two]';
    expect(duplicateNode(code, buildSourceMap(code), 'A')).toContain('A3[One]');
  });

  it('returns the code unchanged for an unknown node', () => {
    expect(duplicateNode(CODE, buildSourceMap(CODE), 'ZZ')).toBe(CODE);
  });
});
