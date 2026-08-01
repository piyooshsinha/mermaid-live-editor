/**
 * Provider registry. This is the only place that knows the concrete adapters —
 * everything downstream resolves a provider by id.
 */

import type { LLMProvider, ProviderId } from '../types';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { hostedProvider } from './hosted';
import { openAICompatibleProvider } from './openaiCompatible';

export const providers: Record<ProviderId, LLMProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  hosted: hostedProvider,
  'openai-compatible': openAICompatibleProvider
};

/** Registry order, which is also the order shown in settings. */
export const providerList: readonly LLMProvider[] = [
  openAICompatibleProvider,
  anthropicProvider,
  geminiProvider,
  hostedProvider
];

export const getProvider = (id: ProviderId): LLMProvider => providers[id];
