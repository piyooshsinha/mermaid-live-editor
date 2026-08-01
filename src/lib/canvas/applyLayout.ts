/**
 * Applies manual node positions to a freshly rendered diagram.
 *
 * Mermaid re-lays-out the whole graph on every render, so manual positions have
 * to be re-applied after each one. Moving a node also invalidates Mermaid's
 * precomputed edge splines, so in manual mode every edge is redrawn as a
 * straight segment clipped to both node borders. Doing this for *all* edges,
 * rather than only the ones touching a moved node, keeps the diagram visually
 * consistent instead of mixing curves and straight lines mid-drag.
 */

import type { NodePosition } from '$/types';
import { readScene, translationOf, type Scene, type SceneNode } from './scene';

/** Where an edge should meet a node: its border, not its centre. */
const clipToBorder = (from: SceneNode, to: SceneNode, at: SceneNode): { x: number; y: number } => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return { x: at.x, y: at.y };
  }
  // Standard rectangle-ray intersection: scale the direction vector until it
  // hits the box edge, taking whichever axis is limiting.
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : at.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : at.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  const sign = at === from ? 1 : -1;
  return { x: at.x + sign * dx * scale, y: at.y + sign * dy * scale };
};

/** Moves an edge label to the midpoint of its edge. */
const repositionLabel = (svg: SVGSVGElement, key: string, x: number, y: number): void => {
  const label = svg.querySelector<SVGGElement>(`g.label[data-id="${CSS.escape(key)}"]`);
  const wrapper = label?.parentElement;
  if (wrapper instanceof SVGGElement) {
    wrapper.setAttribute('transform', `translate(${x}, ${y})`);
  }
};

/**
 * Redraws every edge from the scene's current node positions. Called on each
 * pointermove during a drag, so it must stay cheap: it only writes attributes.
 */
export const reflowEdges = (svg: SVGSVGElement, scene: Scene): void => {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  for (const edge of scene.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      continue;
    }
    const start = clipToBorder(from, to, from);
    const end = clipToBorder(from, to, to);
    edge.element.setAttribute('d', `M ${start.x},${start.y} L ${end.x},${end.y}`);
    repositionLabel(svg, edge.key, (start.x + end.x) / 2, (start.y + end.y) / 2);
  }
};

/** Repositions nodes from stored coordinates, then reroutes the edges. */
export const applyManualLayout = (
  svg: SVGSVGElement,
  positions: Record<string, NodePosition>
): Scene => {
  const scene = readScene(svg);
  if (Object.keys(positions).length === 0) {
    return scene;
  }

  let moved = false;
  for (const node of scene.nodes) {
    const position = positions[node.id];
    if (!position) {
      continue;
    }
    node.element.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    node.x = position.x;
    node.y = position.y;
    moved = true;
  }

  if (moved) {
    reflowEdges(svg, scene);
  }
  return scene;
};

/**
 * Snapshots the positions Mermaid chose, so switching Auto-Layout off starts
 * from the diagram the user is already looking at rather than collapsing it.
 */
export const captureLayout = (svg: SVGSVGElement): Record<string, NodePosition> => {
  const positions: Record<string, NodePosition> = {};
  for (const node of readScene(svg).nodes) {
    const { x, y } = translationOf(node.element);
    positions[node.id] = { x, y };
  }
  return positions;
};
