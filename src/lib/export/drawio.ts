/**
 * draw.io (mxGraph) export, from the structural model.
 *
 * Emits an uncompressed `<mxfile>` so the result opens directly in diagrams.net
 * and every node stays a real, movable, editable shape. draw.io accepts
 * uncompressed XML, so we skip the deflate+base64 wrapper its own exports use.
 */

import { parseDiagram, STRUCTURAL_TYPES } from './parse';
import type { FlowGraph, NodeShape, SequenceDiagram } from './parse';
import type { ExportContext, ExportResult, Exporter } from './types';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const GAP_X = 220;
const GAP_Y = 120;

const escapeXML = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Maps a Mermaid shape onto the equivalent mxGraph style string. */
const styleFor = (shape: NodeShape): string => {
  switch (shape) {
    case 'diamond': {
      return 'rhombus;whiteSpace=wrap;html=1;';
    }
    case 'ellipse': {
      return 'ellipse;whiteSpace=wrap;html=1;';
    }
    case 'rounded':
    case 'stadium': {
      return 'rounded=1;whiteSpace=wrap;html=1;arcSize=40;';
    }
    default: {
      return 'rounded=0;whiteSpace=wrap;html=1;';
    }
  }
};

const wrap = (name: string, cells: string[]): string =>
  [
    '<mxfile host="mermaid-live-editor">',
    `  <diagram name="${escapeXML(name)}">`,
    '    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" page="1" pageWidth="1100" pageHeight="850">',
    '      <root>',
    '        <mxCell id="0" />',
    '        <mxCell id="1" parent="0" />',
    ...cells.map((cell) => `        ${cell}`),
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>'
  ].join('\n');

/**
 * Lays flowchart nodes out in a grid.
 *
 * Mermaid's real coordinates live in the rendered SVG, but reusing them would
 * bake in Mermaid's layout; draw.io users expect to re-run their own layout
 * anyway. A predictable grid keeps every node on screen and non-overlapping.
 */
const flowchartToDrawio = (graph: FlowGraph): string => {
  const horizontal = graph.direction === 'LR' || graph.direction === 'RL';
  const columns = Math.max(1, Math.ceil(Math.sqrt(graph.nodes.length)));
  const cells: string[] = [];
  const ids = new Map<string, string>();

  graph.nodes.forEach((node, index) => {
    const cellId = `n${index + 2}`;
    ids.set(node.id, cellId);
    const major = index % columns;
    const minor = Math.floor(index / columns);
    const x = (horizontal ? minor : major) * GAP_X + 40;
    const y = (horizontal ? major : minor) * GAP_Y + 40;
    cells.push(
      `<mxCell id="${cellId}" value="${escapeXML(node.label)}" style="${styleFor(node.shape)}" vertex="1" parent="1">`,
      `  <mxGeometry x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" as="geometry" />`,
      '</mxCell>'
    );
  });

  graph.edges.forEach((edge, index) => {
    const source = ids.get(edge.from);
    const target = ids.get(edge.to);
    if (!source || !target) {
      return;
    }
    const style = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;${edge.dashed ? 'dashed=1;' : ''}`;
    cells.push(
      `<mxCell id="e${index}" value="${escapeXML(edge.label ?? '')}" style="${style}" edge="1" parent="1" source="${source}" target="${target}">`,
      '  <mxGeometry relative="1" as="geometry" />',
      '</mxCell>'
    );
  });

  return wrap('Flowchart', cells);
};

/**
 * Sequence diagrams become lifelines with labelled message edges — draw.io has
 * no native sequence primitive, so this is the shape its own sequence stencils
 * use: a header box plus a vertical lifeline.
 */
const sequenceToDrawio = (diagram: SequenceDiagram): string => {
  const cells: string[] = [];
  const ids = new Map<string, string>();
  const lifelineHeight = Math.max(200, diagram.messages.length * 60 + 80);

  diagram.participants.forEach((participant, index) => {
    const cellId = `p${index + 2}`;
    ids.set(participant.alias, cellId);
    cells.push(
      `<mxCell id="${cellId}" value="${escapeXML(participant.label)}" style="shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;collapsible=0;" vertex="1" parent="1">`,
      `  <mxGeometry x="${index * 180 + 40}" y="40" width="120" height="${lifelineHeight}" as="geometry" />`,
      '</mxCell>'
    );
  });

  diagram.messages.forEach((message, index) => {
    const source = ids.get(message.from);
    const target = ids.get(message.to);
    if (!source || !target) {
      return;
    }
    const y = index * 60 + 100;
    const style = `html=1;verticalAlign=bottom;endArrow=block;${message.arrow === 'dotted' ? 'dashed=1;' : ''}`;
    cells.push(
      `<mxCell id="m${index}" value="${escapeXML(message.label)}" style="${style}" edge="1" parent="1" source="${source}" target="${target}">`,
      `  <mxGeometry relative="1" as="geometry"><mxPoint y="${y}" as="sourcePoint" /><mxPoint y="${y}" as="targetPoint" /></mxGeometry>`,
      '</mxCell>'
    );
  });

  return wrap('Sequence', cells);
};

const run = async ({ code, diagramType }: ExportContext): Promise<ExportResult> => {
  const parsed = parseDiagram(code, diagramType);
  if (!parsed) {
    throw new Error(`Cannot convert a ${diagramType} diagram to draw.io.`);
  }
  const xml = parsed.type === 'flowchart' ? flowchartToDrawio(parsed) : sequenceToDrawio(parsed);
  return { blob: new Blob([xml], { type: 'application/xml' }), extension: 'drawio' };
};

export const drawioExporter: Exporter = {
  description: 'Editable draw.io shapes. Flowchart and sequence diagrams only.',
  extension: 'drawio',
  id: 'drawio',
  label: 'draw.io',
  run,
  supports: (diagramType) =>
    STRUCTURAL_TYPES.has(diagramType) ||
    `draw.io export supports flowchart and sequence diagrams; this is a ${diagramType} diagram.`
};
