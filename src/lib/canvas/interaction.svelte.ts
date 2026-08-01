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
import {
  edgeEndpointsOf,
  nodeGroupFrom,
  nodeIdOf,
  readScene,
  type Scene,
  type SceneNode
} from './scene';
import { midpointOf } from './applyLayout';
import type { SourceMap } from './sourceMap';

export interface CanvasSelection {
  /** Node id, or the edge key (`L_A_B_0`). */
  id: string;
  kind: 'edge' | 'node';
  /** 1-based source lines that declare this element, definition first. */
  lines: number[];
  /** Screen-space box, for anchoring the floating toolbar. */
  rect: DOMRect;
}

let selection = $state.raw<CanvasSelection | undefined>();

export const canvasSelection = {
  get current(): CanvasSelection | undefined {
    return selection;
  }
};

/** Lines the editor should highlight for the current selection. */
export const selectedLines = {
  get current(): number[] {
    return selection?.lines ?? [];
  }
};

const OVERLAY_CLASS = 'mpp-overlay';
const HIT_CLASS = 'mpp-hit';
const PADDING = 6;
const ACCENT = '#2563eb';

const viewportOf = (svg: SVGSVGElement): Element =>
  svg.querySelector('g.svg-pan-zoom_viewport') ?? svg.firstElementChild ?? svg;

const removeLayers = (svg: SVGSVGElement): void => {
  for (const selector of [`.${OVERLAY_CLASS}`, `.${HIT_CLASS}`]) {
    svg.querySelector(selector)?.remove();
  }
};

const makeLayer = (svg: SVGSVGElement, className: string, onTop: boolean): SVGGElement => {
  const existing = svg.querySelector<SVGGElement>(`.${className}`);
  if (existing) {
    return existing;
  }
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.setAttribute('class', className);
  const viewport = viewportOf(svg);
  if (onTop) {
    viewport.append(layer);
  } else {
    // Behind the diagram, so node hit-testing still wins on any overlap.
    viewport.prepend(layer);
  }
  return layer;
};

export interface CanvasOptions {
  /** Whether manual layout is on; dragging is disabled when it is not. */
  isManualLayout: () => boolean;
  onMove: (positions: Record<string, NodePosition>) => void;
  /** Commits a reshaped edge route. */
  onReroute: (waypoints: Record<string, NodePosition[]>) => void;
  panZoomState: PanZoomState;
  /** Redraws edges live while something is being dragged. */
  reflow: (scene: Scene, waypoints: Record<string, NodePosition[]>) => void;
  sourceMap: SourceMap;
  /** Existing manual edge routes, mutated in place as the user drags. */
  waypoints: Record<string, NodePosition[]>;
}

/**
 * Wires pointer handling onto a rendered diagram. Returns a teardown function;
 * `View.svelte` calls this after every render and disposes the previous one.
 */
