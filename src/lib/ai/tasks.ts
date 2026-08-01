/**
 * AI tasks, each wrapped in a parse-validation loop.
 *
 * The editor already validates every keystroke with `mermaid.parse`, which
 * makes the expensive half of "AI that reliably emits valid Mermaid" free: on a
 * parse failure we hand the error straight back to the model and let it try
 * again, instead of showing the user a broken diagram. This is the difference
 * between output that usually parses and output that essentially always does.
 */

import { parse } from '../util/mermaid';
import { activeCredentials, aiConfig } from './config.svelte';
import {
  editSystemPrompt,
  editUserPrompt,
  extractMermaid,
  generateSystemPrompt,
  repairSystemPrompt,
  repairUserPrompt,
  retryUserPrompt
} from './prompts';
import { getProvider } from './providers';
import type { AIMessage } from './types';

/** Total attempts, including the first. Each retry costs a full round trip. */
const MAX_ATTEMPTS = 3;

export interface TaskProgress {
  /** 1-based; anything above 1 means an earlier attempt failed to parse. */
  attempt: number;
  /** Mermaid source accumulated so far, for live preview. */
  code: string;
  phase: 'retrying' | 'streaming' | 'validating';
}

export interface TaskResult {
  attempts: number;
  code: string;
  /** Set when every attempt failed to parse; `code` is the last try. */
  error?: string;
}

export interface TaskOptions {
  onProgress?: (progress: TaskProgress) => void;
  signal?: AbortSignal;
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Collects a provider stream into a string, reporting deltas as they arrive. */
const collect = async (
  system: string,
  messages: AIMessage[],
  attempt: number,
  { onProgress, signal }: TaskOptions,
  abort: AbortSignal
): Promise<string> => {
  const provider = getProvider(aiConfig.providerId);
  const credentials = activeCredentials();
  if (!credentials.model) {
    throw new Error('No model selected. Open AI settings to choose one.');
  }

  let raw = '';
  for await (const delta of provider.stream(
    { messages, model: credentials.model, system },
    credentials,
    abort
  )) {
    raw += delta;
    // Report the extracted form so a preview never shows a stray fence.
    onProgress?.({ attempt, code: extractMermaid(raw), phase: 'streaming' });
  }
  signal?.throwIfAborted();
  return raw;
};

/**
 * Runs one task to a parseable diagram, retrying with the parser's own error
 * message as feedback.
 */
const runTask = async (
  system: string,
  initialMessages: AIMessage[],
  options: TaskOptions
): Promise<TaskResult> => {
  const controller = new AbortController();
  const { signal } = options;
  const forward = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', forward);

  const messages = [...initialMessages];
  let lastError = '';
  let lastCode = '';

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await collect(system, messages, attempt, options, controller.signal);
      const code = extractMermaid(raw);
      lastCode = code;

      options.onProgress?.({ attempt, code, phase: 'validating' });
      try {
        await parse(code);
        return { attempts: attempt, code };
      } catch (error) {
        lastError = errorText(error);
      }

      if (attempt < MAX_ATTEMPTS) {
        options.onProgress?.({ attempt, code, phase: 'retrying' });
        // Keep the failed attempt in context so the model corrects rather than
        // regenerates from scratch.
        messages.push(
          { content: raw, role: 'assistant' },
          { content: retryUserPrompt(lastError), role: 'user' }
        );
      }
    }

    return { attempts: MAX_ATTEMPTS, code: lastCode, error: lastError };
  } finally {
    signal?.removeEventListener('abort', forward);
  }
};

export const generateDiagram = (description: string, options: TaskOptions = {}) =>
  runTask(generateSystemPrompt(), [{ content: description, role: 'user' }], options);

export const editDiagram = (code: string, instruction: string, options: TaskOptions = {}) =>
  runTask(
    editSystemPrompt(),
    [{ content: editUserPrompt(code, instruction), role: 'user' }],
    options
  );

export const repairDiagram = (code: string, error: string, options: TaskOptions = {}) =>
  runTask(
    repairSystemPrompt(),
    [{ content: repairUserPrompt(code, error), role: 'user' }],
    options
  );
