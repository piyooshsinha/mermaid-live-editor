/**
 * Google Gemini adapter (generateContent streaming API).
 *
 * Gemini keeps the system prompt in a dedicated `systemInstruction` field and
 * splits assistant turns under the `model` role, so messages need mapping
 * rather than passing straight through.
 */

import { assertOk, sseJSON, trimSlash } from '../stream';
import type { AIModel, LLMProvider, ProviderCredentials } from '../types';
import { ProviderError } from '../types';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

interface GeminiModelList {
  models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
}

const resolve = (credentials: ProviderCredentials) => {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) {
    throw new ProviderError('No Gemini API key configured.', {
      hint: 'Create a key in Google AI Studio and paste it into AI settings.'
    });
  }
  return { apiKey, baseUrl: trimSlash(credentials.baseUrl?.trim() || DEFAULT_BASE_URL) };
};

export const geminiProvider: LLMProvider = {
  defaultBaseUrl: DEFAULT_BASE_URL,
  defaultModels: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
  ],
  id: 'gemini',
  label: 'Google Gemini',

  async listModels(credentials) {
    const { apiKey, baseUrl } = resolve(credentials);
    // The key goes in a header rather than the query string so it never lands
    // in browser history, proxy logs, or a referrer.
    const response = await fetch(`${baseUrl}/models`, { headers: { 'x-goog-api-key': apiKey } });
    await assertOk(response);
    const body = (await response.json()) as GeminiModelList;
    return (body.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent') ?? true)
      .map((model): AIModel | undefined => {
        const id = model.name?.replace(/^models\//, '');
        return id ? { id, label: model.displayName ?? id } : undefined;
      })
      .filter((model): model is AIModel => model !== undefined);
  },

  requiresApiKey: true,

  async *stream(request, credentials, signal) {
    const { apiKey, baseUrl } = resolve(credentials);
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse`,
      {
        body: JSON.stringify({
          contents: request.messages.map((message) => ({
            parts: [{ text: message.content }],
            role: message.role === 'assistant' ? 'model' : 'user'
          })),
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            temperature: request.temperature
          },
          ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {})
        }),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        method: 'POST',
        signal
      }
    );
    await assertOk(response);

    for await (const event of sseJSON(response)) {
      const parts = (event as GeminiChunk).candidates?.[0]?.content?.parts ?? [];
      for (const { text } of parts) {
        if (text) {
          yield text;
        }
      }
    }
  }
};
