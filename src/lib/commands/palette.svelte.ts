/**
 * Whether the command palette is showing.
 *
 * A module-level rune rather than a bound-out callback, so anything that wants
 * to open the palette — the navbar button, a keyboard shortcut, a future empty
 * state — just calls `openPalette()` without being wired to the component.
 */

let visible = $state.raw(false);

export const palette = {
  get isOpen(): boolean {
    return visible;
  }
};

export const openPalette = (): void => {
  visible = true;
};

export const closePalette = (): void => {
  visible = false;
};

export const togglePalette = (): void => {
  visible = !visible;
};
