<script lang="ts">
  import Actions from '$/components/Actions.svelte';
  import AIPanel from '$/components/AI/AIPanel.svelte';
  import AutoLayoutToggle from '$/components/Canvas/AutoLayoutToggle.svelte';
  import CanvasToolbar from '$/components/Canvas/CanvasToolbar.svelte';
  import { openPalette } from '$/commands/palette.svelte';
  import CommandPalette from '$/components/CommandPalette.svelte';
  import Card from '$/components/Card/Card.svelte';
  import DiagramDocButton from '$/components/DiagramDocumentationButton.svelte';
  import Editor from '$/components/Editor.svelte';
  import History from '$/components/History/History.svelte';
  import { startAutoSave } from '$/components/History/historyState.svelte';
  import DiagramLibrary from '$/components/Library/DiagramLibrary.svelte';
  import EditorChooserModal from '$/components/migration/EditorChooserModal.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import PanZoomToolbar from '$/components/PanZoomToolbar.svelte';
  import Preset from '$/components/Preset.svelte';
  import Share from '$/components/Share.svelte';
  import SyncRoughToolbar from '$/components/SyncRoughToolbar.svelte';
  import StylePicker from '$/components/Styles/StylePicker.svelte';
  import Templates from '$/components/Templates.svelte';
  import * as Resizable from '$/components/ui/resizable';
  import { Switch } from '$/components/ui/switch';
  import { Toggle } from '$/components/ui/toggle';
  import VersionSecurityToolbar from '$/components/VersionSecurityToolbar.svelte';
  import View from '$/components/View.svelte';
  import type { EditorMode, Tab } from '$/types';
  import { shouldShowEditorChooser } from '$/util/migration/domainMigration';
  import { PanZoomState } from '$/util/panZoom';
  import { validatedState, updateCodeStore } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import { initHandler } from '$/util/util';
  import { onMount } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import SearchIcon from '~icons/material-symbols/search-rounded';
  import HistoryIcon from '~icons/material-symbols/history';
  import GearIcon from '~icons/material-symbols/settings-outline-rounded';

  const panZoomState = new PanZoomState();

  const tabSelectHandler = (tab: Tab) => {
    const editorMode: EditorMode = tab.id === 'code' ? 'code' : 'config';
    updateCodeStore({ editorMode });
  };

  const editorTabs: Tab[] = [
    {
      icon: CodeIcon,
      id: 'code',
      title: 'Code'
    },
    {
      icon: GearIcon,
      id: 'config',
      title: 'Config'
    }
  ];

  let width = $state(0);
  let isMobile = $derived(width < 640);
  let isViewMode = $state(true);
  let showEditorChooser = $state(false);

  onMount(async () => {
    showEditorChooser = shouldShowEditorChooser();
    await initHandler();
    window.addEventListener('appinstalled', () => {
      logEvent('pwaInstalled', { isMobile });
    });
  });

  // Record the Timeline for the whole session, not just while the panel is open.
  onMount(() => startAutoSave());

  let isHistoryOpen = $state(false);

  /**
   * How the palette reaches panels that own their own visibility.
   *
   * The AI card is always mounted and the library is a dialog behind its own
   * trigger, so rather than lifting both components' state into this page the
   * palette drives the affordances they already expose. Keeps the palette a
   * way to reach features, not a second owner of their state.
   */
  const openPanel = (panel: 'ai' | 'library') => {
    if (panel === 'library') {
      document.querySelector<HTMLButtonElement>('[data-testid="open-library"]')?.click();
      return;
    }
    const prompt = document.querySelector<HTMLTextAreaElement>('[data-testid="ai-prompt"]');
    prompt?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    prompt?.focus();
  };

  let editorPane: Resizable.Pane | undefined;
  $effect(() => {
    if (isMobile) {
      editorPane?.resize(50);
    }
  });
</script>

<div class="flex h-full flex-col overflow-hidden">
  {#snippet mobileToggle()}
    <div class="flex items-center gap-2">
      Edit <Switch
        id="editorMode"
        class="data-[state=checked]:bg-accent"
        bind:checked={isViewMode}
        onclick={() => {
          logEvent('mobileViewToggle');
        }} /> View
    </div>
  {/snippet}

  <Navbar mobileToggle={isMobile ? mobileToggle : undefined}>
    <!-- A shortcut nobody knows about may as well not exist, so the palette
         advertises itself. Hidden on mobile, where there is no ⌘K to press. -->
    <button
      class="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
      onclick={openPalette}
      title="Command palette"
      data-testid="palette-trigger">
      <SearchIcon class="size-3.5" />
      <span>Search</span>
      <kbd class="rounded border border-border px-1 py-px font-sans text-[10px]">⌘K</kbd>
    </button>
    <Toggle bind:pressed={isHistoryOpen} size="sm" title="History" aria-label="History">
      <HistoryIcon />
    </Toggle>
    <Share />
    <!-- Saves to the local IndexedDB library instead of handing the diagram
         to mermaid.ai. -->
    <DiagramLibrary />
  </Navbar>

  <div class="flex flex-1 flex-col overflow-hidden" bind:clientWidth={width}>
    <div
      class={[
        'size-full',
        isMobile && ['w-[200%] duration-300', isViewMode && '-translate-x-1/2']
      ]}>
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class="gap-4 p-2 pt-0 sm:gap-0 sm:p-6 sm:pt-0">
        <Resizable.Pane bind:this={editorPane} defaultSize={30} minSize={15}>
          <!-- Scrolls as a column so the added panels can never squeeze the
               editor down to its header. -->
          <div class="flex h-full flex-col gap-4 overflow-x-hidden overflow-y-auto sm:gap-6">
            <div class="flex min-h-64 flex-1 shrink-0 flex-col">
              <Card
                onselect={tabSelectHandler}
                isOpen
                tabs={editorTabs}
                activeTabID={validatedState.current.editorMode}
                isClosable={false}>
                {#snippet actions()}
                  <DiagramDocButton />
                {/snippet}
                <Editor {isMobile} />
              </Card>
            </div>

            <div class="shrink-0"><AIPanel /></div>

            <div class="group flex shrink-0 flex-wrap justify-between gap-4 sm:gap-6">
              <Preset />
              <Templates />
              <StylePicker />
              <Actions />
            </div>
          </div>
        </Resizable.Pane>
        <Resizable.Handle class="mr-1 hidden opacity-0 sm:block" />
        <Resizable.Pane minSize={15} class="relative flex h-full flex-1 flex-col overflow-hidden">
          <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
          <div class="absolute bottom-0 left-1/2 z-10 -translate-x-1/2"><AutoLayoutToggle /></div>
          <div class="absolute top-0 right-0"><PanZoomToolbar {panZoomState} /></div>
          <div class="absolute right-0 bottom-0"><VersionSecurityToolbar /></div>
          <div class="absolute bottom-0 left-0 sm:left-5"><SyncRoughToolbar /></div>
        </Resizable.Pane>
        {#if isHistoryOpen}
          <Resizable.Handle class="ml-1 hidden opacity-0 sm:block" />
          <Resizable.Pane minSize={15} defaultSize={30} class="hidden h-full grow flex-col sm:flex">
            <History />
          </Resizable.Pane>
        {/if}
      </Resizable.PaneGroup>
    </div>
  </div>
</div>

<!-- Fixed-position, so it is anchored to the selection rather than clipped by
     the diagram pane's overflow. -->
<CanvasToolbar />

<CommandPalette onOpenPanel={openPanel} />

<EditorChooserModal bind:open={showEditorChooser} />
