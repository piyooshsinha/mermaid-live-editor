import { describe, expect, it } from 'vitest';
import { extractMermaid } from './prompts';

describe('extractMermaid', () => {
  it('returns a bare diagram unchanged', () => {
    expect(extractMermaid('flowchart TD\n  A --> B')).toBe('flowchart TD\n  A --> B');
  });

  it('trims surrounding whitespace', () => {
    expect(extractMermaid('\n\n  flowchart TD\n  A --> B  \n\n')).toBe('flowchart TD\n  A --> B');
  });

  it('unwraps a mermaid-tagged fence', () => {
    expect(extractMermaid('```mermaid\nflowchart TD\n  A --> B\n```')).toBe(
      'flowchart TD\n  A --> B'
    );
  });

  it('unwraps an untagged fence', () => {
    expect(extractMermaid('```\nsequenceDiagram\n  A->>B: hi\n```')).toBe(
      'sequenceDiagram\n  A->>B: hi'
    );
  });

  it('extracts the diagram when the model wraps it in prose', () => {
    const response = [
      "Sure! Here's a login sequence diagram:",
      '',
      '```mermaid',
      'sequenceDiagram',
      '  User->>App: credentials',
      '```',
      '',
      'Let me know if you want to add error handling.'
    ].join('\n');
    expect(extractMermaid(response)).toBe('sequenceDiagram\n  User->>App: credentials');
  });

  it('keeps fenced code blocks that appear inside the diagram body', () => {
    // A bare diagram must not be mangled by the prose-stripping fallback.
    const code = 'flowchart TD\n  A["uses ```json```"] --> B';
    expect(extractMermaid(code)).toBe(code);
  });
});
