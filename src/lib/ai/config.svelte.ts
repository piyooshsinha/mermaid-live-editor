/**
 * Persisted AI settings, backed by the app's existing localStorage rune.
 *
 * API keys are stored per provider so switching back and forth does not force
 * the user to re-paste them. That convenience has a cost: anything able to run
 * script on this page can read localStorage, and this app renders
 * user-supplied SVG. `rememberKeys` lets a user opt out and keep the key in
 * memory for the session only.
 */

import { persisted } from '../util/persist.svelte';
import { getProvider } from './providers';
import type { ProviderCredentials, ProviderId } from './types';

const AI_CONFIG_KEY = 'aiConfig';

export interface AIConfig {
  credentials: Partial<Record<ProviderId, ProviderCredentials>>;
  providerId: ProviderId;
  /** When false, keys live in memory only and are cleared on reload. */
  rememberKeys: boolean;
}

const defaultConfig: AIConfig = {
  credentials: {},
  providerId: 'openai-compatible',
  rememberKeys: false
};

const store = persisted<AIConfig>(AI_CONFIG_KEY, defaultConfig);

// Keys the user chose not to persist. Populated for the current page only.
const sessionKeys = $state<Partial<Record<ProviderId, string>>>({});

export const aiConfig = {
  get current(): AIConfig {
    return store.value;
  },
  get providerId(): ProviderId {
    return store.value.providerId;
  }
};

/**
 * Credentials for a provider, with the provider's own defaults filled in and
 * the session-only key layered over whatever was persisted.
 */
export const credentialsFor = (id: ProviderId): ProviderCredentials => {
  const provider = getProvider(id);
  const stored = store.value.credentials[id] ?? {};
  return {
    apiKey: sessionKeys[id] ?? stored.apiKey,
    baseUrl: stored.baseUrl || provider.defaultBaseUrl,
    model: stored.model || provider.defaultModels[0]?.id
  };
};

export const activeCredentials = (): ProviderCredentials => credentialsFor(aiConfig.providerId);

export const selectProvider = (providerId: ProviderId): void => {
  store.value = { ...store.value, providerId };
};

export const setRememberKeys = (rememberKeys: boolean): void => {
  const credentials = { ...store.value.credentials };
  if (rememberKeys) {
    // Promote any session-only keys so they survive the next reload.
    for (const [id, key] of Object.entries(sessionKeys) as [ProviderId, string][]) {
      credentials[id] = { ...credentials[id], apiKey: key };
    }
  } else {
    // Demote persisted keys back to memory so nothing is left on disk.
    for (const [id, entry] of Object.entries(credentials) as [ProviderId, ProviderCredentials][]) {
      if (entry.apiKey) {
        sessionKeys[id] = entry.apiKey;
        credentials[id] = { ...entry, apiKey: undefined };
      }
    }
  }
  store.value = { ...store.value, credentials, rememberKeys };
};

export const updateCredentials = (id: ProviderId, patch: Partial<ProviderCredentials>): void => {
  const { apiKey, ...rest } = patch;
  const existing = store.value.credentials[id] ?? {};

  if (apiKey !== undefined) {
    if (store.value.rememberKeys) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- key moved to storage
      delete sessionKeys[id];
    } else {
      sessionKeys[id] = apiKey;
    }
  }

  store.value = {
    ...store.value,
    credentials: {
      ...store.value.credentials,
      [id]: {
        ...existing,
        ...rest,
        ...(apiKey !== undefined && store.value.rememberKeys ? { apiKey } : {}),
        // Never leave a stale persisted key behind when not remembering.
        ...(store.value.rememberKeys ? {} : { apiKey: undefined })
      }
    }
  };
};

/** True when the active provider has everything it needs to make a request. */
export const isConfigured = (): boolean => {
  const provider = getProvider(aiConfig.providerId);
  const credentials = activeCredentials();
  if (!credentials.model) {
    return false;
  }
  return provider.requiresApiKey ? Boolean(credentials.apiKey) : Boolean(credentials.baseUrl);
};
