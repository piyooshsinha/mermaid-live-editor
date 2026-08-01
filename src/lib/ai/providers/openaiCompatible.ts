/**
 * OpenAI-compatible chat-completions adapter.
 *
 * One adapter covers most of the local + aggregator market, since they all
 * expose `/v1/chat/completions`: Ollama, LM Studio, vLLM, LiteLLM, OpenRouter
 * and Groq. Only the base URL and key change.
 */

import { assertOk, sseJSON, trimSlash } from '../stream';
import type { AIModel, CompletionRequest, LLMProvider, ProviderCredentials } from '../types';
import { ProviderError } from '../types';

const OLLAMA_HINT =
  'If you are using Ollama, it rejects browser requests until you allow this origin: ' +
  'set OLLAMA_ORIGINS to include this site and restart Ollama.';

interface ChatChunk {
  choices?: { delta?: { content?: string | null } }[];
}

interface ModelListResponse {
  data?: { id?: string }[];
}

const resolveBaseUrl = ({ baseUrl }: ProviderCredentials): string => {
  const url = trimSlash(baseUrl?.trim() ?? '');
  if (!url) {
    throw new ProviderError('No server URL configured.', {
      hint: 'Set a base URL, e.g. http://localhost:11434/v1 for Ollama.'
    });
  }
  return url;
};

const authHeaders = ({ apiKey }: ProviderCredentials): Record<string, string> =>
  apiKey ? { authorization: `Bearer ${apiKey}` } : {};

export const openAICompatibleProvider: LLMProvider = {
  defaultBaseUrl: 'http://localhost:11434/v1',
  defaultModels: [],
  id: 'openai-compatible',
  label: 'Local / OpenAI-compatible',

  async listModels(credentials) {
    const response = await fetch(`${resolveBaseUrl(credentials)}/models`, {
      headers: authHeaders(credentials)
    });
    await assertOk(response, OLLAMA_HINT);
    const body = (await response.json()) as ModelListResponse;
    return (body.data ?? [])
      .map(({ id }) => id)
      .filter((id): id is string => Boolean(id))
      .map((id): AIModel => ({ id, label: id }));
  },

  requiresApiKey: false,
  setupHint: OLLAMA_HINT,

  async *stream(request: CompletionRequest, credentials, signal) {
    const messages = [
      ...(request.system ? [{ content: request.system, role: 'system' as const }] : []),
      ...request.messages
    ];
    const response = await fetch(`${resolveBaseUrl(credentials)}/chat/completions`, {
      body: JSON.stringify({
        max_tokens: request.maxTokens,
        messages,
        model: request.model,
        stream: true,
        temperature: request.temperature
      }),
      headers: { 'content-type': 'application/json', ...authHeaders(credentials) },
      method: 'POST',
      signal
    });
    await assertOk(response, OLLAMA_HINT);

    for await (const event of sseJSON(response)) {
      const delta = (event as ChatChunk).choices?.[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
};
