/**
 * Export registry types.
 *
 * Exporters fall into two families, and the split is deliberate:
 *
 * - **Visual** exporters (PDF) consume the *rendered SVG*. They preserve
 *   exactly what the user sees and work for every diagram type.
 * - **Structural** exporters (draw.io, PlantUML, Excalidraw) consume a *parsed
 *   model*. They produce genuinely editable shapes in the target tool, but only
 *   for the diagram types the parser understands.
 *
 * `supports()` is what keeps that honest: an exporter that cannot faithfully
 * represent a diagram says so up front rather than emitting a broken file.
 */

export interface ExportContext {
  /** Mermaid source. */
  code: string;
  /** Normalized diagram type, e.g. `flowchart`, `sequence`. */
  diagramType: string;
  /** The live rendered SVG element, already cloned and safe to mutate. */
  svg: SVGSVGElement;
}

export interface ExportResult {
  blob: Blob;
  extension: string;
}

export interface Exporter {
  readonly description: string;
  readonly extension: string;
  readonly id: string;
  readonly label: string;
  /** Runs the export. Only called when `supports()` returned true. */
  run: (context: ExportContext) => Promise<ExportResult>;
  /**
   * Whether this exporter can faithfully handle the diagram. Returning a
   * string means "no", and the string is shown to the user as the reason.
   */
  supports: (diagramType: string) => true | string;
}
