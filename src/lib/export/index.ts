/**
 * Export registry and runner.
 *
 * The runner owns the one piece of setup every exporter needs: a cloned SVG
 * that is actually attached to the document. Both `getBBox()` (Excalidraw) and
 * `getComputedStyle()` (svg2pdf) return nothing for a detached element, so the
 * clone is mounted offscreen for the duration of the export and removed after.
 */

import dayjs from 'dayjs';
import { standardizeDiagramType } from '../util/mermaid';
import { validatedState } from '../util/state.svelte';
import { drawioExporter } from './drawio';
import { excalidrawExporter } from './excalidraw';
import { pdfExporter } from './pdf';
import { plantumlExporter } from './plantuml';
import type { Exporter } from './types';

export type { ExportContext, ExportResult, Exporter } from './types';

/** Registry order, which is also the order shown in the Actions panel. */
export const exporters: readonly Exporter[] = [
  pdfExporter,
  drawioExporter,
  excalidrawExporter,
  plantumlExporter
];

const fileName = (extension: string): string =>
  `mermaid-diagram-${dayjs().format('YYYY-MM-DD-HHmmss')}.${extension}`;

const download = (blob: Blob, name: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = name;
  anchor.href = url;
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Mounts a clone of the live diagram offscreen and hands it to `use`.
 * The clone is always removed, including when the exporter throws.
 */
const withMountedSVG = async <T>(use: (svg: SVGSVGElement) => Promise<T>): Promise<T> => {
  const source = document.querySelector<SVGSVGElement>('#container svg');
  if (!source) {
    throw new Error('No rendered diagram to export.');
  }
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const holder = document.createElement('div');
  // Offscreen rather than display:none, which would zero out every bounding box.
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;';
  holder.append(svg);
  document.body.append(holder);

  try {
    return await use(svg);
  } finally {
    holder.remove();
  }
};

/** Current diagram type, normalized to the names exporters check against. */
export const currentDiagramType = (): string =>
  standardizeDiagramType(validatedState.current.diagramType ?? '');

/**
 * Runs an exporter and downloads the result.
 * Throws with a user-readable message if the diagram type is unsupported.
 */
export const runExport = async (exporter: Exporter): Promise<void> => {
  const diagramType = currentDiagramType();
  const supported = exporter.supports(diagramType);
  if (supported !== true) {
    throw new Error(supported);
  }

  const result = await withMountedSVG((svg) =>
    exporter.run({ code: validatedState.current.code, diagramType, svg })
  );
  download(result.blob, fileName(result.extension));
};
