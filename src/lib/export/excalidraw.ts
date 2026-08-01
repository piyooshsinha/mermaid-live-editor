/**
 * Excalidraw scene export.
 *
 * Unlike the draw.io and PlantUML exporters, this one reads the *rendered*
 * geometry rather than re-laying out the graph. Excalidraw has no auto-layout,
 * so a scene that did not preserve Mermaid's positions would open as a heap of
 * overlapping boxes. Reading the SVG keeps the diagram looking like the one the
 * user just built, while still producing real editable shapes rather than an
 * embedded image.
 */

import { STRUCTURAL_TYPES } from './parse';
import type { ExportContext, ExportResult, Exporter } from './types';

interface ExcalidrawElement {
  [key: string]: unknown;
  height: number;
  id: string;
  type: string;
  width: number;
  x: number;
  y: number;
}

/**
 * Deterministic PRNG, so exporting the same diagram twice yields an identical
 * file (Excalidraw needs a `seed` per element but does not care about entropy).
 */
const makeSeeder = () => {
  let state = 0x2f6e_2b1;
  return () => {
    state = (state * 1_103_515_245 + 12_345) & 0x7fff_ffff;
    return state;
  };
};

const BASE = {
  angle: 0,
  backgroundColor: 'transparent',
  boundElements: null,
  fillStyle: 'solid',
  frameId: null,
  groupIds: [] as string[],
  isDeleted: false,
  link: null,
  locked: false,
  opacity: 100,
  roughness: 1,
  roundness: null,
  strokeColor: '#1e1e1e',
  strokeStyle: 'solid',
  strokeWidth: 2,
  updated: 1,
  version: 1,
  versionNonce: 1
};

/** Absolute bounding box of an SVG node relative to the root SVG's viewBox. */
const boxOf = (element: SVGGraphicsElement, root: SVGSVGElement): DOMRect | undefined => {
  try {
    const rootMatrix = root.getScreenCTM();
    const matrix = element.getScreenCTM();
    if (!rootMatrix || !matrix) {
      return undefined;
    }
    const bbox = element.getBBox();
    // Map the local bbox into the root's coordinate space.
    const relative = rootMatrix.inverse().multiply(matrix);
    const topLeft = new DOMPoint(bbox.x, bbox.y).matrixTransform(relative);
    const bottomRight = new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(
      relative
    );
    return new DOMRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  } catch {
    // getBBox throws for elements that were never laid out.
    return undefined;
  }
};

/** Picks the Excalidraw primitive that best matches the rendered SVG shape. */
const shapeOf = (node: Element): 'diamond' | 'ellipse' | 'rectangle' => {
  if (node.querySelector('polygon')) {
    return 'diamond';
  }
  if (node.querySelector('circle, ellipse')) {
    return 'ellipse';
  }
  return 'rectangle';
};

const labelOf = (node: Element): string =>
  (node.querySelector('.nodeLabel, .label text, foreignObject')?.textContent ?? '').trim();

const buildScene = (svg: SVGSVGElement): ExcalidrawElement[] => {
  const seed = makeSeeder();
  const elements: ExcalidrawElement[] = [];

  const nodes = [...svg.querySelectorAll<SVGGElement>('g.node')];
  for (const [index, node] of nodes.entries()) {
    const box = boxOf(node, svg);
    if (!box || box.width <= 0) {
      continue;
    }
    const id = `node-${index}`;
    const label = labelOf(node);
    const textId = `${id}-text`;

    elements.push({
      ...BASE,
      backgroundColor: '#ffffff',
      boundElements: label ? [{ id: textId, type: 'text' }] : null,
      height: box.height,
      id,
      seed: seed(),
      type: shapeOf(node),
      width: box.width,
      x: box.x,
      y: box.y
    });

    if (label) {
      const fontSize = 16;
      elements.push({
        ...BASE,
        // Bound text is centred by Excalidraw; containerId does the layout.
        containerId: id,
        fontFamily: 1,
        fontSize,
        height: fontSize * 1.25,
        id: textId,
        lineHeight: 1.25,
        originalText: label,
        seed: seed(),
        text: label,
        textAlign: 'center',
        type: 'text',
        verticalAlign: 'middle',
        width: Math.max(20, label.length * fontSize * 0.6),
        x: box.x,
        y: box.y + box.height / 2 - fontSize * 0.625
      });
    }
  }

  const edges = [...svg.querySelectorAll<SVGPathElement>('g.edgePaths path, path.flowchart-link')];
  for (const [index, edge] of edges.entries()) {
    const box = boxOf(edge, svg);
    if (!box) {
      continue;
    }
    // Sample the real path so multi-segment edges keep their bends instead of
    // collapsing into a straight line between endpoints.
    let points: number[][] = [
      [0, 0],
      [box.width, box.height]
    ];
    try {
      const length = edge.getTotalLength();
      if (length > 0) {
        const steps = Math.min(12, Math.max(2, Math.round(length / 40)));
        const start = edge.getPointAtLength(0);
        points = Array.from({ length: steps + 1 }, (_, step) => {
          const point = edge.getPointAtLength((length * step) / steps);
          return [point.x - start.x, point.y - start.y];
        });
      }
    } catch {
      // Fall back to the bounding-box diagonal computed above.
    }

    elements.push({
      ...BASE,
      endArrowhead: 'arrow',
      height: box.height,
      id: `edge-${index}`,
      points,
      seed: seed(),
      startArrowhead: null,
      type: 'arrow',
      width: box.width,
      x: box.x,
      y: box.y
    });
  }

  return elements;
};

const run = async ({ svg }: ExportContext): Promise<ExportResult> => {
  const elements = buildScene(svg);
  if (elements.length === 0) {
    throw new Error('Could not read any shapes from the rendered diagram.');
  }
  const scene = {
    appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
    elements,
    files: {},
    source: 'mermaid-live-editor',
    type: 'excalidraw',
    version: 2
  };
  return {
    blob: new Blob([JSON.stringify(scene, undefined, 2)], { type: 'application/json' }),
    extension: 'excalidraw'
  };
};

export const excalidrawExporter: Exporter = {
  description: 'Editable Excalidraw scene, preserving the current layout.',
  extension: 'excalidraw',
  id: 'excalidraw',
  label: 'Excalidraw',
  run,
  supports: (diagramType) =>
    STRUCTURAL_TYPES.has(diagramType) ||
    `Excalidraw export supports flowchart and sequence diagrams; this is a ${diagramType} diagram.`
};
