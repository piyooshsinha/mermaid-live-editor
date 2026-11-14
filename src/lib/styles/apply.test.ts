import { describe, expect, it } from 'vitest';
import { activePresetId, applyPreset, clearPreset } from './apply';
import { presetById, stylePresets } from './presets';

/** Fails loudly if a preset is renamed, rather than failing as `undefined`. */
const preset = (id: string) => {
  const found = presetById(id);
  if (!found) {
    throw new Error(`Unknown preset in test fixture: ${id}`);
  }
  return found;
};

const sketch = preset('sketch');
const midnight = preset('midnight');

describe('applyPreset', () => {
  it('switches the theme to base, which is what honours themeVariables', () => {
    expect(JSON.parse(applyPreset('{}', sketch)).theme).toBe('base');
  });

  it('writes the preset variables', () => {
    const config = JSON.parse(applyPreset('{}', sketch));
    expect(config.themeVariables.primaryColor).toBe(sketch.variables.primaryColor);
    expect(config.themeVariables.fontFamily).toBe(sketch.variables.fontFamily);
  });

  it('keeps unrelated config the user set by hand', () => {
    const before = JSON.stringify({ flowchart: { curve: 'basis' }, securityLevel: 'loose' });
    const after = JSON.parse(applyPreset(before, sketch));
    expect(after.flowchart).toEqual({ curve: 'basis' });
    expect(after.securityLevel).toBe('loose');
  });

  it('keeps theme variables the user added themselves', () => {
    const before = JSON.stringify({ themeVariables: { myCustomVar: '#abc' } });
    expect(JSON.parse(applyPreset(before, sketch)).themeVariables.myCustomVar).toBe('#abc');
  });

  it('does not leave orphans when switching between presets', () => {
    const switched = JSON.parse(applyPreset(applyPreset('{}', sketch), midnight));
    // Every variable present must belong to the newly chosen preset.
    for (const [key, value] of Object.entries(switched.themeVariables)) {
      expect(midnight.variables[key], `orphan variable ${key}`).toBe(value);
    }
  });

  it('survives a half-typed config instead of throwing', () => {
    expect(JSON.parse(applyPreset('{ "theme": ', sketch)).theme).toBe('base');
  });
});

describe('activePresetId', () => {
  it('identifies every preset it applied', () => {
    for (const preset of stylePresets) {
      expect(activePresetId(applyPreset('{}', preset))).toBe(preset.id);
    }
  });

  it('is undefined for a diagram with no style applied', () => {
    expect(activePresetId('{"theme":"default"}')).toBeUndefined();
  });

  it('reports no preset once the user has edited a colour', () => {
    const edited = JSON.parse(applyPreset('{}', sketch));
    edited.themeVariables.primaryColor = '#123456';
    expect(activePresetId(JSON.stringify(edited))).toBeUndefined();
  });
});

describe('clearPreset', () => {
  it('returns the diagram to the default theme', () => {
    expect(JSON.parse(clearPreset(applyPreset('{}', sketch))).theme).toBe('default');
  });

  it('removes themeVariables entirely when none were the user own', () => {
    expect(JSON.parse(clearPreset(applyPreset('{}', sketch))).themeVariables).toBeUndefined();
  });

  it('preserves the user own variables', () => {
    const before = applyPreset(JSON.stringify({ themeVariables: { mine: '#fff' } }), sketch);
    expect(JSON.parse(clearPreset(before)).themeVariables).toEqual({ mine: '#fff' });
  });
});
