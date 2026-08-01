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

/**
 * Where an edge leaves a node on its way to some point: the node's border,
 * not its centre. Takes a bare target so an edge with waypoints can aim at its
 * first bend rather than at the far node.
 */
const clipTowards = (node: SceneNode, towards: NodePosition): NodePosition => {
  const dx = towards.x - node.x;
  const dy = towards.y - node.y;
  if (dx === 0 && dy === 0) {
    return { x: node.x, y: node.y };
  }
  // Standard rectangle-ray intersection: scale the direction vector until it
  // hits the box edge, taking whichever axis is limiting.
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : node.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : node.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: node.x + dx * scale, y: node.y + dy * scale };
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
export const reflowEdges = (
  svg: SVGSVGElement,
  scene: Scene,
  waypoints: Record<string, NodePosition[]> = {}
): void => {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  for (const edge of scene.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      continue;
    }
    const bends = waypoints[edge.key] ?? [];
    // Aim the ends at the nearest bend so a routed edge leaves and enters its
    // nodes from the direction the user actually dragged it.
    const start = clipTowards(from, bends[0] ?? { x: to.x, y: to.y });
    const end = clipTowards(to, bends.at(-1) ?? { x: from.x, y: from.y });
    const points = [start, ...bends, end];
    edge.element.setAttribute(
      'd',
      points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ')
    );
    const middle = midpointOf(points);
    repositionLabel(svg, edge.key, middle.x, middle.y);
  }
};

/** Point halfway along a polyline, measured by arc length. */
export const midpointOf = (points: NodePosition[]): NodePosition => {
  if (points.length < 2) {
    return points[0] ?? { x: 0, y: 0 };
  }
  const lengths = points
    .slice(1)
    .map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let remaining = total / 2;
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length || index === lengths.length - 1) {
      const ratio = length === 0 ? 0 : remaining / length;
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio
      };
    }
    remaining -= length;
  }
  return points[0];
};

/** Repositions nodes from stored coordinates, then reroutes the edges. */
export const applyManualLayout = (
  svg: SVGSVGElement,
  positions: Record<string, NodePosition>,
  waypoints: Record<string, NodePosition[]> = {}
): Scene => {
  const scene = readScene(svg);
  const hasPositions = Object.keys(positions).length > 0;
  const hasWaypoints = Object.keys(waypoints).length > 0;
  if (!hasPositions && !hasWaypoints) {
    return scene;
  }

  for (const node of scene.nodes) {
    const position = positions[node.id];
    if (!position) {
      continue;
    }
    node.element.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    node.x = position.x;
    node.y = position.y;
  }

  reflowEdges(svg, scene, waypoints);
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
