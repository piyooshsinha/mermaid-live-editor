/**
 * Direct-manipulation layer for the rendered diagram.
 *
 * Selection visuals are drawn as SVG injected into the pan/zoom viewport rather
 * than as an HTML overlay, so they pan and zoom with the diagram for free and
 * all the maths stays in diagram coordinates. Only the floating toolbar needs
 * screen coordinates, and it gets those from `getBoundingClientRect`.
 */

import type { NodePosition } from '$/types';
import type { PanZoomState } from '$/util/panZoom';
import { nodeGroupFrom, nodeIdOf, readScene, type Scene, type SceneNode } from './scene';

export interface SelectionInfo {
  id: string;
  /** Screen-space box of the selected node, for anchoring the toolbar. */
  rect: DOMRect;
}

let selectedId = $state.raw<string | undefined>();
let selectionRect = $state.raw<DOMRect | undefined>();

export const canvasSelection = {
  get current(): SelectionInfo | undefined {
    return selectedId && selectionRect ? { id: selectedId, rect: selectionRect } : undefined;
  },
  get id(): string | undefined {
    return selectedId;
  }
};

const OVERLAY_CLASS = 'mpp-overlay';
const PADDING = 6;

/** Removes any overlay from a previous render. */
const clearOverlay = (svg: SVGSVGElement): void => {
  svg.querySelector(`.${OVERLAY_CLASS}`)?.remove();
};

const overlayLayer = (svg: SVGSVGElement): SVGGElement => {
  const existing = svg.querySelector<SVGGElement>(`.${OVERLAY_CLASS}`);
  if (existing) {
    return existing;
  }
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.setAttribute('class', OVERLAY_CLASS);
  layer.style.pointerEvents = 'none';
  // Inside the viewport group so it inherits the diagram's pan and zoom.
  const viewport = svg.querySelector('g.svg-pan-zoom_viewport') ?? svg.firstElementChild;
  viewport?.append(layer);
  return layer;
};

const drawSelection = (svg: SVGSVGElement, node: SceneNode | undefined): void => {
  const layer = overlayLayer(svg);
  layer.replaceChildren();
  if (!node) {
    return;
  }
  const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  box.setAttribute('x', String(node.x - node.width / 2 - PADDING));
  box.setAttribute('y', String(node.y - node.height / 2 - PADDING));
  box.setAttribute('width', String(node.width + PADDING * 2));
  box.setAttribute('height', String(node.height + PADDING * 2));
  box.setAttribute('rx', '4');
  box.setAttribute('fill', 'none');
  box.setAttribute('stroke', '#2563eb');
  box.setAttribute('stroke-width', '2');
  layer.append(box);
};

export interface CanvasOptions {
  /** Whether manual layout is on; dragging is disabled when it is not. */
  isManualLayout: () => boolean;
  onMove: (positions: Record<string, NodePosition>) => void;
  panZoomState: PanZoomState;
  /** Redraws edges live while a node is being dragged. */
  reflow: (scene: Scene) => void;
}

/**
 * Wires pointer handling onto a rendered diagram. Returns a teardown function;
 * `View.svelte` calls this after every render and disposes the previous one.
 */
export const attachCanvas = (svg: SVGSVGElement, options: CanvasOptions): (() => void) => {
  clearOverlay(svg);
  let scene = readScene(svg);
  // A plain record, not a Map: this is a static lookup index rebuilt on every
  // render, never reactive state.
  const byId: Record<string, SceneNode> = Object.fromEntries(
    scene.nodes.map((node) => [node.id, node])
  );

  let dragging: { node: SceneNode; originX: number; originY: number } | undefined;
  let pointerOrigin: { x: number; y: number } | undefined;

  const syncSelectionRect = () => {
    const node = selectedId ? byId[selectedId] : undefined;
    selectionRect = node?.element.getBoundingClientRect();
    drawSelection(svg, node);
  };

  /** Converts a client point into diagram coordinates. */
  const toDiagram = (clientX: number, clientY: number): { x: number; y: number } => {
    const matrix = svg.getScreenCTM();
    if (!matrix) {
      return { x: clientX, y: clientY };
    }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  const onPointerDown = (event: PointerEvent) => {
    const group = nodeGroupFrom(event.target);
    if (!group) {
      selectedId = undefined;
      syncSelectionRect();
      return;
    }
    const id = nodeIdOf(group);
    const node = id ? byId[id] : undefined;
    if (!node) {
      return;
    }

    selectedId = node.id;
    syncSelectionRect();

    if (!options.isManualLayout()) {
      return;
    }
    // Take over the gesture so svg-pan-zoom does not pan the canvas instead.
    event.stopPropagation();
    event.preventDefault();
    options.panZoomState.suspendPan();
    pointerOrigin = toDiagram(event.clientX, event.clientY);
    dragging = { node, originX: node.x, originY: node.y };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an optimisation for pointers that leave the SVG; if it is
      // refused the drag still works, so this must not abort the gesture and
      // strand panning in its suspended state.
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || !pointerOrigin) {
      if (!dragging) {
        const group = nodeGroupFrom(event.target);
        svg.style.cursor = group && options.isManualLayout() ? 'grab' : '';
      }
      return;
    }
    const point = toDiagram(event.clientX, event.clientY);
    dragging.node.x = dragging.originX + (point.x - pointerOrigin.x);
    dragging.node.y = dragging.originY + (point.y - pointerOrigin.y);
    dragging.node.element.setAttribute(
      'transform',
      `translate(${dragging.node.x}, ${dragging.node.y})`
    );
    options.reflow(scene);
    syncSelectionRect();
  };

  const endDrag = (event: PointerEvent) => {
    if (!dragging) {
      return;
    }
    const positions: Record<string, NodePosition> = {};
    for (const node of scene.nodes) {
      positions[node.id] = { x: node.x, y: node.y };
    }
    dragging = undefined;
    pointerOrigin = undefined;
    try {
      svg.releasePointerCapture(event.pointerId);
    } catch {
      // Nothing was captured; releasing is best-effort.
    }
    options.panZoomState.resumePan();
    // Persisting every node, not just the dragged one, pins the rest of the
    // graph so Mermaid's next layout pass cannot shuffle it underneath us.
    options.onMove(positions);
  };

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  syncSelectionRect();

  return () => {
    svg.removeEventListener('pointerdown', onPointerDown);
    svg.removeEventListener('pointermove', onPointerMove);
    svg.removeEventListener('pointerup', endDrag);
    svg.removeEventListener('pointercancel', endDrag);
    clearOverlay(svg);
    scene = { edges: [], nodes: [] };
  };
};

export const clearSelection = (): void => {
  selectedId = undefined;
  selectionRect = undefined;
};
