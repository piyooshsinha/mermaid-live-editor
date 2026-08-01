<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { templateCategories, templatesByCategory, type Template } from '$/templates/registry';
  import { updateCode } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import TemplateIcon from '~icons/material-symbols/dashboard-customize-outline-rounded';

  const load = (template: Template) => {
    updateCode(template.code, { resetPanZoom: true, updateDiagram: true });
    logEvent('loadTemplate', { templateId: template.id });
  };
</script>

<Card title="Templates" isStackable icon={{ component: TemplateIcon }}>
  <div class="flex min-w-72 flex-col gap-4 p-3">
    {#each templateCategories as category (category)}
      <section class="flex flex-col gap-1.5">
        <h3 class="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {category}
        </h3>
        <div class="flex flex-col">
          {#each templatesByCategory(category) as template (template.id)}
            <!-- A full-width row rather than a pill: the description is what
                 tells someone whether a template fits, so it should be
                 readable without hovering. -->
            <button
              class="group flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              onclick={() => load(template)}
              data-testid="template-{template.id}">
              <span class="text-sm font-medium">{template.name}</span>
              <span class="text-xs leading-snug text-muted-foreground">
                {template.description}
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</Card>
