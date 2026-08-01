<script lang="ts">
  /**
   * Flow direction picker.
   *
   * Direction is a property of the Mermaid header (`flowchart LR`), so this
   * rewrites that one token and lets the normal render pipeline re-lay-out the
   * graph. It only appears for flowcharts, since no other diagram type takes
   * direction this way.
   */
  import { readDirection, setDirection, type LayoutDirection } from '$/canvas/edits';
  import * as Popover from '$/components/ui/popover';
  import { updateCode, validatedState } from '$/util/state.svelte';
  import { cn } from '$/utils';
  import ChevronIcon from '~icons/material-symbols/keyboard-double-arrow-down-rounded';
  import DownIcon from '~icons/material-symbols/arrow-downward-rounded';
  import LeftIcon from '~icons/material-symbols/arrow-back-rounded';
  import RightIcon from '~icons/material-symbols/arrow-forward-rounded';
  import UpIcon from '~icons/material-symbols/arrow-upward-rounded';

  const OPTIONS = [
    { icon: DownIcon, label: 'Top to bottom', value: 'TD' },
    { icon: UpIcon, label: 'Bottom to top', value: 'BT' },
    { icon: RightIcon, label: 'Left to right', value: 'LR' },
    { icon: LeftIcon, label: 'Right to left', value: 'RL' }
  ] as const satisfies readonly { icon: unknown; label: string; value: LayoutDirection }[];

  let open = $state(false);

  const current = $derived(readDirection(validatedState.current.code));

  const choose = (direction: LayoutDirection) => {
    updateCode(setDirection(validatedState.current.code, direction), { updateDiagram: true });
    open = false;
  };
</script>

{#if current}
  <Popover.Root bind:open>
    <Popover.Trigger
      class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Flow direction"
      title="Flow direction"
      data-testid="direction-menu">
      <ChevronIcon class="size-5" />
    </Popover.Trigger>
    <Popover.Content class="w-52 p-1">
      {#each OPTIONS as option (option.value)}
        <button
          class={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
            current === option.value && 'bg-muted font-medium'
          )}
          onclick={() => choose(option.value)}
          data-testid="direction-{option.value}">
          <option.icon class="size-4" />
          {option.label}
        </button>
      {/each}
    </Popover.Content>
  </Popover.Root>
{/if}
