<script lang="ts">
  /**
   * Switches between Mermaid-owned layout and manually positioned nodes.
   *
   * The manual arrangement is stored as a `%%` comment in the diagram source,
   * so turning this off is an edit to the text like any other: it lands in
   * undo history, travels with the file, and other Mermaid renderers ignore it.
   *
   * Turning it off snapshots wherever Mermaid currently placed the nodes, so
   * the diagram does not jump. Turning it on removes the comment and hands
   * layout back to Mermaid.
   */
  import { captureLayout } from '$/canvas/applyLayout';
  import { clearSelection } from '$/canvas/interaction.svelte';
  import { readLayout, writeLayout } from '$/canvas/layoutComment';
  import { Switch } from '$/components/ui/switch';
  import { updateCode, validatedState } from '$/util/state.svelte';
  import LayoutDirectionMenu from './LayoutDirectionMenu.svelte';

  const isAuto = $derived(readLayout(validatedState.current.code) === undefined);

  const onChange = (next: boolean) => {
    const code = validatedState.current.code;
    if (next) {
      clearSelection();
      updateCode(writeLayout(code, undefined), { updateDiagram: true });
      return;
    }
    const svg = document.querySelector<SVGSVGElement>('#container svg');
    updateCode(
      writeLayout(code, {
        edgeWaypoints: {},
        nodePositions: svg ? captureLayout(svg) : {}
      }),
      { updateDiagram: true }
    );
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
  <!-- Direction only means anything while Mermaid owns the layout. -->
  {#if isAuto}
    <span class="mx-1 h-5 w-px bg-border"></span>
    <LayoutDirectionMenu />
  {/if}
</div>
