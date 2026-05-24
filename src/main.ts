// Main application - builds UI and orchestrates all components
import './index.css';
import type { CubeState, FaceName, Move, ColorName } from './cube/constants';
import { FACE_COLORS, COLOR_NAMES, FACE_LABELS, createSolvedState } from './cube/constants';
import { CubeRenderer } from './cube/renderer';
import { Cube, initKociembaSolver, isSolverReady, solveCube, validateCube, isSolved, generateScramble } from './cube/solver';
import {
  createHistory, applyColorChange, fillStandardColors,
  undo, redo, canUndo, canRedo, toSolverState, countColoredStickers
} from './cube/state';
import {
  createAnimationController, setMoves, play, pause,
  stepForward, stepBackward, jumpToStep, resetAnimation, setSpeed,
  type AnimationController, type PlaybackState
} from './cube/animator';

// ============================================================
// Application State
// ============================================================
let cubeState: (ColorName | null)[] = createSolvedState();
let stateHistory = createHistory();
let selectedColor: ColorName = 'U';
let renderer: CubeRenderer | null = null;
let animController: AnimationController = createAnimationController();
let solutionMoves: Move[] = [];
let animationState: CubeState | null = null; // State during animation playback
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

// ============================================================
// App Initialization
// ============================================================
export function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = buildAppHTML();
  attachEventListeners();

  // Initialize renderer
  const container = document.getElementById('cube-container');
  if (container) {
    renderer = new CubeRenderer(container);
    renderer.setStickerClickHandler(handleStickerClick);
    updateRendererColors();
  }

  // Initialize solver in background
  initKociembaSolver().then(() => {
    updateSolveButton();
    console.log('[App] Solver ready');
  }).catch((err) => {
    console.error('[App] Solver initialization failed:', err);
    showToast('求解器初始化失败，请刷新页面重试');
  });

  // Set up animation controller callback
  animController.onStateChange = (state: PlaybackState, index: number) => {
    updateAnimationUI(state, index);
  };

  // Build the net display
  updateNetDisplay();
}

// ============================================================
// HTML Structure
// ============================================================
function buildAppHTML(): string {
  return `
    <div class="app-container">
      <!-- Header -->
      <header class="app-header">
        <h1 class="app-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          3D 魔方最少步骤复原
        </h1>
        <p class="app-subtitle">Kociemba 两阶段算法 · 交互式 3D 求解器</p>
      </header>

      <div class="app-content">
        <!-- Left: 3D Cube -->
        <div class="cube-panel">
          <div id="cube-container" class="cube-viewport"></div>
          
          <!-- Color Palette -->
          <div class="color-palette">
            <div class="palette-label">选择颜色</div>
            <div class="palette-colors" id="color-palette">
              ${buildColorPalette()}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="action-buttons">
            <button class="btn btn-secondary" id="btn-fill-standard" title="填充标准配色">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
              标准配色
            </button>
            <button class="btn btn-secondary" id="btn-scramble" title="随机打乱">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
              随机打乱
            </button>
            <button class="btn btn-secondary" id="btn-undo" title="撤销" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"/></svg>
              撤销
            </button>
            <button class="btn btn-secondary" id="btn-redo" title="重做" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-5-5M21 10l-5 5"/></svg>
              重做
            </button>
            <button class="btn btn-danger" id="btn-reset" title="重置魔方">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M3 12a9 9 0 109-9M3 12V3m0 9h9"/></svg>
              重置
            </button>
          </div>
        </div>

        <!-- Right: Control Panel -->
        <div class="control-panel">
          <!-- Solve Section -->
          <div class="panel-section">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              求解
            </h2>
            <button class="btn btn-primary btn-lg btn-solve" id="btn-solve" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              计算最少步骤复原
            </button>
            <div class="sticker-progress" id="sticker-progress">
              已上色: <span id="colored-count">0</span>/54
            </div>
          </div>

          <!-- Solution Display -->
          <div class="panel-section" id="solution-section" style="display:none">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              复原公式
            </h2>
            <div class="solution-info">
              <span class="move-count" id="move-count">0</span> 步
              <button class="btn-copy" id="btn-copy" title="复制公式">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
            <div class="solution-formula" id="solution-formula"></div>
          </div>

          <!-- Animation Controls -->
          <div class="panel-section" id="animation-section" style="display:none">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              动画控制
            </h2>
            <div class="animation-progress" id="animation-progress">
              步骤 <span id="current-step">0</span>/<span id="total-steps">0</span>
            </div>
            <div class="step-slider-container">
              <input type="range" id="step-slider" min="-1" max="-1" value="-1" step="1" class="step-slider">
            </div>
            <div class="animation-controls">
              <button class="btn btn-icon" id="btn-anim-reset" title="重置动画">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 12a9 9 0 109-9M3 12V3m0 9h9"/></svg>
              </button>
              <button class="btn btn-icon" id="btn-anim-prev" title="上一步">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              </button>
              <button class="btn btn-icon btn-play" id="btn-anim-play" title="播放/暂停">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
              <button class="btn btn-icon" id="btn-anim-next" title="下一步">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>
            </div>
            <div class="speed-control">
              <span class="speed-label">速度</span>
              <input type="range" id="speed-slider" min="0.25" max="3" step="0.25" value="1" class="speed-slider">
              <span class="speed-value" id="speed-value">1.0x</span>
            </div>
            <div class="current-move-display" id="current-move-display"></div>
          </div>

          <!-- Validation Messages -->
          <div class="panel-section" id="validation-section" style="display:none">
            <div class="validation-errors" id="validation-errors"></div>
          </div>

          <!-- Net Display -->
          <div class="panel-section">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
              展开图
            </h2>
            <div class="net-display" id="net-display"></div>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast" id="toast"></div>
    </div>
  `;
}

