import { describe, expect, it } from 'vitest';
import { parseDiagram } from './parse';
import type { FlowGraph, SequenceDiagram } from './parse';

const flowchart = (code: string) => parseDiagram(code, 'flowchart') as FlowGraph;
const sequence = (code: string) => parseDiagram(code, 'sequence') as SequenceDiagram;

describe('parseDiagram - flowchart', () => {
  it('extracts nodes, shapes, and edges', () => {
    const graph = flowchart(
      [
        'flowchart TD',
        '    A[Christmas] -->|Get money| B(Go shopping)',
        '    B --> C{Let me think}',
        '    C -->|One| D[Laptop]'
      ].join('\n')
    );

    expect(graph.direction).toBe('TD');
    expect(graph.nodes).toEqual([
      { id: 'A', label: 'Christmas', shape: 'rectangle' },
      { id: 'B', label: 'Go shopping', shape: 'rounded' },
      { id: 'C', label: 'Let me think', shape: 'diamond' },
      { id: 'D', label: 'Laptop', shape: 'rectangle' }
    ]);
    expect(graph.edges).toEqual([
      { dashed: false, from: 'A', label: 'Get money', to: 'B' },
      { dashed: false, from: 'B', to: 'C' },
      { dashed: false, from: 'C', label: 'One', to: 'D' }
    ]);
  });

  it('keeps a labelled definition over an earlier bare reference', () => {
    const graph = flowchart('flowchart LR\n  A --> B\n  B[Real label]');
    expect(graph.direction).toBe('LR');
    expect(graph.nodes.find((node) => node.id === 'B')?.label).toBe('Real label');
  });

  it('marks dotted links as dashed', () => {
    const graph = flowchart('flowchart TD\n  A -.-> B');
    expect(graph.edges[0]).toMatchObject({ dashed: true, from: 'A', to: 'B' });
  });

  it('handles quoted labels and stadium shapes', () => {
    const graph = flowchart('flowchart TD\n  A(["Start: now"]) --> B');
    expect(graph.nodes[0]).toEqual({ id: 'A', label: 'Start: now', shape: 'stadium' });
  });

  it('skips styling and subgraph declarations', () => {
    const graph = flowchart(
      [
        'flowchart TD',
        '  %% a comment',
        '  subgraph one',
        '  A --> B',
        '  end',
        '  style A fill:#f9f',
        '  classDef big font-size:20px'
      ].join('\n')
    );
    expect(graph.nodes.map((node) => node.id)).toEqual(['A', 'B']);
    expect(graph.edges).toHaveLength(1);
  });
});

describe('parseDiagram - sequence', () => {
  it('extracts declared participants and messages', () => {
    const diagram = sequence(
      [
        'sequenceDiagram',
        '    participant U as User',
        '    participant A as App',
        '    U->>A: submit credentials',
        '    A-->>U: session token'
      ].join('\n')
    );

    expect(diagram.participants).toEqual([
      { alias: 'U', label: 'User' },
      { alias: 'A', label: 'App' }
    ]);
    expect(diagram.messages).toEqual([
      { arrow: 'solid', from: 'U', label: 'submit credentials', to: 'A' },
      { arrow: 'dotted', from: 'A', label: 'session token', to: 'U' }
    ]);
  });

  it('infers undeclared participants from messages', () => {
    const diagram = sequence('sequenceDiagram\n  Alice->>Bob: hello');
    expect(diagram.participants).toEqual([
      { alias: 'Alice', label: 'Alice' },
      { alias: 'Bob', label: 'Bob' }
    ]);
  });

  it('skips block and note declarations', () => {
    const diagram = sequence(
      [
        'sequenceDiagram',
        '  autonumber',
        '  Note over A,B: setup',
        '  loop every minute',
        '  A->>B: ping',
        '  end'
      ].join('\n')
    );
    expect(diagram.messages).toEqual([{ arrow: 'solid', from: 'A', label: 'ping', to: 'B' }]);
  });
});

describe('parseDiagram - unsupported', () => {
  it('returns undefined for diagram types with no structural mapping', () => {
    expect(parseDiagram('pie title Pets\n "Dogs" : 386', 'pie')).toBeUndefined();
    expect(parseDiagram('', 'flowchart')).toBeUndefined();
  });
});
