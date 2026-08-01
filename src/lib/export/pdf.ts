/**
 * Vector PDF export.
 *
 * Renders the SVG itself rather than a rasterized snapshot, so text stays
 * selectable and the diagram stays sharp at any zoom — which is the whole point
 * of handing a diagram to a document tool. jsPDF and svg2pdf are dynamically
 * imported so they only download when someone actually exports a PDF.
 */

import type { ExportContext, ExportResult, Exporter } from './types';

/** Reads the SVG's intrinsic size, preferring viewBox over layout size. */
const dimensions = (svg: SVGSVGElement): { height: number; width: number } => {
  const box = svg.viewBox?.baseVal;
  if (box && box.width > 0 && box.height > 0) {
    return { height: box.height, width: box.width };
  }
  const rect = svg.getBoundingClientRect();
  return { height: rect.height || 600, width: rect.width || 800 };
};

const run = async ({ svg }: ExportContext): Promise<ExportResult> => {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const { height, width } = dimensions(svg);

  const pdf = new jsPDF({
    format: [width, height],
    // Match the page to the diagram so nothing is cropped or letterboxed.
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'pt'
  });

  // svg2pdf needs the element in the document to resolve computed styles.
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  await svg2pdf(svg, pdf, { height, width, x: 0, y: 0 });

  return { blob: pdf.output('blob'), extension: 'pdf' };
};

export const pdfExporter: Exporter = {
  description: 'Vector PDF with selectable text. Works for every diagram type.',
  extension: 'pdf',
  id: 'pdf',
  label: 'PDF',
  run,
  supports: () => true
};
