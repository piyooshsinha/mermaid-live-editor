/**
 * Applying a style to the diagram's Mermaid config.
 *
 * Styles are merged rather than assigned: a diagram may carry config the user
 * set by hand (`flowchart.curve`, `securityLevel`, a `look`) that has nothing
 * to do with colour, and switching styles must not quietly discard it.
 *
 * There is no "current style" field anywhere. The active style is derived by
 * comparing the config against each preset, so a diagram arriving from a URL,
 * the library, or someone else's hand-written file reports its style correctly
 * without needing a marker we would then have to keep in sync.
 */

import type { MermaidConfig } from 'mermaid';
import { stylePresets, type StylePreset } from './presets';

/**
 * Matches the editor's config formatting. Deliberately not imported from
 * `util/util`: that module pulls in the loader and the state store, and the
 * resulting import cycle leaves this one holding an undefined function at
 * module-init time. Styles stay a leaf module with no runtime dependencies.
 */
const formatJSON = (data: unknown): string => JSON.stringify(data, undefined, 2);

/** Parses config, falling back to an empty object for unparseable input. */
const parseConfig = (configJSON: string): MermaidConfig => {
  try {
    return (JSON.parse(configJSON) as MermaidConfig) ?? {};
  } catch {
    // A half-typed config should not stop someone picking a style; the editor
    // already surfaces the JSON error separately.
    return {};
  }
};

/**
 * Returns the config with the preset's colours applied.
 *
 * Previous preset variables are dropped before merging, so switching from a
 * style with more variables to one with fewer does not leave orphans behind.
 * Variables the user added themselves are kept.
 */
export const applyPreset = (configJSON: string, preset: StylePreset): string => {
  const config = parseConfig(configJSON);
  const existing = (config.themeVariables ?? {}) as Record<string, string>;

  const ownedByPresets = new Set(
    stylePresets.flatMap((candidate) => Object.keys(candidate.variables))
  );
  const userVariables = Object.fromEntries(
    Object.entries(existing).filter(([key]) => !ownedByPresets.has(key))
  );

  return formatJSON({
    ...config,
    // `base` is the only Mermaid theme that honours themeVariables in full.
    theme: 'base',
    themeVariables: { ...userVariables, ...preset.variables }
  });
};

/** Removes preset colours, handing appearance back to Mermaid's own themes. */
export const clearPreset = (configJSON: string): string => {
  const config = parseConfig(configJSON);
  const existing = (config.themeVariables ?? {}) as Record<string, string>;
  const ownedByPresets = new Set(
    stylePresets.flatMap((candidate) => Object.keys(candidate.variables))
  );
  const userVariables = Object.fromEntries(
    Object.entries(existing).filter(([key]) => !ownedByPresets.has(key))
  );

  const next: MermaidConfig = { ...config, theme: 'default' };
  if (Object.keys(userVariables).length > 0) {
    next.themeVariables = userVariables;
  } else {
    delete next.themeVariables;
  }
  return formatJSON(next);
};

/**
 * The preset whose variables the config currently carries, if any.
 * Every variable must match; a diagram the user has since tweaked is reported
 * as having no preset rather than as a style it no longer matches.
 */
export const activePresetId = (configJSON: string): string | undefined => {
  const variables = (parseConfig(configJSON).themeVariables ?? {}) as Record<string, string>;
  return stylePresets.find((preset) =>
    Object.entries(preset.variables).every(([key, value]) => variables[key] === value)
  )?.id;
};

/** The config's theme variables, or an empty record for unusable config. */
export const themeVariablesOf = (configJSON: string): Record<string, string> =>
  (parseConfig(configJSON).themeVariables ?? {}) as Record<string, string>;