function buildColorPalette(): string {
  const colors: ColorName[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  return colors.map(c => `
    <button class="color-btn ${c === selectedColor ? 'active' : ''}" 
            data-color="${c}" 
            style="background-color:${FACE_COLORS[c]}"
            title="${COLOR_NAMES[c]} (${c})">
    </button>
  `).join('');
}

// ============================================================
// Event Listeners
// ============================================================
function attachEventListeners(): void {
  // Color palette
  document.getElementById('color-palette')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.color-btn') as HTMLElement;
    if (!btn) return;
    selectedColor = btn.dataset.color as ColorName;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // Action buttons
  document.getElementById('btn-fill-standard')?.addEventListener('click', handleFillStandard);
  document.getElementById('btn-scramble')?.addEventListener('click', handleScramble);
  document.getElementById('btn-undo')?.addEventListener('click', handleUndo);
  document.getElementById('btn-redo')?.addEventListener('click', handleRedo);
  document.getElementById('btn-reset')?.addEventListener('click', handleReset);

  // Solve
  document.getElementById('btn-solve')?.addEventListener('click', handleSolve);

  // Copy
  document.getElementById('btn-copy')?.addEventListener('click', handleCopy);

  // Animation controls
  document.getElementById('btn-anim-play')?.addEventListener('click', handlePlayPause);
  document.getElementById('btn-anim-next')?.addEventListener('click', handleNextStep);
  document.getElementById('btn-anim-prev')?.addEventListener('click', handlePrevStep);
  document.getElementById('btn-anim-reset')?.addEventListener('click', handleResetAnimation);

  // Speed slider
  document.getElementById('speed-slider')?.addEventListener('input', (e) => {
    const speed = parseFloat((e.target as HTMLInputElement).value);
    setSpeed(animController, speed);
    document.getElementById('speed-value')!.textContent = speed.toFixed(speed % 1 === 0 ? 0 : 1) + 'x';
  });

  // Step progress slider
  document.getElementById('step-slider')?.addEventListener('input', (e) => {
    const targetIndex = parseInt((e.target as HTMLInputElement).value);
    handleStepSliderChange(targetIndex);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.key === 'y') { e.preventDefault(); handleRedo(); }
      return;
    }

    // Animation keyboard shortcuts (only when solution exists)
    if (solutionMoves.length > 0) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevStep(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNextStep(); }
      if (e.key === ' ') { e.preventDefault(); handlePlayPause(); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleResetAnimation(); }
    }
  });
}

// ============================================================
// Event Handlers
// ============================================================
function handleStickerClick(faceIndex: number, globalIndex: number): void {
  if (animController.playbackState !== 'idle' && animController.playbackState !== 'paused') return;

  const newState = applyColorChange(stateHistory, globalIndex, selectedColor);
  stateHistory = newState;
  cubeState = newState.present;
  animationState = null; // Reset animation state since user modified cube
  updateRendererColors();
  updateUndoRedoButtons();
  updateSolveButton();
  updateNetDisplay();
  updateStickerProgress();
  hideValidation();
}

