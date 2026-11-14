<script lang="ts">
  /**
   * A miniature of what the style does, drawn as plain SVG.
   *
   * Deliberately not a real Mermaid render: seven live renders on open would
   * stall the picker, and the point here is to show the palette and the
   * lettering, which three boxes and an arrow convey instantly.
   */
  import type { StylePreset } from '$/styles/presets';

  let { preset }: { preset: StylePreset } = $props();

  const [surface, node, stroke, accent] = $derived(preset.swatch);
  // The hand-drawn presets get a wobbled path so the miniature reads as sketchy.
  const edge = $derived(preset.rough ? 'M34 20 q6 -3 10 1 t10 -1' : 'M34 20 h20');
</script>

<svg viewBox="0 0 108 40" class="h-full w-full" role="img" aria-label="{preset.name} preview">
  <rect width="108" height="40" fill={surface} />
  <rect
    x="6"
    y="11"
    width="28"
    height="18"
    rx={preset.rough ? 1 : 3}
    fill={node}
    {stroke}
    stroke-width={preset.rough ? 1.4 : 1} />
  <path d={edge} {stroke} stroke-width="1.2" fill="none" />
  <path d="M52 17 l5 3 -5 3 z" fill={stroke} />
  <rect
    x="60"
    y="11"
    width="28"
    height="18"
    rx={preset.rough ? 1 : 3}
    fill={accent}
    fill-opacity="0.22"
    stroke={accent}
    stroke-width={preset.rough ? 1.4 : 1} />
  <!-- Two short rules stand in for the label, in the preset's own text colour. -->
  <rect x="11" y="17" width="18" height="2" rx="1" fill={stroke} opacity="0.75" />
  <rect x="65" y="17" width="18" height="2" rx="1" fill={accent} opacity="0.9" />
</svg>
