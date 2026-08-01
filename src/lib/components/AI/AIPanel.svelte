<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { isConfigured } from '$/ai/config.svelte';
  import {
    acceptProposal,
    dismissProposal,
    proposal,
    runProposal,
    undoProposal
  } from '$/ai/proposal.svelte';
  import { editDiagram, generateDiagram } from '$/ai/tasks';
  import { validatedState } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import AISettings from './AISettings.svelte';
  import SparkleIcon from '~icons/material-symbols/auto-awesome-outline-rounded';
  import SettingsIcon from '~icons/material-symbols/settings-outline-rounded';
  import StopIcon from '~icons/material-symbols/stop-circle-outline-rounded';

  let prompt = $state('');
  let settingsOpen = $state(false);
  let lastBaseline = $state<string | undefined>();

  // Named `view`, not `state`: a local called `state` shadows the $state rune.
  const view = $derived(proposal.current);
  const configured = $derived(isConfigured());
  // An empty canvas means "generate"; anything else means "edit what's there".
  const hasDiagram = $derived(validatedState.current.code.trim().length > 0);

  const submit = async () => {
    const instruction = prompt.trim();
    if (!instruction || proposal.isRunning) {
      return;
    }
    if (!configured) {
      settingsOpen = true;
      return;
    }
    lastBaseline = undefined;
    const mode = hasDiagram ? 'edit' : 'generate';
    logEvent('aiPrompt', { mode });

    await runProposal((options) =>
      hasDiagram
        ? editDiagram(validatedState.current.code, instruction, options)
        : generateDiagram(instruction, options)
    );
  };

  const accept = () => {
    lastBaseline = view.baseline;
    acceptProposal();
    prompt = '';
    logEvent('aiAccept');
  };

  const undo = () => {
    if (lastBaseline !== undefined) {
      undoProposal(lastBaseline);
      lastBaseline = undefined;
    }
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const statusText = $derived.by(() => {
    if (view.status !== 'running') {
      return '';
    }
    if (view.phase === 'retrying' || view.attempt > 1) {
      return `Fixing syntax (attempt ${view.attempt} of 3)…`;
    }
    return view.phase === 'validating' ? 'Checking syntax…' : 'Generating…';
  });
</script>

<Card title="AI" isOpen icon={{ component: SparkleIcon }}>
  {#snippet actions()}
    <button
      class="text-muted-foreground hover:text-foreground"
      title="AI settings"
      aria-label="AI settings"
      onclick={(event) => {
        event.stopPropagation();
        settingsOpen = true;
      }}>
      <SettingsIcon class="size-5" />
    </button>
  {/snippet}

  <div class="flex flex-col gap-3 p-3">
    <textarea
      bind:value={prompt}
      onkeydown={onKeydown}
      rows="2"
      data-testid="ai-prompt"
      placeholder={hasDiagram
        ? 'Describe a change, e.g. "add an error path from the API to a retry step"'
        : 'Describe a diagram, e.g. "a sequence diagram of a user logging in"'}
      class="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed shadow-xs transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
    ></textarea>

    <div class="flex min-h-8 items-center gap-3">
      {#if proposal.isRunning}
        <Button variant="outline" size="sm" onclick={dismissProposal}>
          <StopIcon /> Stop
        </Button>
        <span class="flex items-center gap-2 text-xs text-muted-foreground">
          <span class="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true"></span>
          {statusText}
        </span>
      {:else}
        <Button
          size="sm"
          variant="accent"
          onclick={submit}
          disabled={!prompt.trim()}
          data-testid="ai-submit">
          <SparkleIcon />
          {hasDiagram ? 'Apply change' : 'Generate'}
        </Button>
        <span class="text-xs text-muted-foreground">
          {#if configured}
            Enter to submit &middot; Shift+Enter for a new line
          {:else}
            Set up a provider to enable AI.
          {/if}
        </span>
      {/if}
    </div>

    {#if view.status !== 'idle' && view.code}
      <div class="flex flex-col overflow-hidden rounded-lg border border-border">
        <div class="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
          <span class="text-xs font-medium tracking-wide">Proposed diagram</span>
          {#if view.attempt > 1}
            <span
              class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              self-corrected {view.attempt - 1}&times;
            </span>
          {/if}
        </div>
        <pre
          class="max-h-48 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap"
          data-testid="ai-proposal">{view.code}</pre>

        {#if view.error}
          <p
            class="border-t border-border bg-destructive/5 px-3 py-2 text-xs text-destructive"
            data-testid="ai-error">
            Still not valid Mermaid after 3 attempts: {view.error}
          </p>
        {/if}

        {#if view.status !== 'running'}
          <div class="flex gap-2 border-t border-border bg-muted/20 px-3 py-2">
            <Button size="sm" onclick={accept} data-testid="ai-accept">
              {view.error ? 'Insert anyway' : 'Accept'}
            </Button>
            <Button size="sm" variant="ghost" onclick={dismissProposal}>Discard</Button>
          </div>
        {/if}
      </div>
    {:else if view.status === 'error' && view.error}
      <p
        class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        data-testid="ai-error">
        {view.error}
      </p>
    {/if}

    {#if lastBaseline !== undefined}
      <button
        class="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onclick={undo}>
        Undo AI change
      </button>
    {/if}
  </div>
</Card>

<AISettings bind:open={settingsOpen} />
