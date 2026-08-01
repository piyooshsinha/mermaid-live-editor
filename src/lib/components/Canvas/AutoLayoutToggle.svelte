<script lang="ts">
  /**
   * Switches between Mermaid-owned layout and manually positioned nodes.
   *
   * Turning it off snapshots wherever Mermaid currently placed the nodes, so
   * the diagram does not jump: the user keeps the layout they were looking at
   * and starts dragging from there. Turning it back on discards the manual
   * coordinates and hands layout back to Mermaid.
   */
  import { captureLayout } from '$/canvas/applyLayout';
  import { clearSelection } from '$/canvas/interaction.svelte';
  import { Switch } from '$/components/ui/switch';
  import { updateCodeStore, validatedState } from '$/util/state.svelte';

  const isAuto = $derived(validatedState.current.autoLayout !== false);

  const onChange = (next: boolean) => {
    if (next) {
      clearSelection();
      updateCodeStore({ autoLayout: true, nodePositions: undefined });
      return;
    }
    const svg = document.querySelector<SVGSVGElement>('#container svg');
    updateCodeStore({
      autoLayout: false,
      nodePositions: svg ? captureLayout(svg) : {}
    });
  };
</script>

<div
  class="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-1.5 text-sm shadow-xs backdrop-blur">
  <span class="font-medium whitespace-nowrap">Auto-Layout</span>
  <Switch
    checked={isAuto}
    onCheckedChange={onChange}
    class="data-[state=checked]:bg-accent"
    aria-label="Toggle automatic layout"
    data-testid="auto-layout-toggle" />
</div>
