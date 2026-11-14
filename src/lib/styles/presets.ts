/**
 * Curated diagram styles.
 *
 * A style is nothing but Mermaid config, which is the whole reason this works:
 * `State.mermaid` already holds that config, so a style travels in the URL
 * hash, the saved library, and undo history without a single new field. The
 * diagram file stays the source of truth for how the diagram looks.
 *
 * Each preset pairs `themeVariables` with the two things Mermaid config cannot
 * express — whether to render hand-drawn, and whether the dotted canvas grid
 * helps or fights the look.
 */

export interface StylePreset {
  /** Dotted canvas grid. Off for styles that supply their own surface. */
  grid: boolean;
  id: string;
  name: string;
  /** Rendered through roughjs for a sketched, hand-drawn look. */
  rough: boolean;
  /** Swatch colours for the picker: surface, node, stroke, accent. */
  swatch: [string, string, string, string];
  /** One line on when to reach for it. */
  tagline: string;
  /** Mermaid `themeVariables`, applied on top of the `base` theme. */
  variables: Record<string, string>;
}

const HAND = "'Architects Daughter', 'Comic Sans MS', cursive";
const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const SANS = "'Recursive Variable', ui-sans-serif, system-ui, sans-serif";

export const stylePresets: StylePreset[] = [
  {
    grid: true,
    id: 'sketch',
    name: 'Sketch',
    rough: true,
    swatch: ['#fdfcf8', '#fff8e7', '#1e1b16', '#e07a5f'],
    tagline: 'Hand-drawn, like a photo of a whiteboard',
    variables: {
      background: '#fdfcf8',
      edgeLabelBackground: '#fdfcf8',
      fontFamily: HAND,
      fontSize: '17px',
      lineColor: '#4a4036',
      mainBkg: '#fff8e7',
      nodeBorder: '#1e1b16',
      primaryBorderColor: '#1e1b16',
      primaryColor: '#fff8e7',
      primaryTextColor: '#1e1b16',
      secondaryColor: '#ffe8cc',
      tertiaryColor: '#f4efe4'
    }
  },
  {
    grid: false,
    id: 'blueprint',
    name: 'Blueprint',
    rough: false,
    swatch: ['#0d2a4a', '#123a63', '#8fd0ff', '#4fc3f7'],
    tagline: 'Technical drawing on drafting paper',
    variables: {
      background: '#0d2a4a',
      edgeLabelBackground: '#123a63',
      fontFamily: MONO,
      fontSize: '14px',
      lineColor: '#8fd0ff',
      mainBkg: '#123a63',
      nodeBorder: '#8fd0ff',
      primaryBorderColor: '#8fd0ff',
      primaryColor: '#123a63',
      primaryTextColor: '#e8f4ff',
      secondaryColor: '#1b4b7d',
      tertiaryColor: '#16406b'
    }
  },
  {
    grid: false,
    id: 'minimal',
    name: 'Minimal',
    rough: false,
    swatch: ['#ffffff', '#fafafa', '#18181b', '#71717a'],
    tagline: 'Thin lines and air — built for slides',
    variables: {
      background: '#ffffff',
      edgeLabelBackground: '#ffffff',
      fontFamily: SANS,
      fontSize: '15px',
      lineColor: '#a1a1aa',
      mainBkg: '#fafafa',
      nodeBorder: '#d4d4d8',
      primaryBorderColor: '#d4d4d8',
      primaryColor: '#fafafa',
      primaryTextColor: '#18181b',
      secondaryColor: '#f4f4f5',
      tertiaryColor: '#fafafa'
    }
  },
  {
    grid: true,
    id: 'midnight',
    name: 'Midnight',
    rough: false,
    swatch: ['#0b0f19', '#171e2e', '#a5b4fc', '#818cf8'],
    tagline: 'Dark surface with one vivid accent',
    variables: {
      background: '#0b0f19',
      edgeLabelBackground: '#171e2e',
      fontFamily: SANS,
      fontSize: '15px',
      lineColor: '#818cf8',
      mainBkg: '#171e2e',
      nodeBorder: '#4f46e5',
      primaryBorderColor: '#4f46e5',
      primaryColor: '#171e2e',
      primaryTextColor: '#e0e7ff',
      secondaryColor: '#1e293b',
      tertiaryColor: '#131a28'
    }
  },
  {
    grid: false,
    id: 'notebook',
    name: 'Notebook',
    rough: true,
    swatch: ['#fbf9f2', '#ffffff', '#2d3142', '#4f5d75'],
    tagline: 'Pencil on paper, for thinking out loud',
    variables: {
      background: '#fbf9f2',
      edgeLabelBackground: '#fbf9f2',
      fontFamily: HAND,
      fontSize: '17px',
      lineColor: '#2d3142',
      mainBkg: '#ffffff',
      nodeBorder: '#2d3142',
      primaryBorderColor: '#2d3142',
      primaryColor: '#ffffff',
      primaryTextColor: '#2d3142',
      secondaryColor: '#eef0f4',
      tertiaryColor: '#f7f5ee'
    }
  },
  {
    grid: true,
    id: 'pastel',
    name: 'Pastel',
    rough: false,
    swatch: ['#fdfbff', '#e9e3ff', '#5b4b8a', '#b39ddb'],
    tagline: 'Soft and friendly, good for onboarding docs',
    variables: {
      background: '#fdfbff',
      edgeLabelBackground: '#fdfbff',
      fontFamily: SANS,
      fontSize: '15px',
      lineColor: '#9a86c4',
      mainBkg: '#e9e3ff',
      nodeBorder: '#b39ddb',
      primaryBorderColor: '#b39ddb',
      primaryColor: '#e9e3ff',
      primaryTextColor: '#4a3b73',
      secondaryColor: '#d8f3f0',
      tertiaryColor: '#ffe9f3'
    }
  },
  {
    grid: false,
    id: 'terminal',
    name: 'Terminal',
    rough: false,
    swatch: ['#0a0e0a', '#11200f', '#4ade80', '#22c55e'],
    tagline: 'Phosphor green, for infra and pipelines',
    variables: {
      background: '#0a0e0a',
      edgeLabelBackground: '#11200f',
      fontFamily: MONO,
      fontSize: '14px',
      lineColor: '#4ade80',
      mainBkg: '#11200f',
      nodeBorder: '#22c55e',
      primaryBorderColor: '#22c55e',
      primaryColor: '#11200f',
      primaryTextColor: '#bbf7d0',
      secondaryColor: '#14321a',
      tertiaryColor: '#0f1a0f'
    }
  }
];

export const presetById = (id: string): StylePreset | undefined =>
  stylePresets.find((preset) => preset.id === id);
