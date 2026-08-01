/**
 * Turns validation results into something a person or a machine can read.
 *
 * Diagnostics are emitted as `path:line:col: message`, the shape editors and CI
 * annotators already know how to parse, so a failure is clickable rather than
 * just printed.
 */

export interface Diagnostic {
  /** 1-based line in the *file*, already offset past any Markdown fence. */
  line: number;
  message: string;
  path: string;
}

export interface ValidationSummary {
  diagnostics: Diagnostic[];
  diagramsChecked: number;
  filesChecked: number;
}

/**
 * Rewrites a Mermaid parse error so its line number refers to the file.
 *
 * Mermaid reports lines relative to the snippet it was given. Inside a Markdown
 * fence that is off by however far down the file the fence sits, so the number
 * is corrected in the message text as well as in the diagnostic.
 */
export const offsetMessage = (message: string, offset: number): string =>
  offset === 0
    ? message
    : message.replaceAll(
        /\bline (\d+)/gi,
        (_match, line: string) => `line ${Number(line) + offset}`
      );

/** The line a parse error points at, relative to the snippet (1 if unknown). */
export const lineOfError = (message: string): number => {
  const match = /\bline (\d+)/i.exec(message);
  return match ? Number(match[1]) : 1;
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const formatText = (summary: ValidationSummary): string => {
  const lines = summary.diagnostics.map(
    (diagnostic) => `${diagnostic.path}:${diagnostic.line}: ${diagnostic.message}`
  );
  const scope = `${plural(summary.diagramsChecked, 'diagram')} in ${plural(summary.filesChecked, 'file')}`;
  lines.push(
    summary.diagnostics.length === 0
      ? `✔ ${scope} — all valid`
      : `✖ ${plural(summary.diagnostics.length, 'problem')} in ${scope}`
  );
  return lines.join('\n');
};

export const formatJSON = (summary: ValidationSummary): string =>
  JSON.stringify(summary, undefined, 2);

/** Non-zero when anything failed, so CI stops the build. */
export const exitCodeFor = (summary: ValidationSummary): number =>
  summary.diagnostics.length > 0 ? 1 : 0;
