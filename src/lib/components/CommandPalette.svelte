<script lang="ts">
  /**
   * ⌘K command palette.
   *
   * Keyboard-first: the list is never empty-handed, arrows wrap, and Enter runs
   * the highlighted command. The registry is rebuilt on each open so commands
   * reflect the diagram currently on screen — which style is active, which
   * exports the diagram type supports.
   *
   * Unsupported exports stay listed and disabled with their reason rather than
   * being hidden, so a missing command never looks like a bug.
   */
  import { buildCommands, type Command, type CommandGroup } from '$/commands/registry.svelte';
  import { closePalette, openPalette, palette } from '$/commands/palette.svelte';
  import { rank } from '$/commands/search';
  import { cn } from '$/utils';
  import { tick } from 'svelte';
  import SearchIcon from '~icons/material-symbols/search-rounded';

  let { onOpenPanel }: { onOpenPanel: (panel: 'ai' | 'library') => void } = $props();

  let query = $state('');
  let activeIndex = $state(0);
  let commands = $state<Command[]>([]);
  let input = $state<HTMLInputElement>();
  let listElement = $state<HTMLDivElement>();

  const results = $derived(rank(commands, query).map((hit) => hit.item));

  /** Group headings, in registry order, for the rendered list. */
  const grouped = $derived.by(() => {
    const groups: { items: Command[]; name: CommandGroup }[] = [];
    for (const command of results) {
      const existing = groups.find((group) => group.name === command.group);
      if (existing) {
        existing.items.push(command);
      } else {
        groups.push({ items: [command], name: command.group });
      }
    }
    return groups;
  });

  const open = $derived(palette.isOpen);

  /** Rebuild on each open so commands reflect the diagram currently on screen. */
  $effect(() => {
    if (!palette.isOpen) {
      return;
    }
    commands = buildCommands(onOpenPanel);
    query = '';
    activeIndex = 0;
    void tick().then(() => input?.focus());
  });

  const hide = () => {
    closePalette();
    query = '';
  };

  const runActive = async () => {
    const command = results[activeIndex];
    if (!command || command.disabledReason) {
      return;
    }
    // Close first: a command may open a dialog, and two overlays at once is
    // both ugly and a focus trap.
    hide();
    await command.run();
  };

  /** Keeps the highlighted row visible while arrowing through a long list. */
  const scrollActiveIntoView = async () => {
    await tick();
    listElement?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  const move = (delta: number) => {
    if (results.length === 0) {
      return;
    }
    // Wrapping means Up from the top reaches the last command, which is faster
    // than arrowing back down through everything.
    activeIndex = (activeIndex + delta + results.length) % results.length;
    void scrollActiveIntoView();
  };

  const onWindowKeydown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (open) {
        hide();
      } else {
        openPalette();
      }
    }
  };

  const onPaletteKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        move(1);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        move(-1);
        break;
      }
      case 'Enter': {
        event.preventDefault();
        void runActive();
        break;
      }
      case 'Escape': {
        event.preventDefault();
        hide();
        break;
      }
    }
  };

  // Typing a new query invalidates the old highlight position.
  $effect(() => {
    void query;
    activeIndex = 0;
  });

  /** Flat index of a command, so grouped rendering can still track selection. */
  const indexOf = (command: Command) => results.indexOf(command);
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
  <!-- Backdrop. Clicking it dismisses, matching every other palette. -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-sm"
    role="presentation"
    onclick={(event) => event.target === event.currentTarget && hide()}>
    <div
      class="flex max-h-[70vh] w-[min(42rem,92vw)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette">
      <div class="flex items-center gap-2.5 border-b border-border px-4">
        <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
        <input
          bind:this={input}
          bind:value={query}
          onkeydown={onPaletteKeydown}
          placeholder="Search styles, templates, exports…"
          aria-label="Search commands"
          class="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          data-testid="palette-input" />
        <kbd class="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          esc
        </kbd>
      </div>

      <div class="flex-1 overflow-y-auto p-1.5" bind:this={listElement}>
        {#each grouped as group (group.name)}
          <div
            class="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {group.name}
          </div>
          {#each group.items as command (command.id)}
            {@const index = indexOf(command)}
            <button
              class={cn(
                'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                command.disabledReason && 'cursor-not-allowed opacity-45',
                index === activeIndex && !command.disabledReason && 'bg-muted'
              )}
              data-active={index === activeIndex}
              data-testid="palette-item"
              disabled={!!command.disabledReason}
              title={command.disabledReason}
              onmousemove={() => (activeIndex = index)}
              onclick={runActive}>
              <command.icon class="size-4 shrink-0 text-muted-foreground" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm">{command.title}</span>
                {#if command.subtitle || command.disabledReason}
                  <span class="truncate text-xs text-muted-foreground">
                    {command.disabledReason ?? command.subtitle}
                  </span>
                {/if}
              </span>
              {#if command.badge}
                <span
                  class="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                  {command.badge}
                </span>
              {/if}
            </button>
          {/each}
        {:else}
          <p class="px-3 py-8 text-center text-sm text-muted-foreground">
            No commands match “{query}”.
          </p>
        {/each}
      </div>
    </div>
  </div>
{/if}
