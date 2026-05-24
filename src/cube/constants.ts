// Rubik's Cube Constants and Types

/** 6 face colors following standard Western color scheme */
export const FACE_COLORS = {
  U: '#FFFFFF', // White - Up
  D: '#FFD500', // Yellow - Down
  F: '#009B48', // Green - Front
  B: '#0046AD', // Blue - Back
  L: '#FF5800', // Orange - Left
  R: '#B71234', // Red - Right
} as const;

/** Black color for internal/non-visible faces */
export const INTERNAL_COLOR = '#1a1a1a';

/** Face indices in the state array */
export const FACE_INDEX = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 } as const;

export type FaceName = keyof typeof FACE_INDEX;
export type ColorName = keyof typeof FACE_COLORS;

/** 54 stickers: U(0-8), R(9-17), F(18-26), D(27-35), L(36-44), B(45-53) */
export type CubeState = ColorName[];

/** Standard move notation */
export type Move = 'U' | "U'" | 'U2' | 'D' | "D'" | 'D2' | 'R' | "R'" | 'R2' | 'L' | "L'" | 'L2' | 'F' | "F'" | 'F2' | 'B' | "B'" | 'B2';

/** All 18 possible moves */
export const ALL_MOVES: Move[] = [
  'U', "U'", 'U2', 'D', "D'", 'D2',
  'R', "R'", 'R2', 'L', "L'", 'L2',
  'F', "F'", 'F2', 'B', "B'", 'B2',
];

/** Face move indices (0=U, 1=R, 2=F, 3=D, 4=L, 5=B) */
export const FACE_MOVES: Move[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** Create solved cube state */
export function createSolvedState(): CubeState {
  const state: ColorName[] = [];
  const faces: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  for (const face of faces) {
    for (let i = 0; i < 9; i++) {
      state.push(face);
    }
  }
  return state;
}

/** Create blank state (no colors assigned) */
export function createBlankState(): (ColorName | null)[] {
  return new Array(54).fill(null);
}

/** Sticker positions on each face (row-major, 0=top-left, 8=bottom-right) */
export const STICKER_POSITIONS: Record<FaceName, number[]> = {
  U: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  R: [9, 10, 11, 12, 13, 14, 15, 16, 17],
  F: [18, 19, 20, 21, 22, 23, 24, 25, 26],
  D: [27, 28, 29, 30, 31, 32, 33, 34, 35],
  L: [36, 37, 38, 39, 40, 41, 42, 43, 44],
  B: [45, 46, 47, 48, 49, 50, 51, 52, 53],
};

/** Color display names */
export const COLOR_NAMES: Record<ColorName, string> = {
  U: '白',
  D: '黄',
  F: '绿',
  B: '蓝',
  L: '橙',
  R: '红',
};

/** Face to color mapping for net display */
export const FACE_LABELS: Record<FaceName, string> = {
  U: '上(U)',
  D: '下(D)',
  F: '前(F)',
  B: '后(B)',
  L: '左(L)',
  R: '右(R)',
};
