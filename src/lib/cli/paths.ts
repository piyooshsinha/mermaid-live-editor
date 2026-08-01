/**
 * Path filtering for the diagram validator.
 *
 * A glob like `**\/*.md` will happily walk `node_modules` and build output.
 * That happens not to bite under pnpm, whose `node_modules` is mostly symlinks
 * that globs do not follow — but it would under npm, where those are real
 * directories holding thousands of Markdown files. Excluding them explicitly
 * means the CLI behaves the same regardless of package manager.
 */

/** Directories never worth scanning for hand-written diagrams. */
export const DEFAULT_EXCLUDES = [
  '.git',
  '.svelte-kit',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'vendor'
] as const;

/**
 * Whether a path sits inside any excluded directory.
 *
 * Matching is done on path segments rather than substrings, so a legitimate
 * file such as `docs/node_modules_guide.md` is not skipped.
 */
export const isExcluded = (
  path: string,
  excludes: readonly string[] = DEFAULT_EXCLUDES
): boolean => {
  const segments = path.split(/[/\\]/);
  return excludes.some((exclude) => segments.includes(exclude));
};
