/**
 * Anthropic (Claude) adapter, built on the official SDK.
 *
 * The SDK is dynamically imported so it lands in its own chunk and is only
 * fetched when the user actually selects this provider.
 *
 * Two model-specific constraints are handled here rather than by callers:
 * - `temperature` / `top_p` are rejected with a 400 on current Claude models,
 *   so `CompletionRequest.temperature` is deliberately dropped.
 * - Thinking is on by default. Rather than disabling it (which can leak
 *   `<thinking>` tags into the visible response), we keep adaptive thinking and
 *   hold effort at `low`, which is what keeps a live editor responsive.
 */

import { assertOk, trimSlash } from '../stream';
import type { AIModel, LLMProvider, ProviderCredentials } from '../types';
import { ProviderError } from '../types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';

/**
 * Calling the Anthropic API straight from a page requires this opt-in header;
 * without it the request is rejected. It also means the key is exposed to
 * anything that can run script on the page — see the warning in AI settings.
 */
const BROWSER_ACCESS_HEADERS = { 'anthropic-dangerous-direct-browser-access': 'true' };

const requireKey = ({ apiKey }: ProviderCredentials): string => {
  const key = apiKey?.trim();
  if (!key) {
    throw new ProviderError('No Anthropic API key configured.', {
      hint: 'Create a key at console.anthropic.com and paste it into AI settings.'
    });
  }
  return key;
};

const createClient = async (credentials: ProviderCredentials) => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({
    apiKey: requireKey(credentials),
    baseURL: trimSlash(credentials.baseUrl?.trim() || DEFAULT_BASE_URL),
    // The key is user-supplied and stays in this browser; the app never
    // proxies it anywhere. See the BYOK warning surfaced in settings.
    dangerouslyAllowBrowser: true,
    defaultHeaders: BROWSER_ACCESS_HEADERS
  });
};

export const anthropicProvider: LLMProvider = {
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModels: [
    { id: 'claude-opus-5', label: 'Claude Opus 5' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
  ],
  id: 'anthropic',
  label: 'Anthropic (Claude)',

  async listModels(credentials) {
    // Hitting the REST endpoint directly avoids pulling the SDK in just to
    // populate a dropdown.
    const response = await fetch(
      `${trimSlash(credentials.baseUrl?.trim() || DEFAULT_BASE_URL)}/v1/models?limit=100`,
      {
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': requireKey(credentials),
          ...BROWSER_ACCESS_HEADERS
        }
      }
    );
    await assertOk(response);
    const body = (await response.json()) as { data?: { id?: string; display_name?: string }[] };
    return (body.data ?? [])
      .map((model): AIModel | undefined =>
        model.id ? { id: model.id, label: model.display_name ?? model.id } : undefined
      )
      .filter((model): model is AIModel => model !== undefined);
  },

  requiresApiKey: true,

  async *stream(request, credentials, signal) {
    const client = await createClient(credentials);
    const stream = client.messages.stream(
      {
        max_tokens: request.maxTokens ?? 8000,
        messages: request.messages,
        model: request.model,
        // Diagram generation is latency-sensitive; low effort keeps the
        // round trip short while leaving adaptive thinking enabled.
        output_config: { effort: 'low' },
        thinking: { type: 'adaptive' },
        ...(request.system ? { system: request.system } : {})
      },
      { signal }
    );

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new ProviderError('Claude declined this request.', {
        hint: 'Rephrase the diagram description, or switch providers in AI settings.'
      });
    }
  }
};
