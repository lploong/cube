// Animation controller for solution playback
import type { Move } from './constants';
import { CubeRenderer } from './renderer';
import { applyMoveToState, inverseMove } from './solver';
import type { CubeState } from './constants';

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'stepping';

export interface AnimationController {
  moves: Move[];
  currentIndex: number;
  playbackState: PlaybackState;
  speed: number; // 0.25 to 3.0
  onStateChange: ((state: PlaybackState, index: number) => void) | null;
}

export function createAnimationController(): AnimationController {
  return {
    moves: [],
    currentIndex: -1,
    playbackState: 'idle',
    speed: 1.0,
    onStateChange: null,
  };
}

/** Set moves for animation */
export function setMoves(controller: AnimationController, moves: Move[]): void {
  controller.moves = moves;
  controller.currentIndex = -1;
  controller.playbackState = 'idle';
  notifyChange(controller);
}

/** Play the solution animation from current position */
export function play(
  controller: AnimationController,
  renderer: CubeRenderer,
  currentState: CubeState,
  onMoveApplied: (newState: CubeState, moveIndex: number) => void
): void {
  if (controller.moves.length === 0) return;
  if (controller.currentIndex >= controller.moves.length - 1) return;

  controller.playbackState = 'playing';
  notifyChange(controller);

  executeNextMove(controller, renderer, currentState, onMoveApplied);
}

function executeNextMove(
  controller: AnimationController,
  renderer: CubeRenderer,
  currentState: CubeState,
  onMoveApplied: (newState: CubeState, moveIndex: number) => void
): void {
  if (controller.playbackState !== 'playing' && controller.playbackState !== 'stepping') return;
  if (controller.currentIndex >= controller.moves.length - 1) {
    controller.playbackState = 'idle';
    notifyChange(controller);
    return;
  }

  const nextIndex = controller.currentIndex + 1;
  const move = controller.moves[nextIndex];
  const duration = 400 / controller.speed; // Base duration: 400ms

  renderer.animateMove(move, duration, () => {
    // Apply move to state
    const newState = applyMoveToState(currentState, move);
    controller.currentIndex = nextIndex;
    onMoveApplied(newState, nextIndex);

    // Continue playing only if still in 'playing' state
    if (controller.playbackState === 'playing') {
      setTimeout(() => {
        executeNextMove(controller, renderer, newState, onMoveApplied);
      }, 80 / controller.speed); // Small gap between moves
    } else {
      // After stepping, switch to 'paused' so Play can resume
      controller.playbackState = 'paused';
      notifyChange(controller);
    }
  });
}

/** Pause the animation */
export function pause(controller: AnimationController): void {
  if (controller.playbackState === 'playing') {
    controller.playbackState = 'paused';
    notifyChange(controller);
  }
}

/** Resume the animation from paused/stepping state */
export function resume(
  controller: AnimationController,
  renderer: CubeRenderer,
  currentState: CubeState,
  onMoveApplied: (newState: CubeState, moveIndex: number) => void
): void {
  if (controller.playbackState === 'paused' || controller.playbackState === 'stepping') {
    play(controller, renderer, currentState, onMoveApplied);
  }
}

/** Step forward one move with animation */
export function stepForward(
  controller: AnimationController,
  renderer: CubeRenderer,
  currentState: CubeState,
  onMoveApplied: (newState: CubeState, moveIndex: number) => void
): void {
  if (controller.currentIndex >= controller.moves.length - 1) return;
  if (renderer.getIsAnimating()) return;

  controller.playbackState = 'stepping';
  executeNextMove(controller, renderer, currentState, onMoveApplied);
}

/** Step backward one move with animation (plays inverse move) */
export function stepBackward(
  controller: AnimationController,
  renderer: CubeRenderer,
  currentState: CubeState,
  onMoveApplied: (newState: CubeState, moveIndex: number) => void
): void {
  if (controller.currentIndex < 0) return;
  if (renderer.getIsAnimating()) return;

  const currentMove = controller.moves[controller.currentIndex];
  const invMove = inverseMove(currentMove);
  const prevIndex = controller.currentIndex - 1;
  const duration = 400 / controller.speed;

  controller.playbackState = 'stepping';

  renderer.animateMove(invMove, duration, () => {
    // Compute the previous state by applying the inverse move
    const prevState = applyMoveToState(currentState, invMove);
    controller.currentIndex = prevIndex;
    onMoveApplied(prevState, prevIndex);

    controller.playbackState = 'paused';
    notifyChange(controller);
  });
}

/**
 * Jump to a specific step index by replaying from the beginning.
 * Used for scrubbing the progress slider.
 */
export function jumpToStep(
  controller: AnimationController,
  targetIndex: number,
  originalState: CubeState,
  renderer: CubeRenderer,
  onMoveApplied: (newState: CubeState, moveIndex: number) => void
): void {
  if (targetIndex < -1 || targetIndex >= controller.moves.length) return;

  // Apply moves from original state up to targetIndex
  let currentState = [...originalState] as CubeState;
  for (let i = 0; i <= targetIndex; i++) {
    currentState = applyMoveToState(currentState, controller.moves[i]);
  }

  controller.currentIndex = targetIndex;
  controller.playbackState = targetIndex < 0 ? 'idle' : 'paused';

  // Update renderer directly (no animation)
  renderer.updateColors(currentState);
  onMoveApplied(currentState, targetIndex);
  notifyChange(controller);
}

/** Reset animation to beginning */
export function resetAnimation(controller: AnimationController): void {
  controller.currentIndex = -1;
  controller.playbackState = 'idle';
  notifyChange(controller);
}

/** Set playback speed */
export function setSpeed(controller: AnimationController, speed: number): void {
  controller.speed = Math.max(0.25, Math.min(3.0, speed));
}

function notifyChange(controller: AnimationController): void {
  if (controller.onStateChange) {
    controller.onStateChange(controller.playbackState, controller.currentIndex);
  }
}
