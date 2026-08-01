#!/usr/bin/env node
/**
 * Validates Mermaid diagrams in a repository.
 *
 * Built for CI: point it at your docs and it fails the build when a diagram
 * stops parsing. Diagrams inside Markdown fences are checked too, which is
 * where broken diagrams usually hide — a README renders fine on GitHub right
 * up until the diagram silently turns into an error box.
 *
 * Validation deliberately does not use a browser. Mermaid needs a DOM, but
 * `parse` is satisfied by jsdom, so this stays a fast dependency-light check
 * rather than dragging a headless Chromium into every pipeline. Rendering to
 * SVG/PNG is the part that would need a real browser, and is not done here.
 *
 * Usage:
 *   node bin/mermaid-lint.ts "docs/**\/*.md" "diagrams/**\/*.mmd"
 *   node bin/mermaid-lint.ts --json README.md
 */

import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { blocksIn } from '../src/lib/cli/blocks.ts';
import { isExcluded } from '../src/lib/cli/paths.ts';
import {
  exitCodeFor,
  formatJSON,
  formatText,
  lineOfError,
  offsetMessage,
  type Diagnostic,
  type ValidationSummary
} from '../src/lib/cli/report.ts';

/**
 * Mermaid reaches for browser globals at import time, so the DOM has to exist
 * before it is loaded — hence the dynamic import below rather than a static one.
 */
const installDOM = (): void => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const globals = [
    'window',
    'document',
    'Element',
    'SVGElement',
    'HTMLElement',
    'Node',
    'DOMParser',
    'getComputedStyle',
    'MutationObserver',
    'requestAnimationFrame'
  ] as const;
  for (const key of globals) {
    try {
      (globalThis as Record<string, unknown>)[key] = (
        dom.window as unknown as Record<string, unknown>
      )[key];
    } catch {
      // Some globals are getter-only on newer Node; mermaid does not need them.
    }
  }
};

const HELP = `mermaid-lint — validate Mermaid diagrams

  node bin/mermaid-lint.ts [options] <glob...>

Checks .mmd/.mermaid files and \`\`\`mermaid blocks inside Markdown.
Exits non-zero if any diagram fails to parse.

Options:
  --json    Emit machine-readable JSON instead of text
  --help    Show this message
`;

const main = async (argv: string[]): Promise<number> => {
  const asJSON = argv.includes('--json');
  const patterns = argv.filter((argument) => !argument.startsWith('--'));

  if (argv.includes('--help') || patterns.length === 0) {
    process.stdout.write(HELP);
    return patterns.length === 0 && !argv.includes('--help') ? 1 : 0;
  }

  const paths = new Set<string>();
  for (const pattern of patterns) {
    for await (const match of glob(pattern)) {
      if (!isExcluded(match)) {
        paths.add(resolve(match));
      }
    }
  }

  if (paths.size === 0) {
    process.stderr.write(`No files matched: ${patterns.join(', ')}\n`);
    return 1;
  }

  installDOM();
  const mermaid = (await import('mermaid')).default;
  // Keep mermaid quiet; the CLI owns all output.
  mermaid.initialize({ logLevel: 'fatal', startOnLoad: false });

  const diagnostics: Diagnostic[] = [];
  let diagramsChecked = 0;

  for (const path of [...paths].sort()) {
    const display = relative(process.cwd(), path) || path;
    const source = await readFile(path, 'utf8');
    for (const block of blocksIn(display, source)) {
      diagramsChecked++;
      try {
        await mermaid.parse(block.code);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Fence offset: the diagram's first line is not the file's first line.
        const offset = block.startLine - 1;
        diagnostics.push({
          line: lineOfError(message) + offset,
          message: offsetMessage(message.split('\n')[0], offset),
          path: display
        });
      }
    }
  }

  const summary: ValidationSummary = {
    diagnostics,
    diagramsChecked,
    filesChecked: paths.size
  };
  process.stdout.write(`${asJSON ? formatJSON(summary) : formatText(summary)}\n`);
  return exitCodeFor(summary);
};

process.exitCode = await main(process.argv.slice(2));
