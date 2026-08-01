<script lang="ts">
  /**
   * Repairs a diagram that fails to parse.
   *
   * Sits in the error bar, where the mermaid.ai "create an account to repair
   * with AI" upsell used to be — same place, but it now actually fixes the
   * diagram instead of advertising. It rides on state the editor already
   * computes: `validatedState.error` is populated on every keystroke, so the
   * button appears exactly when it is useful.
   *
   * It is shown whether or not a provider is configured. With none set up it
   * opens AI settings, which is how someone discovers the feature exists at
   * the moment they need it.
   */
  import AISettings from '$/components/AI/AISettings.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { isConfigured } from '$/ai/config.svelte';
  import { acceptProposal, dismissProposal, proposal, runProposal } from '$/ai/proposal.svelte';
  import { repairDiagram } from '$/ai/tasks';
  import { validatedState } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import HealIcon from '~icons/material-symbols/healing-outline';

  // Named `view`, not `state`: a local called `state` shadows the $state rune.
  const view = $derived(proposal.current);
  const configured = $derived(isConfigured());

  let settingsOpen = $state(false);

  const repair = async () => {
    if (!configured) {
      settingsOpen = true;
      return;
    }
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

{#if proposal.isRunning}
  <span class="text-xs whitespace-nowrap text-white/60">Repairing…</span>
{:else if view.status === 'ready' && view.code}
  <div class="flex items-center gap-2">
    <Button size="sm" variant="accent" onclick={acceptProposal}>Apply fix</Button>
    <Button size="sm" variant="outline" onclick={dismissProposal}>Dismiss</Button>
  </div>
{:else}
  <Button variant="accent" size="sm" data-testid={TID.aiRepairButton} onclick={repair}>
    <HealIcon />
    AI Repair
  </Button>
{/if}

<AISettings bind:open={settingsOpen} />
