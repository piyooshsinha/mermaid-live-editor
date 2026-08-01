<script lang="ts">
  /**
   * Offers an AI fix whenever the diagram fails to parse.
   *
   * This rides on state the editor already computes — `validatedState.error` is
   * populated on every keystroke — so the button appears exactly when it is
   * useful and stays hidden otherwise.
   */
  import { Button } from '$/components/ui/button';
  import { isConfigured } from '$/ai/config.svelte';
  import { acceptProposal, dismissProposal, proposal, runProposal } from '$/ai/proposal.svelte';
  import { repairDiagram } from '$/ai/tasks';
  import { validatedState } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import HealIcon from '~icons/material-symbols/healing-outline';

  const error = $derived(validatedState.current.error);
  // Named `view`, not `state`: a local called `state` shadows the $state rune.
  const view = $derived(proposal.current);
  const canRepair = $derived(Boolean(error) && isConfigured());

  const repair = async () => {
    const current = validatedState.current;
    if (!current.error) {
      return;
    }
    logEvent('aiRepair');
    await runProposal((options) =>
      repairDiagram(current.code, current.error?.message ?? 'Syntax error', options)
    );
  };
</script>

{#if canRepair}
  <div class="flex flex-col gap-2" data-testid="ai-repair">
    {#if proposal.isRunning}
      <span class="text-xs text-muted-foreground">Repairing…</span>
    {:else if view.status === 'ready' && view.code}
      <div class="flex items-center gap-2">
        <Button size="sm" onclick={acceptProposal}>Apply fix</Button>
        <Button size="sm" variant="outline" onclick={dismissProposal}>Dismiss</Button>
      </div>
    {:else}
      <Button size="sm" variant="outline" onclick={repair}>
        <HealIcon /> Fix with AI
      </Button>
    {/if}
  </div>
{/if}
