<script lang="ts">
  /**
   * The style gallery.
   *
   * Picking a style writes Mermaid config plus the two things config cannot
   * carry — hand-drawn rendering and the canvas grid. All three go through
   * `updateCodeStore` in one call, so a style change is a single undo step and
   * a single re-render rather than three.
   */
  import Card from '$/components/Card/Card.svelte';
  import { activePresetId, applyPreset, clearPreset } from '$/styles/apply';
  import { stylePresets, type StylePreset } from '$/styles/presets';
  import { updateCodeStore, validatedState } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import { cn } from '$/utils';
  import StylePreview from './StylePreview.svelte';
  import PaletteIcon from '~icons/material-symbols/palette-outline';

  const activeId = $derived(activePresetId(validatedState.current.mermaid));

  const choose = (preset: StylePreset) => {
    if (activeId === preset.id) {
      // Clicking the active style clears it, so there is a way back to
      // Mermaid's own theming without hunting through the config tab.
      updateCodeStore({
        mermaid: clearPreset(validatedState.current.mermaid),
        rough: false,
        updateDiagram: true
      });
      return;
    }
    updateCodeStore({
      grid: preset.grid,
      mermaid: applyPreset(validatedState.current.mermaid, preset),
      rough: preset.rough,
      updateDiagram: true
    });
    logEvent('applyStyle', { styleId: preset.id });
  };
</script>

<Card title="Styles" isStackable icon={{ component: PaletteIcon }}>
  <div class="grid min-w-80 grid-cols-2 gap-2 p-3">
    {#each stylePresets as preset (preset.id)}
      <button
        class={cn(
          'group flex flex-col overflow-hidden rounded-lg border text-left transition-all',
          'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none',
          activeId === preset.id
            ? 'border-accent ring-2 ring-accent/30'
            : 'border-border hover:border-accent/50'
        )}
        onclick={() => choose(preset)}
        title={preset.tagline}
        aria-pressed={activeId === preset.id}
        data-testid="style-{preset.id}">
        <div class="h-12 w-full border-b border-border/60">
          <StylePreview {preset} />
        </div>
        <div class="flex items-center justify-between gap-1 px-2 py-1.5">
          <span class="text-xs font-medium">{preset.name}</span>
          {#if preset.rough}
            <span
              class="rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground"
              title="Rendered hand-drawn">
              sketch
            </span>
          {/if}
        </div>
      </button>
    {/each}
  </div>
  <p class="px-3 pb-3 text-xs text-muted-foreground">
    Styles are saved with the diagram and travel in its share link.
  </p>
</Card>
