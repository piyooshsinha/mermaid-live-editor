/**
 * Reads an interactive scene model out of Mermaid's rendered SVG.
 *
 * Mermaid gives us no scene graph, but its output is addressable enough to
 * rebuild one: every node is a `g.node` carrying its Mermaid id and a
 * `translate()` transform, and every edge path carries its endpoints in its own
 * id (`L_{from}_{to}_{index}`). That is what lets selection, dragging, and
 * connect-handles work against a diagram we did not lay out ourselves.
 *
 * Everything here is in *diagram* coordinates — the space inside the pan/zoom
 * viewport — so callers never deal with screen-space conversions.
 */

export interface SceneNode {
  /** Bounding box in diagram coordinates, centred on (x, y). */
  height: number;
  /** The element itself, so callers can move or restyle it in place. */
  element: SVGGElement;
  /** Mermaid node id, e.g. `A`. */
  id: string;
  width: number;
  x: number;
  y: number;
}

export interface SceneEdge {
  element: SVGPathElement;
  from: string;
  /** The `L_A_B_0` key, which also matches the edge label's `data-id`. */
  key: string;
  to: string;
}

export interface Scene {
  edges: SceneEdge[];
  nodes: SceneNode[];
}

/**
 * Extracts the Mermaid node id from a rendered element id.
 *
 * The rendered form is `{graphId}-flowchart-{nodeId}-{index}`. Node ids may
 * themselves contain dashes, so the index is stripped from the end and the
 * prefix from the front rather than splitting on `-`.
 */
export const nodeIdOf = (element: Element): string | undefined => {
  const raw = element.id;
  if (!raw) {
    return undefined;
  }
  const match = /^.*?-(?:flowchart|state|classId)-(.+)-\d+$/.exec(raw);
  return match?.[1];
};

/** Parses `{graphId}-L_{from}_{to}_{index}` into its endpoints. */
export const edgeEndpointsOf = (
  element: Element
): { from: string; key: string; to: string } | undefined => {
  const match = /L_(.+)_(.+)_(\d+)$/.exec(element.id);
  if (!match) {
    return undefined;
  }
  return { from: match[1], key: `L_${match[1]}_${match[2]}_${match[3]}`, to: match[2] };
};

/** Reads the `translate(x, y)` of a node group, which Mermaid always sets. */
export const translationOf = (element: SVGGElement): { x: number; y: number } => {
  const transform = element.getAttribute('transform') ?? '';
  const match = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(transform);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
};

/**
 * Node size, taken from the shape child rather than `getBBox()` on the group:
 * the group also contains the label, whose foreignObject can overflow the
 * shape and would inflate the hit area.
 */
const sizeOf = (group: SVGGElement): { height: number; width: number } => {
  const shape = group.querySelector<SVGGraphicsElement>('rect, polygon, circle, ellipse, path');
  try {
    const box = (shape ?? group).getBBox();
    if (box.width > 0 && box.height > 0) {
      return { height: box.height, width: box.width };
    }
  } catch {
    // getBBox throws on elements that were never laid out.
  }
  return { height: 40, width: 100 };
};

export const readScene = (svg: SVGSVGElement): Scene => {
  const nodes: SceneNode[] = [];
  for (const group of svg.querySelectorAll<SVGGElement>('g.node')) {
    const id = nodeIdOf(group);
    if (!id) {
      continue;
    }
    const { x, y } = translationOf(group);
    const { height, width } = sizeOf(group);
    nodes.push({ element: group, height, id, width, x, y });
  }

  const edges: SceneEdge[] = [];
  for (const path of svg.querySelectorAll<SVGPathElement>(
    'path.flowchart-link, g.edgePaths path'
  )) {
    const endpoints = edgeEndpointsOf(path);
    if (endpoints) {
      edges.push({ element: path, ...endpoints });
    }
  }

  return { edges, nodes };
};

/** Finds the node group an event target sits inside, if any. */
export const nodeGroupFrom = (target: EventTarget | null): SVGGElement | undefined => {
  if (!(target instanceof Element)) {
    return undefined;
  }
  return (target.closest('g.node') as SVGGElement | null) ?? undefined;
};