function handleFillStandard(): void {
  const standard = fillStandardColors();
  cubeState = [...standard];
  stateHistory = createHistory(standard);
  animationState = null;
  updateRendererColors();
  updateUndoRedoButtons();
  updateSolveButton();
  updateNetDisplay();
  updateStickerProgress();
  hideValidation();
  showToast('已填充标准配色');
}

function handleScramble(): void {
  const moves = generateScramble(20);
  const state = fillStandardColors();

  // Apply scramble using Cube
  const cube = Cube.fromString(state.join(''));
  cube.move(moves.join(' '));
  const scrambledStr = cube.asString();
  const scrambledState = scrambledStr.split('') as (ColorName | null)[];

  cubeState = scrambledState;
  stateHistory = createHistory(scrambledState as CubeState);
  animationState = null;

  // Reset animation
  solutionMoves = [];
  animController = createAnimationController();
  animController.onStateChange = (state: PlaybackState, index: number) => {
    updateAnimationUI(state, index);
  };
  hideSolutionSection();

  updateRendererColors();
  updateUndoRedoButtons();
  updateSolveButton();
  updateNetDisplay();
  updateStickerProgress();
  showToast(`已随机打乱: ${moves.join(' ')}`);
}

function handleUndo(): void {
  if (!canUndo(stateHistory)) return;
  stateHistory = undo(stateHistory);
  cubeState = stateHistory.present;
  animationState = null;
  updateRendererColors();
  updateUndoRedoButtons();
  updateSolveButton();
  updateNetDisplay();
  updateStickerProgress();
}

function handleRedo(): void {
  if (!canRedo(stateHistory)) return;
  stateHistory = redo(stateHistory);
  cubeState = stateHistory.present;
  animationState = null;
  updateRendererColors();
  updateUndoRedoButtons();
  updateSolveButton();
  updateNetDisplay();
  updateStickerProgress();
}

function handleReset(): void {
  const blankState = new Array(54).fill(null) as (ColorName | null)[];
  cubeState = blankState;
  stateHistory = { past: [], present: blankState, future: [] };
  animationState = null;

  // Reset animation
  solutionMoves = [];
  animController = createAnimationController();
  animController.onStateChange = (state: PlaybackState, index: number) => {
    updateAnimationUI(state, index);
  };
  hideSolutionSection();

  updateRendererColors();
  updateUndoRedoButtons();
  updateSolveButton();
  updateNetDisplay();
  updateStickerProgress();
  hideValidation();
  showToast('已重置魔方');
}