export const attachCanvas = (svg: SVGSVGElement, options: CanvasOptions): (() => void) => {
  removeLayers(svg);
  const scene = readScene(svg);
  // A plain record, not a Map: this is a static lookup index rebuilt on every
  // render, never reactive state.
  const byId: Record<string, SceneNode> = Object.fromEntries(
    scene.nodes.map((node) => [node.id, node])
  );

  const overlay = makeLayer(svg, OVERLAY_CLASS, true);
  overlay.style.pointerEvents = 'none';
  const hitLayer = makeLayer(svg, HIT_CLASS, false);

  /**
   * Transparent fat copies of each edge, because a 2px stroke is effectively
   * unclickable. These carry the pointer events; the real paths stay visual.
   */
  const hitPaths = scene.edges.map((edge) => {
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hit.setAttribute('fill', 'none');
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '14');
    hit.style.pointerEvents = 'stroke';
    hit.dataset.edgeKey = edge.key;
    hitLayer.append(hit);
    return { edge, hit };
  });

  /** Copies geometry from the real edges; must re-run after any reflow. */
  const syncHitPaths = () => {
    for (const { edge, hit } of hitPaths) {
      hit.setAttribute('d', edge.element.getAttribute('d') ?? '');
    }
  };
  syncHitPaths();

  let dragging: { node: SceneNode; originX: number; originY: number } | undefined;
  let bending: { index: number; key: string } | undefined;
  let pointerOrigin: { x: number; y: number } | undefined;

  const drawSelection = () => {
    overlay.replaceChildren();
    if (!selection) {
      return;
    }
    if (selection.kind === 'node') {
      const node = byId[selection.id];
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
      box.setAttribute('stroke', ACCENT);
      box.setAttribute('stroke-width', '2');
      overlay.append(box);
      return;
    }
    // Edge: trace the path in the accent colour, matching the reference UI.
    const edge = scene.edges.find((candidate) => candidate.key === selection?.id);
    if (!edge) {
      return;
    }
    const trace = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trace.setAttribute('d', edge.element.getAttribute('d') ?? '');
    trace.setAttribute('fill', 'none');
    trace.setAttribute('stroke', ACCENT);
    trace.setAttribute('stroke-width', '3');
    trace.setAttribute('stroke-opacity', '0.65');
    overlay.append(trace);

    if (options.isManualLayout()) {
      drawEdgeHandles(edge.key);
    }
  };

  /**
   * Draggable dots for reshaping an edge: one per existing bend, plus a hollow
   * "ghost" at the midpoint that becomes a new bend when dragged. This is the
   * usual convention, and it keeps a straight edge from showing clutter it
   * does not need yet.
   */
  const drawEdgeHandles = (key: string) => {
    const bends = options.waypoints[key] ?? [];

    const dot = (point: NodePosition, index: number, ghost: boolean) => {
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.setAttribute('cx', String(point.x));
      handle.setAttribute('cy', String(point.y));
      handle.setAttribute('r', ghost ? '5' : '6');
      handle.setAttribute('fill', ghost ? '#ffffff' : ACCENT);
      handle.setAttribute('stroke', ACCENT);
      handle.setAttribute('stroke-width', '2');
      handle.style.pointerEvents = 'all';
      handle.style.cursor = 'grab';
      handle.dataset.waypointIndex = String(index);
      handle.dataset.waypointGhost = ghost ? 'true' : 'false';
      overlay.append(handle);
    };

    for (const [index, bend] of bends.entries()) {
      dot(bend, index, false);
    }

    // The ghost sits on the midpoint of the current route.
    const geometry = edgeGeometry(key);
    if (geometry) {
      dot(midpointOf(geometry.points), geometry.insertAt, true);
    }
  };

  /** Current polyline of an edge plus where a midpoint bend would slot in. */
  const edgeGeometry = (key: string): { insertAt: number; points: NodePosition[] } | undefined => {
    const edge = scene.edges.find((candidate) => candidate.key === key);
    const from = edge ? byId[edge.from] : undefined;
    const to = edge ? byId[edge.to] : undefined;
    if (!edge || !from || !to) {
      return undefined;
    }
    const bends = options.waypoints[key] ?? [];
    const points = [{ x: from.x, y: from.y }, ...bends, { x: to.x, y: to.y }];
    // Insert into the middle segment so the new bend lands where the ghost is.
    return { insertAt: Math.floor(bends.length / 2), points };
  };

  const rectOf = (element: SVGGraphicsElement): DOMRect => element.getBoundingClientRect();

  const select = (next: CanvasSelection | undefined) => {
    selection = next;
    drawSelection();
  };

  const refreshSelection = () => {
    if (!selection) {
      return;
    }
    const element =
      selection.kind === 'node'
        ? byId[selection.id]?.element
        : scene.edges.find((edge) => edge.key === selection?.id)?.element;
    if (element) {
      selection = { ...selection, rect: rectOf(element) };
    }
    drawSelection();
  };

  /**
   * Converts a client point into diagram coordinates.
   *
   * The CTM has to come from the pan/zoom viewport group, not the root SVG:
   * node transforms live inside that group, so the root's CTM omits the pan and
   * zoom applied to it. Using the root would leave drags unscaled — at 2x zoom
   * a 20px drag would move the node 20 units instead of 10.
   */
  const toDiagram = (clientX: number, clientY: number): { x: number; y: number } => {
    const reference = viewportOf(svg) as SVGGraphicsElement;
    const matrix = reference.getScreenCTM();
    if (!matrix) {
      return { x: clientX, y: clientY };
    }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  const onPointerDown = (event: PointerEvent) => {
    // Edge waypoint handles take precedence: they sit on top of everything.
    const handle = event.target;
    if (
      handle instanceof SVGElement &&
      handle.dataset.waypointIndex !== undefined &&
      selection?.kind === 'edge'
    ) {
      event.stopPropagation();
      event.preventDefault();
      const key = selection.id;
      const index = Number(handle.dataset.waypointIndex);
      const bends = [...(options.waypoints[key] ?? [])];
      if (handle.dataset.waypointGhost === 'true') {
        // Materialise the ghost into a real bend at the pointer.
        bends.splice(index, 0, toDiagram(event.clientX, event.clientY));
      }
      options.waypoints[key] = bends;
      bending = { index, key };
      options.panZoomState.suspendPan();
      try {
        svg.setPointerCapture(event.pointerId);
      } catch {
        // Best effort; the drag still works without capture.
      }
      return;
    }

    const group = nodeGroupFrom(event.target);
    if (group) {
      const id = nodeIdOf(group);
      const node = id ? byId[id] : undefined;
      if (!node) {
        return;
      }
      select({
        id: node.id,
        kind: 'node',
        lines: options.sourceMap.nodes[node.id] ?? [],
        rect: rectOf(node.element)
      });

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
      return;
    }

    // Edge hit areas sit behind the diagram, so anything reaching here that is
    // not a node may still be an edge.
    const target = event.target;
    const key = target instanceof SVGElement ? target.dataset.edgeKey : undefined;
    const edge = key ? scene.edges.find((candidate) => candidate.key === key) : undefined;
    if (edge) {
      event.stopPropagation();
      select({
        id: edge.key,
        kind: 'edge',
        lines: options.sourceMap.edges[edge.key] ? [options.sourceMap.edges[edge.key]] : [],
        rect: rectOf(edge.element)
      });
      return;
    }

    select(undefined);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (bending) {
      const bends = options.waypoints[bending.key];
      if (bends?.[bending.index]) {
        bends[bending.index] = toDiagram(event.clientX, event.clientY);
        options.reflow(scene, options.waypoints);
        syncHitPaths();
        refreshSelection();
      }
      return;
    }

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
    options.reflow(scene, options.waypoints);
    syncHitPaths();
    refreshSelection();
  };

  const endDrag = (event: PointerEvent) => {
    if (bending) {
      bending = undefined;
      try {
        svg.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing was captured; releasing is best-effort.
      }
      options.panZoomState.resumePan();
      options.onReroute({ ...options.waypoints });
      return;
    }

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

  // A re-render replaces every element, so any previous selection is stale.
  select(undefined);

  return () => {
    svg.removeEventListener('pointerdown', onPointerDown);
    svg.removeEventListener('pointermove', onPointerMove);
    svg.removeEventListener('pointerup', endDrag);
    svg.removeEventListener('pointercancel', endDrag);
    removeLayers(svg);
  };
};

export const clearSelection = (): void => {
  selection = undefined;
};

export { edgeEndpointsOf };
