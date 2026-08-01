/**
 * Prompt templates and output extraction for the AI tasks.
 *
 * Every task asks for bare Mermaid source, but models habitually wrap output in
 * prose or fences regardless, so `extractMermaid` is the real contract — it is
 * what the validation loop parses.
 */

const RULES = `You write Mermaid diagram source code.

Rules:
- Reply with Mermaid source ONLY. No prose, no explanation, no markdown fences.
- The first line must be the diagram declaration (e.g. "flowchart TD", "sequenceDiagram").
- Use valid Mermaid v11 syntax.
- Wrap any node label containing spaces, punctuation, or reserved words in double quotes.
- Keep labels short enough to read inside a node.`;

export const generateSystemPrompt = (): string =>
  `${RULES}\n\nProduce a complete diagram matching the user's description. Pick the diagram type that best fits unless the user names one.`;

export const editSystemPrompt = (): string =>
  `${RULES}\n\nYou are editing an existing diagram. Apply the requested change and return the COMPLETE updated diagram, not a fragment or a diff. Preserve any part of the diagram the request does not mention.`;

export const repairSystemPrompt = (): string =>
  `${RULES}\n\nThe user's diagram fails to parse. Return a corrected version of the COMPLETE diagram. Fix only the syntax error — do not restructure the diagram, rename nodes, or add content.`;

export const editUserPrompt = (code: string, instruction: string): string =>
  `Current diagram:\n\`\`\`\n${code}\n\`\`\`\n\nRequested change: ${instruction}`;

export const repairUserPrompt = (code: string, error: string): string =>
  `Diagram:\n\`\`\`\n${code}\n\`\`\`\n\nParser error:\n${error}`;

/** Feedback appended when a generated diagram fails to parse, closing the loop. */
export const retryUserPrompt = (error: string): string =>
  `That diagram failed to parse with the following error. Return the corrected complete diagram, source only.\n\n${error}`;

const FENCE = /^\s*```(?:mermaid)?\s*\n([\s\S]*?)\n?\s*```\s*$/;

/**
 * Pulls Mermaid source out of a model response.
 *
 * Handles the three shapes models actually produce: a bare diagram, a single
 * fenced block, and prose wrapped around a fenced block. Falls back to the
 * trimmed response so a malformed reply still reaches the parser, where it
 * produces a real error message the retry can act on.
 */
export const extractMermaid = (raw: string): string => {
  const text = raw.trim();

  const whole = FENCE.exec(text);
  if (whole) {
    return whole[1].trim();
  }

  // Prose around a fence: take the first fenced block.
  const inner = /```(?:mermaid)?\s*\n([\s\S]*?)```/.exec(text);
  if (inner) {
    return inner[1].trim();
  }

  return text;
};
