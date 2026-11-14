import { describe, expect, it } from 'vitest';
import { edgeEndpointsOf, nodeIdOf, translationOf } from './scene';

/** Builds a detached element with an id, mimicking Mermaid's output. */
const withId = (id: string): Element => {
  const element = document.createElement('div');
  element.id = id;
  return element;
};

describe('nodeIdOf', () => {
  it('extracts the Mermaid node id from a rendered flowchart node', () => {
    expect(nodeIdOf(withId('graph-2-flowchart-A-0'))).toBe('A');
  });

  it('keeps dashes that belong to the node id', () => {
    // The trailing -0 is the render index; the id itself is `my-node`.
    expect(nodeIdOf(withId('graph-12-flowchart-my-node-3'))).toBe('my-node');
  });

  it('handles state diagram nodes', () => {
    expect(nodeIdOf(withId('graph-1-state-Idle-0'))).toBe('Idle');
  });

  it('returns undefined for elements that are not nodes', () => {
    expect(nodeIdOf(withId('graph-2-L_A_B_0'))).toBeUndefined();
    expect(nodeIdOf(withId(''))).toBeUndefined();
  });
});

describe('edgeEndpointsOf', () => {
  it('recovers source and target from the edge id', () => {
    expect(edgeEndpointsOf(withId('graph-2-L_A_B_0'))).toEqual({
      from: 'A',
      key: 'L_A_B_0',
      to: 'B'
    });
  });

  it('produces a key that matches the edge label data-id', () => {
    // Labels are looked up by this exact key, so the two must agree.
    expect(edgeEndpointsOf(withId('graph-7-L_Start_End_2'))?.key).toBe('L_Start_End_2');
  });

  it('returns undefined for non-edge elements', () => {
    expect(edgeEndpointsOf(withId('graph-2-flowchart-A-0'))).toBeUndefined();
  });
});

describe('translationOf', () => {
  const group = (transform: string) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    element.setAttribute('transform', transform);
    return element;
  };

  it('reads a translate with a comma separator', () => {
    expect(translationOf(group('translate(221.03125, 35)'))).toEqual({ x: 221.031_25, y: 35 });
  });

  it('reads a translate with only whitespace', () => {
    expect(translationOf(group('translate(10 20)'))).toEqual({ x: 10, y: 20 });
  });

  it('reads negative offsets', () => {
    expect(translationOf(group('translate(-38.5, -12)'))).toEqual({ x: -38.5, y: -12 });
  });

  it('falls back to the origin when there is no transform', () => {
    expect(translationOf(group(''))).toEqual({ x: 0, y: 0 });
  });
});
