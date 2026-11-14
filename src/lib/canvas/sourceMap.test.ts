import { describe, expect, it } from 'vitest';
import { buildSourceMap } from './sourceMap';

const CODE = [
  'flowchart LR', // 1
  '    subgraph Data[Data Layer]', // 2
  '    WriteQ[(Write Queue)]', // 3
  '    end', // 4
  '', // 5
  '    API --> Auth', // 6
  '    API -->|read-through| Redis', // 7
  '    API -->|enqueue write| WriteQ', // 8
  '    Worker -->|consume write| WriteQ' // 9
].join('\n');

describe('buildSourceMap', () => {
  it('maps each edge to the line that declares it', () => {
    const { edges } = buildSourceMap(CODE);
    expect(edges.L_API_Auth_0).toBe(6);
    expect(edges.L_API_Redis_0).toBe(7);
    expect(edges.L_API_WriteQ_0).toBe(8);
    expect(edges.L_Worker_WriteQ_0).toBe(9);
  });

  it('numbers repeated pairs the way Mermaid does', () => {
    const { edges } = buildSourceMap('flowchart TD\n  A --> B\n  A --> B');
    expect(edges.L_A_B_0).toBe(2);
    expect(edges.L_A_B_1).toBe(3);
  });

  it('lists the labelled definition line first for a node', () => {
    const { nodes } = buildSourceMap(CODE);
    // WriteQ is defined on line 3 and referenced on 8 and 9.
    expect(nodes.WriteQ[0]).toBe(3);
    expect(nodes.WriteQ).toEqual(expect.arrayContaining([3, 8, 9]));
  });

  it('records every line that mentions a node', () => {
    const { nodes } = buildSourceMap(CODE);
    expect(nodes.API).toEqual([6, 7, 8]);
  });

  it('ignores comments, subgraph headers, and styling', () => {
    const { nodes } = buildSourceMap(
      [
        'flowchart TD',
        '  %% A --> B',
        '  subgraph Group[Outer]',
        '  end',
        '  style A fill:#f9f',
        '  linkStyle 0 stroke:red',
        '  A --> B'
      ].join('\n')
    );
    // Only the real edge on line 7 should be recorded.
    expect(nodes.A).toEqual([7]);
    expect(nodes.Group).toBeUndefined();
  });

  it('handles shaped nodes declared inline on an edge', () => {
    const { edges, nodes } = buildSourceMap('flowchart TD\n  A([Start]) --> B{Choice}');
    expect(edges.L_A_B_0).toBe(2);
    expect(nodes.A).toEqual([2]);
    expect(nodes.B).toEqual([2]);
  });

  it('returns empty maps for a diagram with no structure', () => {
    expect(buildSourceMap('flowchart TD')).toEqual({ edges: {}, nodes: {} });
  });
});
