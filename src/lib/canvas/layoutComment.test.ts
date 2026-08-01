import { describe, expect, it } from 'vitest';
import { readLayout, writeLayout, type ManualLayout } from './layoutComment';

const CODE = 'flowchart TD\n    A --> B';

const layout: ManualLayout = {
  edgeWaypoints: { L_A_B_0: [{ x: 150.4, y: 60.6 }] },
  nodePositions: { A: { x: 10.2, y: 20.7 }, B: { x: 300, y: 400 } }
};

describe('writeLayout', () => {
  it('appends a comment line without touching the diagram body', () => {
    const next = writeLayout(CODE, layout);
    expect(next).toContain('flowchart TD');
    expect(next).toContain('    A --> B');
    expect(next).toContain('%% mermaid-editor:layout ');
  });

  it('rounds coordinates so the diff stays small', () => {
    expect(writeLayout(CODE, layout)).toContain('"A":[10,21]');
  });

  it('replaces an existing layout comment rather than stacking them', () => {
    const once = writeLayout(CODE, layout);
    const twice = writeLayout(once, { edgeWaypoints: {}, nodePositions: { A: { x: 1, y: 2 } } });
    expect(twice.match(/mermaid-editor:layout/g)).toHaveLength(1);
    expect(twice).toContain('"A":[1,2]');
  });

  it('removes the comment when the layout is cleared', () => {
    const cleared = writeLayout(writeLayout(CODE, layout), undefined);
    expect(cleared).not.toContain('mermaid-editor:layout');
    expect(cleared.trim()).toBe(CODE);
  });

  it('writes nothing when there is no layout to record', () => {
    const empty = writeLayout(CODE, { edgeWaypoints: {}, nodePositions: {} });
    expect(empty).not.toContain('mermaid-editor:layout');
  });

  it('omits edge routes that have no bends', () => {
    const next = writeLayout(CODE, {
      edgeWaypoints: { L_A_B_0: [] },
      nodePositions: { A: { x: 1, y: 2 } }
    });
    expect(next).not.toContain('"e":');
  });
});

describe('readLayout', () => {
  it('round-trips a layout through the source', () => {
    const restored = readLayout(writeLayout(CODE, layout));
    expect(restored?.nodePositions).toEqual({ A: { x: 10, y: 21 }, B: { x: 300, y: 400 } });
    expect(restored?.edgeWaypoints).toEqual({ L_A_B_0: [{ x: 150, y: 61 }] });
  });

  it('returns undefined when the diagram has no manual layout', () => {
    expect(readLayout(CODE)).toBeUndefined();
  });

  it('ignores a corrupt comment instead of breaking the diagram', () => {
    // A hand-edited or truncated comment must degrade to automatic layout.
    expect(readLayout(`${CODE}\n%% mermaid-editor:layout {"n":{`)).toBeUndefined();
  });

  it('tolerates indentation on the comment line', () => {
    const indented = `${CODE}\n    %% mermaid-editor:layout {"n":{"A":[5,6]}}`;
    expect(readLayout(indented)?.nodePositions).toEqual({ A: { x: 5, y: 6 } });
  });
});
