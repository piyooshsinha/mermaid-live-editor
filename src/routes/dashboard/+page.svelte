<script lang="ts">
  /**
   * Dashboard over the local diagram library.
   *
   * Everything here reads from IndexedDB, so it works offline and nothing
   * leaves the browser. Sections that would require a backend — "Shared with
   * you", team spaces, per-user accounts — are deliberately absent rather than
   * shown as empty shells that can never fill.
   */
  import DiagramThumbnail from '$/components/Library/DiagramThumbnail.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import {
    deleteDiagram,
    duplicateDiagram,
    listDiagrams,
    toggleFavorite,
    updateDiagram,
    type SavedDiagram
  } from '$/storage/diagrams';
  import { templates } from '$/templates/registry';
  import { updateCodeStore } from '$/util/state.svelte';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import dayjs from 'dayjs';
  import relativeTime from 'dayjs/plugin/relativeTime';
  import { onMount } from 'svelte';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import DuplicateIcon from '~icons/material-symbols/content-copy-outline-rounded';
  import RenameIcon from '~icons/material-symbols/edit-outline-rounded';
  import StarIcon from '~icons/material-symbols/star-outline-rounded';
  import StarFilledIcon from '~icons/material-symbols/star-rounded';
  import GridIcon from '~icons/material-symbols/grid-view-outline-rounded';
  import ListIcon from '~icons/material-symbols/format-list-bulleted';
  import PlusIcon from '~icons/material-symbols/add-rounded';
  import TemplateIcon from '~icons/material-symbols/dashboard-customize-outline-rounded';

  dayjs.extend(relativeTime);

  let diagrams = $state<SavedDiagram[]>([]);
  let query = $state('');
  let layout = $state<'grid' | 'list'>('grid');
  let loading = $state(true);

  const visible = $derived(
    diagrams.filter((diagram) => diagram.name.toLowerCase().includes(query.trim().toLowerCase()))
  );

  const refresh = async () => {
    diagrams = await listDiagrams();
    loading = false;
  };

  onMount(refresh);

  /** Loads a diagram into the editor state, then navigates to it. */
  const openDiagram = async (diagram: SavedDiagram) => {
    updateCodeStore({ code: diagram.code, mermaid: diagram.config, updateDiagram: true });
    await goto(resolve('/edit', {}));
  };

  const newDiagram = async (code = '') => {
    if (code) {
      updateCodeStore({ code, updateDiagram: true });
    }
    await goto(resolve('/edit', {}));
  };

  const remove = async (diagram: SavedDiagram, event: MouseEvent) => {
    event.stopPropagation();
    await deleteDiagram(diagram.id);
    await refresh();
  };

  const duplicate = async (diagram: SavedDiagram, event: MouseEvent) => {
    event.stopPropagation();
    await duplicateDiagram(diagram.id);
    await refresh();
  };

  const star = async (diagram: SavedDiagram, event: MouseEvent) => {
    event.stopPropagation();
    await toggleFavorite(diagram.id);
    await refresh();
  };

  const rename = async (diagram: SavedDiagram, event: MouseEvent) => {
    event.stopPropagation();
    const next = prompt('Rename diagram', diagram.name);
    if (next?.trim()) {
      await updateDiagram(diagram.id, { name: next.trim() });
      await refresh();
    }
  };
</script>

<svelte:head><title>Dashboard - Mermaid Live Editor</title></svelte:head>

