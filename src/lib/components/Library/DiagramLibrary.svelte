<script lang="ts">
  /**
   * Local diagram library: the replacement for the mermaid.ai "Save diagram"
   * flow. Saving keeps the diagram on this machine (IndexedDB) rather than
   * sending it to a third-party service.
   */
  import { Button } from '$/components/ui/button';
  import * as Dialog from '$/components/ui/dialog';
  import { Input } from '$/components/ui/input';
  import {
    deleteDiagram,
    draftOf,
    isStorageAvailable,
    listDiagrams,
    saveDiagram,
    updateDiagram,
    type SavedDiagram
  } from '$/storage/diagrams';
  import { updateCodeStore, validatedState } from '$/util/state.svelte';
  import dayjs from 'dayjs';
  import DeleteIcon from '~icons/material-symbols/delete-outline-rounded';
  import SaveIcon from '~icons/material-symbols/save-outline-rounded';

  let open = $state(false);
  let diagrams = $state<SavedDiagram[]>([]);
  let name = $state('');
  let error = $state('');
  /** Set once a diagram has been saved or opened, enabling in-place updates. */
  let currentId = $state<string | undefined>();

  const refresh = async () => {
    try {
      diagrams = await listDiagrams();
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
    }
  };

  const onOpenChange = (next: boolean) => {
    open = next;
    if (next) {
      error = '';
      void refresh();
    }
  };

  /** The layout fields travel with the diagram, or a manual arrangement is lost. */
  const currentDraft = () => {
    const { autoLayout, code, mermaid, nodePositions } = validatedState.current;
    return { autoLayout, code, mermaid, nodePositions };
  };

  const save = async () => {
    error = '';
    try {
      const record = await saveDiagram(name, currentDraft());
      currentId = record.id;
      name = '';
      await refresh();
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
    }
  };

  const overwrite = async () => {
    if (!currentId) {
      return;
    }
    error = '';
    const { autoLayout, code, mermaid, nodePositions } = currentDraft();
    try {
      await updateDiagram(currentId, { autoLayout, code, config: mermaid, nodePositions });
      await refresh();
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
    }
  };

  const load = (diagram: SavedDiagram) => {
    currentId = diagram.id;
    // Restores config and layout as well as code, so a saved diagram reopens
    // exactly as it was rather than picking up the current theme or falling
    // back to Mermaid's layout over a manual arrangement.
    updateCodeStore({ ...draftOf(diagram), updateDiagram: true });
    open = false;
  };

  const remove = async (diagram: SavedDiagram) => {
    error = '';
    try {
      await deleteDiagram(diagram.id);
      if (currentId === diagram.id) {
        currentId = undefined;
      }
      await refresh();
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
    }
  };

  const available = isStorageAvailable();
</script>

<Button variant="accent" size="sm" onclick={() => onOpenChange(true)} data-testid="open-library">
  <SaveIcon />
  Save diagram
</Button>

<Dialog.Root bind:open onOpenChange={(next) => onOpenChange(next)}>
  <Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>My diagrams</Dialog.Title>
      <Dialog.Description>
        Saved in this browser. Nothing is uploaded — use Share to send a link.
      </Dialog.Description>
    </Dialog.Header>

    {#if available}
      <div class="flex items-end gap-2 py-2">
        <label class="flex flex-1 flex-col gap-1.5 text-sm">
          <span class="font-medium">Save current diagram as</span>
          <Input
            bind:value={name}
            placeholder="e.g. Checkout flow"
            onkeydown={(event) => event.key === 'Enter' && save()}
            data-testid="library-name" />
        </label>
        <Button onclick={save} data-testid="library-save">Save</Button>
        {#if currentId}
          <Button variant="outline" onclick={overwrite}>Update</Button>
        {/if}
      </div>

      {#if error}
        <p class="text-xs text-destructive" data-testid="library-error">{error}</p>
      {/if}

      <div class="flex flex-col divide-y divide-border rounded-lg border border-border">
        {#each diagrams as diagram (diagram.id)}
          <div class="flex items-center gap-2 px-3 py-2">
            <button
              class="flex flex-1 flex-col text-left"
              onclick={() => load(diagram)}
              data-testid="library-item">
              <span class="text-sm font-medium">{diagram.name}</span>
              <span class="text-xs text-muted-foreground">
                {dayjs(diagram.updatedAt).format('YYYY-MM-DD HH:mm')}
                {#if currentId === diagram.id}&middot; open{/if}
              </span>
            </button>
            <button
              class="text-muted-foreground hover:text-destructive"
              aria-label="Delete {diagram.name}"
              onclick={() => remove(diagram)}>
              <DeleteIcon class="size-4" />
            </button>
          </div>
        {:else}
          <p class="px-3 py-6 text-center text-sm text-muted-foreground">No saved diagrams yet.</p>
        {/each}
      </div>
    {:else}
      <p class="py-4 text-sm text-destructive">
        This browser has no IndexedDB available, so diagrams cannot be saved locally.
      </p>
    {/if}
  </Dialog.Content>
</Dialog.Root>
