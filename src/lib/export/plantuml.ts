/**
 * PlantUML export, from the structural model.
 *
 * Transpiling source-to-source (rather than tracing the rendered SVG) is what
 * makes the result editable in PlantUML instead of a pile of absolutely
 * positioned shapes. The tradeoff is coverage: only the diagram types the
 * parser understands can be converted, and `supports()` says so plainly.
 */

import { parseDiagram, STRUCTURAL_TYPES } from './parse';
import type { FlowGraph, SequenceDiagram } from './parse';
import type { ExportContext, ExportResult, Exporter } from './types';

const DIRECTIONS: Record<string, string> = {
  BT: 'bottom to top direction',
  LR: 'left to right direction',
  RL: 'right to left direction',
  TB: 'top to bottom direction',
  TD: 'top to bottom direction'
};

/**
 * Flowcharts become PlantUML *object* diagrams rather than activity diagrams:
 * a Mermaid flowchart is an arbitrary directed graph, while PlantUML activity
 * syntax is block-structured, so forcing one into the other loses edges. An
 * object diagram round-trips every node and edge faithfully.
 */
const flowchartToPlantUML = (graph: FlowGraph): string => {
  const lines = ['@startuml', DIRECTIONS[graph.direction] ?? DIRECTIONS.TD, ''];

  for (const node of graph.nodes) {
    const stereotype = node.shape === 'diamond' ? ' <<decision>>' : '';
    lines.push(`object "${node.label.replaceAll('"', "'")}" as ${node.id}${stereotype}`);
  }
  lines.push('');

  for (const edge of graph.edges) {
    const arrow = edge.dashed ? '..>' : '-->';
    const label = edge.label ? ` : ${edge.label.replaceAll('"', "'")}` : '';
    lines.push(`${edge.from} ${arrow} ${edge.to}${label}`);
  }

  lines.push('', '@enduml');
  return lines.join('\n');
};

const sequenceToPlantUML = (diagram: SequenceDiagram): string => {
  const lines = ['@startuml', ''];

  for (const { alias, label } of diagram.participants) {
    lines.push(
      label === alias
        ? `participant ${alias}`
        : `participant "${label.replaceAll('"', "'")}" as ${alias}`
    );
  }
  lines.push('');

  for (const message of diagram.messages) {
    const arrow = message.arrow === 'dotted' ? '-->' : '->';
    lines.push(`${message.from} ${arrow} ${message.to} : ${message.label}`);
  }

  lines.push('', '@enduml');
  return lines.join('\n');
};

const run = async ({ code, diagramType }: ExportContext): Promise<ExportResult> => {
  const parsed = parseDiagram(code, diagramType);
  if (!parsed) {
    throw new Error(`Cannot convert a ${diagramType} diagram to PlantUML.`);
  }
  const source =
    parsed.type === 'flowchart' ? flowchartToPlantUML(parsed) : sequenceToPlantUML(parsed);
  return { blob: new Blob([source], { type: 'text/plain;charset=utf-8' }), extension: 'puml' };
};

export const plantumlExporter: Exporter = {
  description: 'PlantUML source. Flowchart and sequence diagrams only.',
  extension: 'puml',
  id: 'plantuml',
  label: 'PlantUML',
  run,
  supports: (diagramType) =>
    STRUCTURAL_TYPES.has(diagramType) ||
    `PlantUML export supports flowchart and sequence diagrams; this is a ${diagramType} diagram.`
};
