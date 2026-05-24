// Kociemba Two-Phase Solver - Using rubik-solver library
import { Cube, initSolver, solve as libSolve } from 'rubik-solver';
import type { CubeState, FaceName, Move } from './constants';

// Re-export Cube for use in main application
export { Cube };
let solverReady = false;

/** Initialize the solver (pre-compute move and pruning tables) */
export async function initKociembaSolver(): Promise<void> {
  if (solverReady) return;
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      try {
        initSolver();
        solverReady = true;
        console.log('[Solver] Kociemba solver initialized successfully');
        resolve();
      } catch (err) {
        console.error('[Solver] Failed to initialize:', err);
        reject(err);
      }
    }, 50);
  });
}

export function isSolverReady(): boolean {
  return solverReady;
}

/**
 * Convert our internal facelet array (54 colors as FaceName) to the 
 * rubik-solver string format: UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB
 */
function stateToSolverString(state: CubeState): string {
  // Our state: U(0-8), R(9-17), F(18-26), D(27-35), L(36-44), B(45-53)
  // Library expects: same order with face letters
  return state.map(face => face).join('');
}

/**
 * Validate a cube state
 */
export function validateCube(state: CubeState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all stickers are assigned
  for (let i = 0; i < 54; i++) {
    if (!state[i]) {
      errors.push('存在未上色的色块');
      return { valid: false, errors };
    }
  }

  // Check color counts
  const faces: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const counts: Record<string, number> = {};
  for (const face of faces) counts[face] = 0;
  for (const s of state) counts[s] = (counts[s] || 0) + 1;

  const faceLabels: Record<string, string> = { U: '上(U)', R: '右(R)', F: '前(F)', D: '下(D)', L: '左(L)', B: '后(B)' };
  for (const face of faces) {
    if (counts[face] !== 9) {
      errors.push(`${faceLabels[face]}面色数量为 ${counts[face]}，应为 9`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // Check center pieces
  const centers = [4, 13, 22, 31, 40, 49];
  for (let i = 0; i < 6; i++) {
    if (state[centers[i]] !== faces[i]) {
      errors.push('中心块颜色不正确');
      break;
    }
  }

  // Use library verify for comprehensive validation
  try {
    const cubeStr = stateToSolverString(state);
    const cube = Cube.fromString(cubeStr);
    const verifyResult = cube.verify();
    if (verifyResult !== true) {
      if (typeof verifyResult === 'string') {
        // Translate common error messages
        const msg = verifyResult;
        if (msg.includes('Duplicate corner')) {
          errors.push('角块冲突：存在重复的角块');
        } else if (msg.includes('Duplicate edge')) {
          errors.push('棱块冲突：存在重复的棱块');
        } else if (msg.includes('corner')) {
          errors.push('角块不合法：' + msg);
        } else if (msg.includes('edge')) {
          errors.push('棱块不合法：' + msg);
        } else {
          errors.push('魔方状态不合法：' + msg);
        }
      } else {
        errors.push('魔方状态不合法');
      }
    }
  } catch {
    errors.push('魔方状态不合法：无法解析');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Solve the cube using Kociemba's two-phase algorithm
 * Returns array of Move strings or null if unsolvable
 */
export function solveCube(state: CubeState): Move[] | null {
  if (!solverReady) {
    console.error('[Solver] solveCube called before solver initialized');
    return null;
  }

  try {
    const cubeStr = stateToSolverString(state);
    console.log('[Solver] Solving state:', cubeStr);
    const cube = Cube.fromString(cubeStr);

    // Verify the cube is valid before attempting to solve
    const verifyResult = cube.verify();
    if (verifyResult !== true) {
      console.log('[Solver] Cube verification failed:', verifyResult);
      return null;
    }

    // Check if already solved
    if (cube.isSolved()) return [];

    const solution = libSolve(cube, 22);
    console.log('[Solver] Solution:', solution);
    if (!solution) return null;

    // Parse solution string into Move array
    return parseMoveString(solution);
  } catch (err) {
    console.error('[Solver] Error during solve:', err);
    return null;
  }
}

/**
 * Check if cube is already solved
 */
export function isSolved(state: CubeState): boolean {
  try {
    const cubeStr = stateToSolverString(state);
    const cube = Cube.fromString(cubeStr);
    return cube.isSolved();
  } catch {
    return false;
  }
}

/**
 * Parse a move string like "R U R' U2 L2" into Move array
 */
function parseMoveString(str: string): Move[] {
  const tokens = str.trim().split(/\s+/);
  const moves: Move[] = [];

  for (const token of tokens) {
    if (!token) continue;
    const base = token.replace(/[2']/g, '');
    const suffix = token.slice(base.length);

    if (['U', 'R', 'F', 'D', 'L', 'B'].includes(base)) {
      if (suffix === '2') {
        moves.push((base + '2') as Move);
      } else if (suffix === "'") {
        moves.push((base + "'") as Move);
      } else {
        moves.push(base as Move);
      }
    }
  }

  return moves;
}

/**
 * Apply a move to the cube state and return the new state
 */
export function applyMoveToState(state: CubeState, move: Move): CubeState {
  const cubeStr = stateToSolverString(state);
  const cube = Cube.fromString(cubeStr);
  cube.move(moveToString(move));
  const newStr = cube.asString();
  return newStr.split('') as CubeState;
}

function moveToString(move: Move): string {
  return move;
}

/**
 * Get inverse of a move
 */
export function inverseMove(move: Move): Move {
  if (move.endsWith('2')) return move;
  if (move.endsWith("'")) return move.slice(0, -1) as Move;
  return (move + "'") as Move;
}

/**
 * Generate a random scramble
 */
export function generateScramble(length: number = 20): Move[] {
  const moves: Move[] = [];
  const faceNames: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const suffixes: string[] = ['', "'", '2'];
  let lastFace = -1;
  let lastLastFace = -1;

  for (let i = 0; i < length; i++) {
    let faceIdx: number;
    do {
      faceIdx = Math.floor(Math.random() * 6);
    } while (faceIdx === lastFace || (faceIdx === lastLastFace && isOpposite(faceIdx, lastFace)));

    const suffix = suffixes[Math.floor(Math.random() * 3)];
    moves.push((faceNames[faceIdx] + suffix) as Move);

    lastLastFace = lastFace;
    lastFace = faceIdx;
  }

  return moves;
}

function isOpposite(a: number, b: number): boolean {
  return (a === 0 && b === 3) || (a === 3 && b === 0) ||
    (a === 1 && b === 4) || (a === 4 && b === 1) ||
    (a === 2 && b === 5) || (a === 5 && b === 2);
}
