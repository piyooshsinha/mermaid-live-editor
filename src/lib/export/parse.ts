/**
 * A small structural parser for the Mermaid subset that can be converted to
 * other diagram languages.
 *
 * Mermaid's public API exposes `{ diagramType }` and nothing else — there is no
 * stable AST to walk — so structural export needs its own parser. Rather than
 * depend on Mermaid internals that change between releases, this covers the two
 * diagram types that actually matter for interoperability (flowchart and
 * sequence) and reports everything else as unsupported.
 *
 * This is intentionally a *subset* parser: it recognizes the declarations that
 * carry structure (nodes, edges, participants, messages) and skips styling,
 * subgraph nesting, notes, and directives rather than guessing at them.
 */

export type NodeShape = 'diamond' | 'ellipse' | 'rectangle' | 'rounded' | 'stadium';

export interface FlowNode {
  id: string;
  label: string;
  shape: NodeShape;
}

export interface FlowEdge {
  dashed: boolean;
  from: string;
  label?: string;
  to: string;
}

export interface FlowGraph {
  direction: string;
  edges: FlowEdge[];
  nodes: FlowNode[];
  type: 'flowchart';
}

export interface SequenceMessage {
  arrow: 'async' | 'dotted' | 'solid';
  from: string;
  label: string;
  to: string;
}

export interface SequenceDiagram {
  messages: SequenceMessage[];
  participants: { alias: string; label: string }[];
  type: 'sequence';
}

export type ParsedDiagram = FlowGraph | SequenceDiagram;

/** Strips comments and blank lines, which no diagram type needs. */
const meaningfulLines = (code: string): string[] =>
  code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('%%'));

const SHAPES: { close: string; open: string; shape: NodeShape }[] = [
  // Longest delimiters first so `([` is not mistaken for `(`.
  { close: '])', open: '([', shape: 'stadium' },
  { close: '))', open: '((', shape: 'ellipse' },
  { close: '}', open: '{', shape: 'diamond' },
  { close: ')', open: '(', shape: 'rounded' },
  { close: ']', open: '[', shape: 'rectangle' }
];

const unquote = (text: string): string => {
  const trimmed = text.trim();
  return /^"[\s\S]*"$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
};

/**
 * Parses a node reference such as `A[Label]`, `B{Choice}` or a bare `C`.
 * Returns the node plus the id, so edges can reference it.
 */
const parseNodeRef = (raw: string): FlowNode | undefined => {
  const text = raw.trim();
  if (!text) {
    return undefined;
  }
  for (const { close, open, shape } of SHAPES) {
    const start = text.indexOf(open);
    if (start > 0 && text.endsWith(close)) {
      return {
        id: text.slice(0, start).trim(),
        label: unquote(text.slice(start + open.length, text.length - close.length)),
        shape
      };
    }
  }
  // A bare identifier: id doubles as the label until a definition supplies one.
  return /^[\w-]+$/.test(text) ? { id: text, label: text, shape: 'rectangle' } : undefined;
};

// Splits `A --> B`, `A -->|yes| B`, `A -.-> B`, `A ---|x| B`, `A ==> B`.
const EDGE = /^(.+?)\s*(-{2,}>|-{2,}|-\.-+>|-\.-+|={2,}>)\s*(?:\|([^|]*)\|)?\s*(.+)$/;

const parseFlowchart = (lines: string[]): FlowGraph => {
  const header = lines[0] ?? '';
  const direction =
    /^(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)/i.exec(header)?.[1]?.toUpperCase() ?? 'TD';

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  /** Records a node, letting a later labelled definition win over a bare ref. */
  const remember = (node: FlowNode) => {
    const existing = nodes.get(node.id);
    if (!existing || (existing.label === existing.id && node.label !== node.id)) {
      nodes.set(node.id, node);
    }
  };

  for (const line of lines.slice(1)) {
    // Skip declarations that carry styling or grouping rather than structure.
    if (/^(subgraph|end|style|classDef|class|click|linkStyle|direction)\b/i.test(line)) {
      continue;
    }

    const edge = EDGE.exec(line.replace(/;$/, ''));
    if (edge) {
      const [, rawFrom, connector, label, rawTo] = edge;
      const from = parseNodeRef(rawFrom);
      const to = parseNodeRef(rawTo);
      if (from && to) {
        remember(from);
        remember(to);
        edges.push({
          dashed: connector.includes('.'),
          from: from.id,
          ...(label ? { label: unquote(label) } : {}),
          to: to.id
        });
      }
      continue;
    }

    const node = parseNodeRef(line.replace(/;$/, ''));
    // A bare word on its own line is noise, not a node declaration.
    if (node && node.label !== node.id) {
      remember(node);
    }
  }

  return { direction, edges, nodes: [...nodes.values()], type: 'flowchart' };
};

// `A->>B: text`, `A-->>B: text`, `A->B: text`, `A-)B: text`.
// Participant names must not include `-`, or the name would greedily swallow
// the leading dash of a `-->>` connector.
const MESSAGE = /^(\w+)\s*(-{1,2}>>?|--?\))\s*(\w+)\s*:\s*(.*)$/;

const parseSequence = (lines: string[]): SequenceDiagram => {
  const participants = new Map<string, string>();
  const messages: SequenceMessage[] = [];

  const remember = (alias: string) => {
    if (!participants.has(alias)) {
      participants.set(alias, alias);
    }
  };

  for (const line of lines.slice(1)) {
    const declared = /^(?:participant|actor)\s+([\w-]+)(?:\s+as\s+(.+))?$/i.exec(line);
    if (declared) {
      participants.set(declared[1], unquote(declared[2] ?? declared[1]));
      continue;
    }
    // Blocks, notes, and activation markers carry no structure we can map.
    if (/^(note|loop|alt|else|opt|par|and|end|rect|activate|deactivate|autonumber)\b/i.test(line)) {
      continue;
    }

    const message = MESSAGE.exec(line);
    if (message) {
      const [, from, connector, to, label] = message;
      remember(from);
      remember(to);
      messages.push({
        arrow: connector.includes(')') ? 'async' : connector.startsWith('--') ? 'dotted' : 'solid',
        from,
        label: label.trim(),
        to
      });
    }
  }

  return {
    messages,
    participants: [...participants].map(([alias, label]) => ({ alias, label })),
    type: 'sequence'
  };
};

/** Diagram types that `parseDiagram` can turn into a structural model. */
export const STRUCTURAL_TYPES = new Set(['flowchart', 'sequence']);

/**
 * Parses supported Mermaid source into a structural model, or returns
 * undefined when the diagram type has no structural representation here.
 */
export const parseDiagram = (code: string, diagramType: string): ParsedDiagram | undefined => {
  const lines = meaningfulLines(code);
  if (lines.length === 0) {
    return undefined;
  }
  if (diagramType === 'flowchart') {
    return parseFlowchart(lines);
  }
  if (diagramType === 'sequence') {
    return parseSequence(lines);
  }
  return undefined;
};
