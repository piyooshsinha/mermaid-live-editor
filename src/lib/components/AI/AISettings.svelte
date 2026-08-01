<script lang="ts">
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Input } from '$/components/ui/input';
  import { Switch } from '$/components/ui/switch';
  import {
    aiConfig,
    credentialsFor,
    selectProvider,
    setRememberKeys,
    updateCredentials
  } from '$/ai/config.svelte';
  import { providerList } from '$/ai/providers';
  import type { AIModel, ProviderId } from '$/ai/types';
  import KeyIcon from '~icons/material-symbols/key-outline-rounded';
  import RefreshIcon from '~icons/material-symbols/refresh-rounded';
  import WarningIcon from '~icons/material-symbols/warning-outline-rounded';

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  let discovered = $state<AIModel[]>([]);
  let discoverError = $state('');
  let discovering = $state(false);

  const provider = $derived(
    providerList.find(({ id }) => id === aiConfig.providerId) ?? providerList[0]
  );
  const credentials = $derived(credentialsFor(aiConfig.providerId));
  // Live results win over the provider's built-in list once we have them.
  const models = $derived(discovered.length > 0 ? discovered : provider.defaultModels);

  const onProviderChange = (event: Event) => {
    discovered = [];
    discoverError = '';
    selectProvider((event.currentTarget as HTMLSelectElement).value as ProviderId);
  };

  const discoverModels = async () => {
    discovering = true;
    discoverError = '';
    try {
      discovered = [...(await provider.listModels(credentials))];
      if (discovered.length === 0) {
        discoverError = 'The server returned no models.';
      }
    } catch (error) {
      discovered = [];
      discoverError = error instanceof Error ? error.message : String(error);
    } finally {
      discovering = false;
    }
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>AI settings</Dialog.Title>
      <Dialog.Description>
        Choose where diagram generation runs. Everything stays in this browser.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4 py-2">
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="font-medium">Provider</span>
        <select
          class="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={aiConfig.providerId}
          onchange={onProviderChange}
          data-testid="ai-provider-select">
          {#each providerList as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>

      {#if provider.id !== 'hosted'}
        <label class="flex flex-col gap-1.5 text-sm">
          <span class="font-medium">Server URL</span>
          <Input
            type="url"
            placeholder={provider.defaultBaseUrl ?? ''}
            value={credentials.baseUrl ?? ''}
            oninput={(event) =>
              updateCredentials(provider.id, {
                baseUrl: (event.currentTarget as HTMLInputElement).value
              })} />
        </label>
      {/if}

      {#if provider.requiresApiKey}
        <label class="flex flex-col gap-1.5 text-sm">
          <span class="font-medium">API key</span>
          <Input
            type="password"
            autocomplete="off"
            placeholder="sk-..."
            value={credentials.apiKey ?? ''}
            oninput={(event) =>
              updateCredentials(provider.id, {
                apiKey: (event.currentTarget as HTMLInputElement).value
              })}
            data-testid="ai-api-key" />
        </label>

        <div
          class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <WarningIcon class="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div class="flex flex-col gap-2">
            <p>
              A key stored in this browser can be read by any script running on this page. This
              editor renders diagrams from URLs, so prefer a local model, or a key scoped and
              rotated for this use.
            </p>
            <label class="flex items-center gap-2">
              <Switch
                checked={aiConfig.current.rememberKeys}
                onCheckedChange={setRememberKeys}
                class="data-[state=checked]:bg-accent" />
              <span>Remember key after reload</span>
            </label>
            {#if !aiConfig.current.rememberKeys}
              <p class="text-muted-foreground">
                The key is kept in memory only and cleared when you reload.
              </p>
            {/if}
          </div>
        </div>
      {/if}

      <div class="flex flex-col gap-1.5 text-sm">
        <div class="flex items-center justify-between">
          <span class="font-medium">Model</span>
          <Button variant="ghost" size="sm" onclick={discoverModels} disabled={discovering}>
            <RefreshIcon class={discovering ? 'animate-spin' : ''} />
            {discovering ? 'Loading' : 'Load models'}
          </Button>
        </div>
        {#if models.length > 0}
          <select
            class="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={credentials.model ?? ''}
            onchange={(event) =>
              updateCredentials(provider.id, {
                model: (event.currentTarget as HTMLSelectElement).value
              })}
            data-testid="ai-model-select">
            {#each models as model (model.id)}
              <option value={model.id}>{model.label}</option>
            {/each}
          </select>
        {:else}
          <Input
            placeholder="Model name, e.g. llama3.1"
            value={credentials.model ?? ''}
            oninput={(event) =>
              updateCredentials(provider.id, {
                model: (event.currentTarget as HTMLInputElement).value
              })} />
        {/if}
        {#if discoverError}
          <p class="text-xs text-destructive">{discoverError}</p>
        {/if}
      </div>

      {#if provider.setupHint}
        <p class="flex items-start gap-2 text-xs text-muted-foreground">
          <KeyIcon class="mt-0.5 size-4 shrink-0" />
          {provider.setupHint}
        </p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button onclick={() => (open = false)}>Done</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
