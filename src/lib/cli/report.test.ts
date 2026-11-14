import { describe, expect, it } from 'vitest';
import {
  exitCodeFor,
  formatJSON,
  formatText,
  lineOfError,
  offsetMessage,
  type ValidationSummary
} from './report';

const clean: ValidationSummary = { diagnostics: [], diagramsChecked: 3, filesChecked: 2 };
const broken: ValidationSummary = {
  diagnostics: [{ line: 12, message: 'Parse error on line 12', path: 'README.md' }],
  diagramsChecked: 3,
  filesChecked: 2
};

describe('lineOfError', () => {
  it('reads the line out of a mermaid parse error', () => {
    expect(lineOfError('Parse error on line 4:\n...')).toBe(4);
  });

  it('falls back to line 1 when the error has no line', () => {
    expect(lineOfError('No diagram type detected')).toBe(1);
  });
});

describe('offsetMessage', () => {
  it('shifts the line number to match the file', () => {
    // A fence starting at file line 6 means snippet line 2 is file line 7.
    expect(offsetMessage('Parse error on line 2:', 5)).toBe('Parse error on line 7:');
  });

  it('leaves the message alone when there is no offset', () => {
    expect(offsetMessage('Parse error on line 2:', 0)).toBe('Parse error on line 2:');
  });

  it('shifts every line reference in the message', () => {
    expect(offsetMessage('line 1 and line 3', 10)).toBe('line 11 and line 13');
  });
});

describe('formatText', () => {
  it('reports success with counts', () => {
    expect(formatText(clean)).toBe('✔ 3 diagrams in 2 files — all valid');
  });

  it('lists each problem as path:line: message', () => {
    expect(formatText(broken).split('\n')[0]).toBe('README.md:12: Parse error on line 12');
  });

  it('summarises the failure count', () => {
    expect(formatText(broken)).toContain('✖ 1 problem in 3 diagrams in 2 files');
  });

  it('uses singular wording for a single diagram', () => {
    expect(formatText({ diagnostics: [], diagramsChecked: 1, filesChecked: 1 })).toBe(
      '✔ 1 diagram in 1 file — all valid'
    );
  });
});

describe('formatJSON', () => {
  it('emits the summary verbatim for tooling', () => {
    expect(JSON.parse(formatJSON(broken))).toEqual(broken);
  });
});

describe('exitCodeFor', () => {
  it('is zero when everything parsed', () => {
    expect(exitCodeFor(clean)).toBe(0);
  });

  it('is non-zero when anything failed, so CI stops', () => {
    expect(exitCodeFor(broken)).toBe(1);
  });
});
