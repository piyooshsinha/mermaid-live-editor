<script lang="ts">
  /**
   * Floating toolbar anchored above the current canvas selection.
   *
   * Every action here ends up as a Mermaid source edit, because the diagram
   * text is the only place this state can live. Actions go through
   * `updateCode`, so they land in undo history and re-render like any typed
   * change.
   */
  import { deleteSelection, duplicateNode, setNodeStyle } from '$/canvas/edits';
  import { canvasSelection, clearSelection } from '$/canvas/interaction.svelte';
  import { buildSourceMap } from '$/canvas/sourceMap';
  import { updateCode, validatedState } from '$/util/state.svelte';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import DuplicateIcon from '~icons/material-symbols/content-copy-outline-rounded';
  import TextColorIcon from '~icons/material-symbols/format-color-text-rounded';

  const selection = $derived(canvasSelection.current);

  /** Toolbar sits just above the selection, clamped into the viewport. */
  const position = $derived.by(() => {
    if (!selection) {
      return undefined;
    }
    const { rect } = selection;
    const width = 260;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8
    );
    return { left, top: Math.max(8, rect.top - 56) };
  });

  const commit = (next: string) => {
    updateCode(next, { updateDiagram: true });
    clearSelection();
  };

  const applyStyle = (patch: Parameters<typeof setNodeStyle>[2]) => {
    if (selection?.kind !== 'node') {
      return;
    }
    commit(setNodeStyle(validatedState.current.code, selection.id, patch));
  };

  const onDelete = () => {
    if (!selection) {
      return;
    }
    const code = validatedState.current.code;
    commit(deleteSelection(code, buildSourceMap(code), selection));
  };

  const onDuplicate = () => {
    if (selection?.kind !== 'node') {
      return;
    }
    const code = validatedState.current.code;
    commit(duplicateNode(code, buildSourceMap(code), selection.id));
  };

  const FILLS = ['#ffffff', '#e0e7ff', '#dcfce7', '#fee2e2', '#fef9c3'];
  const STROKES = ['#1e293b', '#2563eb', '#16a34a', '#dc2626'];
</script>

{#if selection && position}
  <div
    class="fixed z-30 flex items-center gap-1 rounded-xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur"
    style="left: {position.left}px; top: {position.top}px;"
    data-testid="canvas-toolbar">
    {#if selection.kind === 'node'}
      <!-- Fill -->
      <div class="flex items-center gap-1" role="group" aria-label="Fill colour">
        {#each FILLS as fill (fill)}
          <button
            class="size-5 rounded-full border border-border transition-transform hover:scale-110"
            style="background: {fill};"
            aria-label="Fill {fill}"
            onclick={() => applyStyle({ fill })}></button>
        {/each}
      </div>
      <span class="mx-1 h-6 w-px bg-border"></span>

      <!-- Stroke -->
      <div class="flex items-center gap-1" role="group" aria-label="Border colour">
        {#each STROKES as stroke (stroke)}
          <button
            class="size-5 rounded-full border-2 bg-transparent transition-transform hover:scale-110"
            style="border-color: {stroke};"
            aria-label="Border {stroke}"
            onclick={() => applyStyle({ stroke })}></button>
        {/each}
      </div>
      <span class="mx-1 h-6 w-px bg-border"></span>

      <button
        class="rounded p-1.5 hover:bg-muted"
        aria-label="Label colour"
        title="Label colour"
        onclick={() => applyStyle({ color: '#1e293b' })}>
        <TextColorIcon class="size-4" />
      </button>
      <button
        class="rounded p-1.5 hover:bg-muted"
        aria-label="Duplicate"
        title="Duplicate"
        onclick={onDuplicate}
        data-testid="toolbar-duplicate">
        <DuplicateIcon class="size-4" />
      </button>
      <span class="mx-1 h-6 w-px bg-border"></span>
    {:else}
      <span class="px-2 text-xs text-muted-foreground">Connection</span>
      <span class="mx-1 h-6 w-px bg-border"></span>
    {/if}

    <button
      class="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Delete"
      title="Delete"
      onclick={onDelete}
      data-testid="toolbar-delete">
      <DeleteIcon class="size-4" />
    </button>
  </div>
{/if}
