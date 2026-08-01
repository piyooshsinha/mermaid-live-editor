<script lang="ts">
  /**
   * Renders a saved diagram to an inline SVG preview.
   *
   * Mermaid renders are sequenced through a shared queue rather than fired in
   * parallel: mermaid keeps module-level state per render and concurrent calls
   * on the same page interfere with each other, producing blank or swapped
   * thumbnails. One at a time is also easier on the main thread when a
   * dashboard shows many cards.
   */
  import { render } from '$/util/mermaid';
  import type { MermaidConfig } from 'mermaid';
  import uniqueID from 'lodash-es/uniqueId';

  interface Props {
    code: string;
    config: string;
  }

  let { code, config }: Props = $props();

  let svg = $state('');
  let failed = $state(false);

  // Shared tail so every thumbnail on the page renders in turn.
  let queue = Promise.resolve();

  const renderThumbnail = async () => {
    try {
      const parsed = JSON.parse(config || '{}') as MermaidConfig;
      const result = await render(
        // Thumbnails are decorative, so keep them cheap and non-interactive.
        { ...parsed, securityLevel: 'strict' },
        code,
        uniqueID('thumb-')
      );
      svg = result.svg;
      failed = false;
    } catch {
      // A saved diagram can stop parsing if it was saved mid-edit.
      failed = true;
    }
  };

  $effect(() => {
    // Re-render whenever the source changes.
    const current = { code, config };
    queue = queue.then(() => (current.code ? renderThumbnail() : Promise.resolve()));
  });
</script>

<div
  class="flex h-40 items-center justify-center overflow-hidden rounded-t-lg border-b border-border bg-background p-3">
  {#if svg}
    <!-- Rendered by mermaid from the user's own saved source. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="thumb flex h-full w-full items-center justify-center">{@html svg}</div>
  {:else if failed}
    <span class="text-xs text-muted-foreground">Preview unavailable</span>
  {:else}
    <span class="text-xs text-muted-foreground">Rendering…</span>
  {/if}
</div>

<style>
  /* Scale whatever mermaid produced down into the card without distortion. */
  .thumb :global(svg) {
    max-width: 100%;
    max-height: 100%;
    height: auto;
  }
</style>
