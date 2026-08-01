/**
 * Hosted-proxy adapter — the seam for subscription billing.
 *
 * This app is a static SPA, so today every provider runs BYOK: the user's key
 * lives in their browser and talks to the vendor directly. A paid tier needs
 * the opposite — our keys, held server-side, metered per account. That server
 * does not exist yet, but the shape it must expose does: an SSE endpoint that
 * speaks the same delta protocol as the OpenAI-compatible adapter, with the
 * caller's session cookie instead of a vendor key.
 *
 * Keeping this adapter alongside the others means adding the paid tier later
 * is a deployment concern, not a refactor: no feature code references a
 * provider by name, so `hosted` drops in behind the same `LLMProvider` contract.
 */

import { assertOk, sseJSON, trimSlash } from '../stream';
import { env } from '../../util/env';
import type { LLMProvider } from '../types';
import { ProviderError } from '../types';

interface ChatChunk {
  choices?: { delta?: { content?: string | null } }[];
}

const resolveBaseUrl = (): string => {
  const url = trimSlash(env.aiProxyUrl);
  if (!url) {
    throw new ProviderError('Hosted AI is not available on this deployment.', {
      hint: 'Set MERMAID_AI_PROXY_URL to enable it, or pick a different provider.'
    });
  }
  return url;
};

export const hostedProvider: LLMProvider = {
  defaultModels: [],
  id: 'hosted',
  label: 'Hosted (subscription)',

  async listModels() {
    const response = await fetch(`${resolveBaseUrl()}/models`, { credentials: 'include' });
    await assertOk(response);
    const body = (await response.json()) as { data?: { id?: string; label?: string }[] };
    return (body.data ?? [])
      .filter((model): model is { id: string; label?: string } => Boolean(model.id))
      .map((model) => ({ id: model.id, label: model.label ?? model.id }));
  },

  requiresApiKey: false,

  async *stream(request, _credentials, signal) {
    const response = await fetch(`${resolveBaseUrl()}/chat/completions`, {
      body: JSON.stringify({ ...request, stream: true }),
      // The subscription session is a cookie; no key ever reaches the client.
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal
    });
    if (response.status === 401 || response.status === 402) {
      throw new ProviderError('Your subscription does not cover this request.', {
        hint: 'Sign in or check your plan, then try again.',
        status: response.status
      });
    }
    await assertOk(response);

    for await (const event of sseJSON(response)) {
      const delta = (event as ChatChunk).choices?.[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
};
