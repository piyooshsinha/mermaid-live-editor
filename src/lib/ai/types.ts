/**
 * Provider-agnostic LLM types.
 *
 * Every provider adapter implements `LLMProvider`, so feature code (generation,
 * repair, suggestions) never learns which vendor is behind it. The `hosted`
 * adapter is the seam for a future server-side proxy with subscription billing:
 * it speaks the same interface, so adding it requires no feature-code changes.
 */

export type ProviderId = 'anthropic' | 'gemini' | 'hosted' | 'openai-compatible';

export interface AIModel {
  id: string;
  label: string;
}

export interface AIMessage {
  content: string;
  role: 'assistant' | 'user';
}

/**
 * A single completion request. `temperature` is advisory: providers whose
 * models reject sampling parameters (Claude Opus 5 returns a 400) must drop it
 * rather than forward it.
 */
export interface CompletionRequest {
  maxTokens?: number;
  messages: AIMessage[];
  model: string;
  system?: string;
  temperature?: number;
}

/** Per-provider connection settings. Persisted to localStorage. */
export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface LLMProvider {
  /** Extra setup the user must do outside the app (CORS, env vars, ...). */
  readonly setupHint?: string;
  readonly defaultBaseUrl?: string;
  readonly defaultModels: readonly AIModel[];
  readonly id: ProviderId;
  readonly label: string;
  /** Whether an API key is required for this provider to function. */
  readonly requiresApiKey: boolean;
  /**
   * Live model list. Providers without a discovery endpoint may return
   * `defaultModels`; failures should propagate so the UI can show them.
   */
  listModels: (credentials: ProviderCredentials) => Promise<readonly AIModel[]>;
  /** Streams response text deltas. Must honour `signal` for cancellation. */
  stream: (
    request: CompletionRequest,
    credentials: ProviderCredentials,
    signal: AbortSignal
  ) => AsyncIterable<string>;
}

/** Thrown for provider-side failures so the UI can render actionable text. */
export class ProviderError extends Error {
  readonly hint?: string;
  readonly status?: number;

  constructor(message: string, options: { hint?: string; status?: number } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.hint = options.hint;
    this.status = options.status;
  }
}
