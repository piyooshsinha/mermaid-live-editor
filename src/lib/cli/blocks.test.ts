import { describe, expect, it } from 'vitest';
import { blocksIn, extractFromMarkdown, isMarkdown } from './blocks';

describe('extractFromMarkdown', () => {
  it('finds a fenced block and reports the line it starts on', () => {
    const source = [
      '# Title',
      '',
      'Some prose.',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```'
    ].join('\n');
    // The fence is line 5, so the diagram's first line is line 6.
    expect(extractFromMarkdown(source)).toEqual([
      { code: 'flowchart TD\n  A --> B', startLine: 6 }
    ]);
  });

  it('finds several blocks with independent offsets', () => {
    const source = [
      '```mermaid', // 1
      'flowchart TD', // 2
      '```', // 3
      'between', // 4
      '```mermaid', // 5
      'sequenceDiagram', // 6
      '```' // 7
    ].join('\n');
    expect(extractFromMarkdown(source).map((block) => block.startLine)).toEqual([2, 6]);
  });

  it('ignores fences for other languages', () => {
    const source = '```js\nconst a = 1;\n```\n```mermaid\nflowchart TD\n```';
    expect(extractFromMarkdown(source)).toEqual([{ code: 'flowchart TD', startLine: 5 }]);
  });

  it('supports tilde fences and uppercase language tags', () => {
    expect(extractFromMarkdown('~~~MERMAID\nflowchart TD\n~~~')).toEqual([
      { code: 'flowchart TD', startLine: 2 }
    ]);
  });

  it('does not end a block on a shorter fence inside it', () => {
    // CommonMark: the closer must be at least as long as the opener.
    const source = '````mermaid\nflowchart TD\n```\n  A --> B\n````';
    expect(extractFromMarkdown(source)[0].code).toBe('flowchart TD\n```\n  A --> B');
  });

  it('still reports an unterminated block so it gets checked', () => {
    expect(extractFromMarkdown('```mermaid\nflowchart TD')).toEqual([
      { code: 'flowchart TD', startLine: 2 }
    ]);
  });

  it('returns nothing when there are no mermaid blocks', () => {
    expect(extractFromMarkdown('# Just prose\n\nNo diagrams here.')).toEqual([]);
  });
});

describe('blocksIn', () => {
  it('treats a .mmd file as one diagram starting at line 1', () => {
    expect(blocksIn('a/b.mmd', 'flowchart TD\n  A --> B')).toEqual([
      { code: 'flowchart TD\n  A --> B', startLine: 1 }
    ]);
  });

  it('parses markdown files for fences instead', () => {
    expect(blocksIn('README.md', '```mermaid\nflowchart TD\n```')).toEqual([
      { code: 'flowchart TD', startLine: 2 }
    ]);
  });

  it('skips an empty diagram file', () => {
    expect(blocksIn('empty.mmd', '   \n\n')).toEqual([]);
  });
});

describe('isMarkdown', () => {
  it('recognises markdown extensions', () => {
    expect(isMarkdown('a.md')).toBe(true);
    expect(isMarkdown('a.MDX')).toBe(true);
    expect(isMarkdown('a.mmd')).toBe(false);
  });
});
