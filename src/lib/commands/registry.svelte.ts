/**
 * Everything the palette can do.
 *
 * Commands are built fresh each time the palette opens rather than held in a
 * module-level list, because most of them depend on current state: which style
 * is active, whether the diagram type supports a given export, whether AI is
 * configured. A stale registry would offer actions that no longer apply.
 *
 * Each command is a thin wrapper over an existing feature — the palette adds a
 * way to reach things, not a second implementation of them.
 */

import type { Component } from 'svelte';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { isConfigured } from '$/ai/config.svelte';
import { readDirection, setDirection, type LayoutDirection } from '$/canvas/edits';
import { captureLayout } from '$/canvas/applyLayout';
import { clearSelection } from '$/canvas/interaction.svelte';
import { readLayout, writeLayout } from '$/canvas/layoutComment';
import { exporters, runExport } from '$/export';
import { activePresetId, applyPreset, clearPreset } from '$/styles/apply';
import { stylePresets } from '$/styles/presets';
import { templates } from '$/templates/registry';
import { standardizeDiagramType } from '$/util/mermaid';
import { updateCode, updateCodeStore, validatedState } from '$/util/state.svelte';
import { logEvent } from '$/util/stats';
import DiagramIcon from '~icons/material-symbols/account-tree-outline-rounded';
import DirectionIcon from '~icons/material-symbols/swap-vert-rounded';
import ExportIcon from '~icons/material-symbols/download';
import LayoutIcon from '~icons/material-symbols/dashboard-outline-rounded';
import PaletteIcon from '~icons/material-symbols/palette-outline';
import TemplateIcon from '~icons/material-symbols/dashboard-customize-outline-rounded';

export type CommandGroup = 'Diagram' | 'Export' | 'Layout' | 'Style' | 'Template';

export interface Command {
  /** Shown on the right; purely informational. */
  badge?: string;
  /** Disabled commands stay listed with their reason, so the gap is explained. */
  disabledReason?: string;
  group: CommandGroup;
  icon: Component;
  id: string;
  keywords?: readonly string[];
  run: () => void | Promise<void>;
  subtitle?: string;
  title: string;
}

/** Commands the palette offers right now, given the diagram on screen. */
export const buildCommands = (open: (panel: 'ai' | 'library') => void): Command[] => {
  const commands: Command[] = [];
  const config = validatedState.current.mermaid;
  const code = validatedState.current.code;
  const activeStyle = activePresetId(config);

  // --- Styles -------------------------------------------------------------
  for (const preset of stylePresets) {
    commands.push({
      badge: activeStyle === preset.id ? 'Active' : undefined,
      group: 'Style',
      icon: PaletteIcon,
      id: `style:${preset.id}`,
      keywords: ['style', 'theme', 'look', preset.rough ? 'sketch' : 'clean'],
      run: () =>
        updateCodeStore({
          grid: preset.grid,
          mermaid: applyPreset(validatedState.current.mermaid, preset),
          rough: preset.rough,
          updateDiagram: true
        }),
      subtitle: preset.tagline,
      title: `Style: ${preset.name}`
    });
  }
  if (activeStyle) {
    commands.push({
      group: 'Style',
      icon: PaletteIcon,
      id: 'style:clear',
      keywords: ['reset', 'default', 'theme'],
      run: () =>
        updateCodeStore({
          mermaid: clearPreset(validatedState.current.mermaid),
          rough: false,
          updateDiagram: true
        }),
      subtitle: 'Hand appearance back to Mermaid',
      title: 'Clear style'
    });
  }

  // --- Layout -------------------------------------------------------------
  const manual = readLayout(code) !== undefined;
  commands.push({
    group: 'Layout',
    icon: LayoutIcon,
    id: 'layout:toggle',
    keywords: ['auto', 'manual', 'arrange', 'position'],
    run: () => {
      if (manual) {
        clearSelection();
        updateCode(writeLayout(code, undefined), { updateDiagram: true });
        return;
      }
      const svg = document.querySelector<SVGSVGElement>('#container svg');
      updateCode(
        writeLayout(code, { edgeWaypoints: {}, nodePositions: svg ? captureLayout(svg) : {} }),
        { updateDiagram: true }
      );
    },
    subtitle: manual ? 'Hand layout back to Mermaid' : 'Position nodes by hand',
    title: manual ? 'Turn on Auto-Layout' : 'Turn off Auto-Layout'
  });

  // Direction only exists for flowcharts, and only while Mermaid lays out.
  const direction = readDirection(code);
  if (direction && !manual) {
    const options: { label: string; value: LayoutDirection }[] = [
      { label: 'Top to bottom', value: 'TD' },
      { label: 'Bottom to top', value: 'BT' },
      { label: 'Left to right', value: 'LR' },
      { label: 'Right to left', value: 'RL' }
    ];
    for (const option of options.filter((candidate) => candidate.value !== direction)) {
      commands.push({
        group: 'Layout',
        icon: DirectionIcon,
        id: `direction:${option.value}`,
        keywords: ['direction', 'flow', 'orientation', 'rotate'],
        run: () => updateCode(setDirection(code, option.value), { updateDiagram: true }),
        title: `Flow ${option.label.toLowerCase()}`
      });
    }
  }

  // --- Export -------------------------------------------------------------
  const diagramType = standardizeDiagramType(validatedState.current.diagramType ?? '');
  for (const exporter of exporters) {
    const supported = exporter.supports(diagramType);
    commands.push({
      disabledReason: supported === true ? undefined : supported,
      group: 'Export',
      icon: ExportIcon,
      id: `export:${exporter.id}`,
      keywords: ['export', 'download', 'save as', exporter.extension],
      run: () => runExport(exporter),
      subtitle: exporter.description,
      title: `Export ${exporter.label}`
    });
  }

  // --- Templates ----------------------------------------------------------
  for (const template of templates) {
    commands.push({
      group: 'Template',
      icon: TemplateIcon,
      id: `template:${template.id}`,
      keywords: ['template', 'new', 'start', template.category.toLowerCase()],
      run: () => {
        updateCode(template.code, { resetPanZoom: true, updateDiagram: true });
        logEvent('loadTemplate', { templateId: template.id });
      },
      subtitle: template.description,
      title: `New: ${template.name}`
    });
  }

  // --- Diagram ------------------------------------------------------------
  commands.push(
    {
      group: 'Diagram',
      icon: DiagramIcon,
      id: 'ai:open',
      keywords: ['ai', 'generate', 'prompt', 'describe'],
      run: () => open('ai'),
      subtitle: isConfigured() ? 'Describe a change in words' : 'Set up a provider first',
      title: 'Ask AI'
    },
    {
      group: 'Diagram',
      icon: DiagramIcon,
      id: 'library:open',
      keywords: ['save', 'library', 'open', 'my diagrams'],
      run: () => open('library'),
      subtitle: 'Saved in this browser',
      title: 'My diagrams'
    },
    {
      group: 'Diagram',
      icon: DiagramIcon,
      id: 'nav:dashboard',
      keywords: ['dashboard', 'home', 'all'],
      run: () => goto(resolve('/dashboard', {})),
      title: 'Go to dashboard'
    }
  );

  return commands;
};