function handleSolve(): void {
  if (renderer?.getIsAnimating()) return;

  const solverState = toSolverState(cubeState);
  if (!solverState) {
    showToast('请先为所有色块上色');
    return;
  }

  // Validate
  const validation = validateCube(solverState);
  if (!validation.valid) {
    showValidation(validation.errors);
    return;
  }

  // Check if already solved
  if (isSolved(solverState)) {
    showToast('魔方已经处于复原状态！');
    return;
  }

  if (!isSolverReady()) {
    showToast('求解器正在初始化，请稍候...');
    return;
  }

  // Solve
  const btnSolve = document.getElementById('btn-solve') as HTMLButtonElement;
  btnSolve.disabled = true;
  btnSolve.innerHTML = `
    <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
    正在计算...
  `;

  // Use setTimeout to allow UI update
  setTimeout(() => {
    try {
      const solution = solveCube(solverState);
      if (solution === null) {
        showToast('无法求解此魔方状态');
        btnSolve.disabled = false;
        btnSolve.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          计算最少步骤复原
        `;
        return;
      }

      solutionMoves = solution;
      showSolutionSection(solution);
      showToast(`找到 ${solution.length} 步复原方案！`);
    } catch (e) {
      showToast('求解出错: ' + (e instanceof Error ? e.message : String(e)));
    }

    updateSolveButton();
  }, 50);
}

function handleCopy(): void {
  const text = solutionMoves.join(' ');
  navigator.clipboard.writeText(text).then(() => {
    showToast('公式已复制到剪贴板');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('公式已复制到剪贴板');
  });
}

function handlePlayPause(): void {
  if (!renderer) return;

  const currentState = animationState || (toSolverState(cubeState) || createSolvedState());

  if (animController.playbackState === 'idle' || animController.playbackState === 'paused') {
    // Reset to original state if starting from beginning
    if (animController.currentIndex === -1) {
      animationState = currentState;
      // Rebuild the cube with the current state
      renderer.updateColors(currentState);
    }
    // Initialize moves if not already set
    if (animController.moves !== solutionMoves || animController.moves.length === 0) {
      setMoves(animController, solutionMoves);
    }
    play(animController, renderer, currentState, (newState, moveIndex) => {
      animationState = newState;
      renderer?.updateColors(newState);
      updateAnimationUI(animController.playbackState, moveIndex);
    });
  } else if (animController.playbackState === 'playing') {
    pause(animController);
  }
}

function handleNextStep(): void {
  if (!renderer) return;

  // Pause if currently playing
  if (animController.playbackState === 'playing') {
    pause(animController);
  }

  const currentState = animationState || (toSolverState(cubeState) || createSolvedState());

  if (animController.moves.length === 0) {
    setMoves(animController, solutionMoves);
  }

  if (animController.currentIndex === -1) {
    animationState = currentState;
    renderer.updateColors(currentState);
  }

  stepForward(animController, renderer, currentState, (newState, moveIndex) => {
    animationState = newState;
    renderer?.updateColors(newState);
    updateAnimationUI('paused', moveIndex);
  });
}

function handlePrevStep(): void {
  if (!renderer) return;
  if (animController.currentIndex <= 0) return;

  // Pause if currently playing
  if (animController.playbackState === 'playing') {
    pause(animController);
  }

  const currentState = animationState || (toSolverState(cubeState) || createSolvedState());

  if (animController.moves.length === 0) {
    setMoves(animController, solutionMoves);
  }

  stepBackward(animController, renderer, currentState, (newState, moveIndex) => {
    animationState = newState;
    renderer?.updateColors(newState);
    updateAnimationUI('paused', moveIndex);
  });
}

function handleStepSliderChange(targetIndex: number): void {
  if (!renderer) return;
  if (solutionMoves.length === 0) return;

  // Pause if currently playing
  if (animController.playbackState === 'playing') {
    pause(animController);
  }

  const originalState = toSolverState(cubeState) || createSolvedState();

  // Apply moves up to targetIndex
  let newState = [...originalState] as CubeState;
  for (let i = 0; i <= targetIndex; i++) {
    newState = applyMoveToStateSimple(newState, solutionMoves[i]);
  }

  animController.currentIndex = targetIndex;
  animController.playbackState = targetIndex < 0 ? 'idle' : 'paused';
  animationState = targetIndex < 0 ? null : newState;
  renderer.updateColors(targetIndex < 0 ? originalState : newState);
  updateAnimationUI(targetIndex < 0 ? 'idle' : 'paused', targetIndex);
}

function handleResetAnimation(): void {
  resetAnimation(animController);
  animationState = null;
  const originalState = toSolverState(cubeState) || createSolvedState();
  renderer?.updateColors(originalState);
  updateAnimationUI('idle', -1);
  updateStepSlider();
}

// Simple move application using the solver library
function applyMoveToStateSimple(state: CubeState, move: Move): CubeState {
  try {
    const cube = Cube.fromString(state.join(''));
    cube.move(move);
    return cube.asString().split('') as CubeState;
  } catch {
    return state;
  }
}

// ============================================================
// UI Updates
// ============================================================
function updateRendererColors(): void {
  if (!renderer) return;
  renderer.updateColors(cubeState);
}

function updateUndoRedoButtons(): void {
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement;
  if (undoBtn) undoBtn.disabled = !canUndo(stateHistory);
  if (redoBtn) redoBtn.disabled = !canRedo(stateHistory);
}

function updateSolveButton(): void {
  const btn = document.getElementById('btn-solve') as HTMLButtonElement;
  if (!btn) return;

  const allColored = cubeState.every(s => s !== null);
  btn.disabled = !allColored || !isSolverReady();

  if (isSolverReady()) {
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      计算最少步骤复原
    `;
  } else {
    btn.innerHTML = `
      <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
      初始化求解器...
    `;
  }
}

function updateStickerProgress(): void {
  const count = countColoredStickers(cubeState);
  const el = document.getElementById('colored-count');
  if (el) el.textContent = String(count);
}

function showSolutionSection(moves: Move[]): void {
  const section = document.getElementById('solution-section');
  const animSection = document.getElementById('animation-section');
  if (section) section.style.display = '';
  if (animSection) animSection.style.display = '';

  const moveCount = document.getElementById('move-count');
  if (moveCount) moveCount.textContent = String(moves.length);

  const formula = document.getElementById('solution-formula');
  if (formula) {
    formula.innerHTML = moves.map((m, i) =>
      `<span class="move-tag" data-index="${i}">${m}</span>`
    ).join('');
  }

  const totalSteps = document.getElementById('total-steps');
  if (totalSteps) totalSteps.textContent = String(moves.length);

  const currentStep = document.getElementById('current-step');
  if (currentStep) currentStep.textContent = '0';

  // Initialize step slider
  const slider = document.getElementById('step-slider') as HTMLInputElement;
  if (slider) {
    slider.min = '-1';
    slider.max = String(moves.length - 1);
    slider.value = '-1';
  }
}

function hideSolutionSection(): void {
  const section = document.getElementById('solution-section');
  const animSection = document.getElementById('animation-section');
  if (section) section.style.display = 'none';
  if (animSection) animSection.style.display = 'none';
}

function updateAnimationUI(state: PlaybackState, index: number): void {
  const playBtn = document.getElementById('btn-anim-play');
  const currentStep = document.getElementById('current-step');
  const moveDisplay = document.getElementById('current-move-display');

  if (playBtn) {
    if (state === 'playing') {
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
      playBtn.title = '暂停';
    } else {
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      playBtn.title = '播放';
    }
  }

  if (currentStep) {
    currentStep.textContent = index >= 0 ? String(index + 1) : '0';
  }

  // Sync step slider
  const slider = document.getElementById('step-slider') as HTMLInputElement;
  if (slider) {
    slider.value = String(index);
  }

  // Highlight current move in formula
  document.querySelectorAll('.move-tag').forEach(el => el.classList.remove('active'));
  if (index >= 0) {
    const activeTag = document.querySelector(`.move-tag[data-index="${index}"]`);
    if (activeTag) activeTag.classList.add('active');
  }

  // Show current move
  if (moveDisplay) {
    if (index >= 0 && index < solutionMoves.length) {
      moveDisplay.textContent = `当前: ${solutionMoves[index]}`;
    } else {
      moveDisplay.textContent = '';
    }
  }
}

function updateStepSlider(): void {
  const slider = document.getElementById('step-slider') as HTMLInputElement;
  if (slider) {
    slider.value = String(animController.currentIndex);
  }
}

function showValidation(errors: string[]): void {
  const section = document.getElementById('validation-section');
  const errorsEl = document.getElementById('validation-errors');
  if (section && errorsEl) {
    section.style.display = '';
    errorsEl.innerHTML = errors.map(e => `<div class="error-item">⚠ ${e}</div>`).join('');
  }
}

function hideValidation(): void {
  const section = document.getElementById('validation-section');
  if (section) section.style.display = 'none';
}


function updateNetDisplay(): void {
  const container = document.getElementById('net-display');
  if (!container) return;

  const faces: FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const netLayout: (FaceName | null)[][] = [
    [null, 'U' as FaceName, null, null],
    ['L' as FaceName, 'F' as FaceName, 'R' as FaceName, 'B' as FaceName],
    [null, 'D' as FaceName, null, null],
  ];

  let html = '<div class="net-grid">';
  for (const row of netLayout) {
    html += '<div class="net-row">';
    for (const face of row) {
      if (face) {
        const faceIdx = faces.indexOf(face);
        const stickers = cubeState.slice(faceIdx * 9, faceIdx * 9 + 9);
        html += `<div class="net-face" data-face="${face}">`;
        html += `<div class="net-face-label">${FACE_LABELS[face]}</div>`;
        html += '<div class="net-stickers">';
        for (let i = 0; i < 9; i++) {
          const color = stickers[i];
          const bg = color ? FACE_COLORS[color] : '#333';
          html += `<div class="net-sticker" data-index="${faceIdx * 9 + i}" style="background-color:${bg}"></div>`;
        }
        html += '</div></div>';
      } else {
        html += '<div class="net-face-empty"></div>';
      }
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Add click handlers for net stickers
  container.querySelectorAll('.net-sticker').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt((el as HTMLElement).dataset.index || '0');
      handleStickerClick(Math.floor(idx / 9), idx);
    });
  });
}

// ============================================================
// Toast Notifications
// ============================================================
function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
