// Cube state management with undo/redo support
import type { CubeState, FaceName, ColorName } from './constants';
import { createSolvedState, FACE_INDEX } from './constants';

export interface CubeStateHistory {
  past: (ColorName | null)[][];
  present: (ColorName | null)[];
  future: (ColorName | null)[][];
}

/** Create initial cube state history */
export function createHistory(initialState: (ColorName | null)[] = createSolvedState()): CubeStateHistory {
  return {
    past: [],
    present: [...initialState],
    future: [],
  };
}

/** Apply a color change and update history */
export function applyColorChange(
  history: CubeStateHistory,
  stickerIndex: number,
  color: ColorName
): CubeStateHistory {
  const newPresent = [...history.present];
  newPresent[stickerIndex] = color;

  return {
    past: [...history.past, history.present],
    present: newPresent,
    future: [], // Clear redo stack on new action
  };
}

/** Fill entire cube with standard colors */
export function fillStandardColors(): CubeState {
  return createSolvedState();
}

/** Reset to blank state */
export function resetToBlank(): (ColorName | null)[] {
  return new Array(54).fill(null);
}

/** Undo the last color change */
export function undo(history: CubeStateHistory): CubeStateHistory {
  if (history.past.length === 0) return history;

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/** Redo the last undone change */
export function redo(history: CubeStateHistory): CubeStateHistory {
  if (history.future.length === 0) return history;

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

/** Check if undo is available */
export function canUndo(history: CubeStateHistory): boolean {
  return history.past.length > 0;
}

/** Check if redo is available */
export function canRedo(history: CubeStateHistory): boolean {
  return history.future.length > 0;
}

/** Convert cube state to the format expected by solver */
export function toSolverState(state: (ColorName | null)[]): CubeState | null {
  // Check all stickers are assigned
  for (let i = 0; i < 54; i++) {
    if (!state[i]) return null;
  }
  return state as CubeState;
}

/** Get the face color for a sticker */
export function getStickerColor(state: (ColorName | null)[], index: number): ColorName | null {
  return state[index] || null;
}

/** Get all stickers for a face */
export function getFaceStickers(state: (ColorName | null)[], faceName: FaceName): (ColorName | null)[] {
  const faceStart = FACE_INDEX[faceName] * 9;
  return state.slice(faceStart, faceStart + 9);
}

/** Count how many stickers have been colored */
export function countColoredStickers(state: (ColorName | null)[]): number {
  return state.filter(s => s !== null).length;
}
