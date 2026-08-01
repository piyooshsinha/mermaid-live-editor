/**
 * Shared HTTP + SSE helpers for provider adapters.
 *
 * Adapters differ only in their request shape and which JSON field holds the
 * text delta, so the transport, error surfacing, and line framing live here.
 */

import { ProviderError } from './types';

/** Turns a fetch failure into a ProviderError carrying the response body. */
export const assertOk = async (response: Response, hint?: string): Promise<void> => {
  if (response.ok) {
    return;
  }
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    // Body already consumed or unreadable; the status alone still helps.
  }
  throw new ProviderError(
    `Request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ''}`,
    { hint, status: response.status }
  );
};

/**
 * Yields decoded lines from a response body, splitting on newlines and holding
 * the trailing partial line until more bytes arrive.
 */
async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // The final element is an incomplete line unless the chunk ended on \n.
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        yield line;
      }
    }
    if (buffer.trim()) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Yields the parsed `data:` payload of each SSE event. `[DONE]` sentinels and
 * non-JSON payloads are skipped rather than thrown, since providers emit
 * comments and keep-alives on the same channel.
 */
export async function* sseJSON(response: Response): AsyncGenerator<unknown> {
  if (!response.body) {
    throw new ProviderError('Response had no body to stream.');
  }
  for await (const line of readLines(response.body)) {
    if (!line.startsWith('data:')) {
      continue;
    }
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') {
      continue;
    }
    try {
      yield JSON.parse(payload);
    } catch {
      // A truncated or non-JSON event is not fatal for the rest of the stream.
    }
  }
}

/** Strips a trailing slash so callers can join paths without doubling it. */
export const trimSlash = (url: string): string => url.replace(/\/+$/, '');