<div class="flex h-full flex-col overflow-hidden">
  <Navbar>
    <!-- The primary "New diagram" action lives in the page header; this is
         just the way back to the editor. -->
    <Button variant="outline" size="sm" href={resolve('/edit', {})}>Open editor</Button>
  </Navbar>

  <div class="flex flex-1 overflow-hidden">
    <aside class="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 sm:flex">
      <span
        class="px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Your space
      </span>
      <a href={resolve('/dashboard', {})} class="rounded-lg bg-muted px-3 py-2 text-sm font-medium"
        >Dashboard</a>
      <a href={resolve('/edit', {})} class="rounded-lg px-3 py-2 text-sm hover:bg-muted/60"
        >Editor</a>

      <span
        class="mt-4 px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Storage
      </span>
      <p class="px-3 text-xs leading-relaxed text-muted-foreground">
        {diagrams.length}
        {diagrams.length === 1 ? 'diagram' : 'diagrams'} saved in this browser. Nothing is uploaded.
      </p>
    </aside>

    <main class="flex-1 overflow-y-auto p-6">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">Dashboard</h1>
        <div class="flex items-center gap-2">
          <Input
            bind:value={query}
            placeholder="Search diagrams"
            class="h-9 w-48"
            data-testid="dashboard-search" />
          <div class="flex rounded-lg border border-border">
            <button
              class={['rounded-l-lg p-2', layout === 'grid' && 'bg-muted']}
              aria-label="Grid view"
              onclick={() => (layout = 'grid')}><GridIcon class="size-4" /></button>
            <button
              class={['rounded-r-lg p-2', layout === 'list' && 'bg-muted']}
              aria-label="List view"
              onclick={() => (layout = 'list')}><ListIcon class="size-4" /></button>
          </div>
          <Button variant="accent" onclick={() => newDiagram()} data-testid="new-diagram">
            <PlusIcon /> New diagram
          </Button>
        </div>
      </div>

      <section class="mb-8">
        <h2 class="mb-3 text-sm font-semibold">Files</h2>
        {#if loading}
          <p class="text-sm text-muted-foreground">Loading…</p>
        {:else if visible.length === 0}
          <div class="rounded-xl border border-dashed border-border p-10 text-center">
            <p class="text-sm text-muted-foreground">
              {diagrams.length === 0
                ? 'No saved diagrams yet. Create one, then use Save diagram in the editor.'
                : 'No diagrams match that search.'}
            </p>
          </div>
        {:else if layout === 'grid'}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {#each visible as diagram (diagram.id)}
              <div
                class="group cursor-pointer overflow-hidden rounded-xl border border-border transition-shadow hover:shadow-md"
                role="button"
                tabindex="0"
                onclick={() => openDiagram(diagram)}
                onkeydown={(event) => event.key === 'Enter' && openDiagram(diagram)}
                data-testid="dashboard-card">
                <DiagramThumbnail code={diagram.code} config={diagram.config} />
                <div class="flex items-start justify-between gap-2 p-3">
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate text-sm font-medium">{diagram.name}</span>
                    <span class="text-xs text-muted-foreground">
                      Edited {dayjs(diagram.updatedAt).fromNow()}
                    </span>
                  </div>
                  <div
                    class="flex shrink-0 items-center gap-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      class={['hover:text-accent', diagram.favorite && 'text-accent opacity-100']}
                      aria-label="Favourite {diagram.name}"
                      onclick={(event) => star(diagram, event)}>
                      {#if diagram.favorite}<StarFilledIcon class="size-4" />{:else}
                        <StarIcon class="size-4" />
                      {/if}
                    </button>
                    <button
                      class="hover:text-foreground"
                      aria-label="Rename {diagram.name}"
                      onclick={(event) => rename(diagram, event)}>
                      <RenameIcon class="size-4" />
                    </button>
                    <button
                      class="hover:text-foreground"
                      aria-label="Duplicate {diagram.name}"
                      onclick={(event) => duplicate(diagram, event)}>
                      <DuplicateIcon class="size-4" />
                    </button>
                    <button
                      class="hover:text-destructive"
                      aria-label="Delete {diagram.name}"
                      onclick={(event) => remove(diagram, event)}>
                      <DeleteIcon class="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="flex flex-col divide-y divide-border rounded-xl border border-border">
            {#each visible as diagram (diagram.id)}
              <div class="flex items-center gap-3 px-4 py-3">
                <button
                  class="flex flex-1 flex-col text-left"
                  onclick={() => openDiagram(diagram)}
                  data-testid="dashboard-card">
                  <span class="text-sm font-medium">{diagram.name}</span>
                  <span class="text-xs text-muted-foreground">
                    Edited {dayjs(diagram.updatedAt).fromNow()}
                  </span>
                </button>
                <button
                  class="text-muted-foreground hover:text-destructive"
                  aria-label="Delete {diagram.name}"
                  onclick={(event) => remove(diagram, event)}>
                  <DeleteIcon class="size-4" />
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section>
        <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold">
          <TemplateIcon class="size-4" /> Start from a template
        </h2>
        <div class="flex flex-wrap gap-2">
          {#each templates.slice(0, 6) as template (template.id)}
            <button
              class="rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
              onclick={() => newDiagram(template.code)}>
              {template.name}
            </button>
          {/each}
        </div>
      </section>
    </main>
  </div>
</div>
