// 3D Rubik's Cube Renderer using Three.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Move, ColorName } from './constants';
import { FACE_COLORS, INTERNAL_COLOR } from './constants';

/** Callback type when a sticker is clicked */
export type StickerClickCallback = (faceIndex: number, stickerIndex: number) => void;

/** Animation callback type */
export type AnimationCompleteCallback = () => void;

interface StickerMesh extends THREE.Mesh {
  userData: {
    faceIndex: number; // 0-5 (U,R,F,D,L,B)
    stickerIndex: number; // 0-8 (position on face)
    globalIndex: number; // 0-53 (global sticker index)
  };
}

export class CubeRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private cubeGroup: THREE.Group;
  private stickers: StickerMesh[] = [];
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private container: HTMLElement;
  private onStickerClick: StickerClickCallback | null = null;
  private highlightFace: number = -1; // Currently animating face
  private animationId: number = 0;
  private isAnimating = false;

  // Move animation state
  private moveAnimation: {
    axis: THREE.Vector3;
    angle: number;
    currentAngle: number;
    cubies: THREE.Object3D[];
    originalParents: THREE.Object3D[];
    pivot: THREE.Group;
    onComplete: AnimationCompleteCallback;
  } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.cubeGroup = new THREE.Group();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.init();
  }

  private init(): void {
    // Renderer setup
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    // Camera
    this.camera.position.set(4.5, 3.5, 4.5);
    this.camera.lookAt(0, 0, 0);

    // Controls
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 15;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 8, 5);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-5, -3, -5);
    this.scene.add(dirLight2);

    // Build cube
    this.scene.add(this.cubeGroup);
    this.buildCube();

    // Events
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    window.addEventListener('resize', this.onResize.bind(this));

    // Start render loop
    this.animate();
  }

  private buildCube(): void {
    // Clear existing
    while (this.cubeGroup.children.length > 0) {
      this.cubeGroup.remove(this.cubeGroup.children[0]);
    }
    this.stickers = [];

    const cubieSize = 0.93;
    const gap = 1.02;
    const stickerSize = 0.82;
    const stickerOffset = cubieSize / 2 + 0.01;

    // Create 26 visible cubies (3x3x3 minus center)
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // Skip center

          const cubie = new THREE.Group();
          cubie.position.set(x * gap, y * gap, z * gap);
          cubie.userData = { x, y, z };

          // Black cubie body
          const bodyGeom = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);
          const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.4,
            metalness: 0.1,
          });
          const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
          cubie.add(bodyMesh);

          // Add sticker meshes on visible faces
          // U face (y = 1): normal +Y
          if (y === 1) {
            this.addSticker(cubie, x, y, z, 0, // faceIndex 0 = U
              new THREE.Vector3(0, stickerOffset, 0),
              new THREE.Euler(-Math.PI / 2, 0, 0),
              stickerSize);
          }
          // D face (y = -1): normal -Y
          if (y === -1) {
            this.addSticker(cubie, x, y, z, 3, // faceIndex 3 = D
              new THREE.Vector3(0, -stickerOffset, 0),
              new THREE.Euler(Math.PI / 2, 0, 0),
              stickerSize);
          }
          // R face (x = 1): normal +X
          if (x === 1) {
            this.addSticker(cubie, x, y, z, 1, // faceIndex 1 = R
              new THREE.Vector3(stickerOffset, 0, 0),
              new THREE.Euler(0, Math.PI / 2, 0),
              stickerSize);
          }
          // L face (x = -1): normal -X
          if (x === -1) {
            this.addSticker(cubie, x, y, z, 4, // faceIndex 4 = L
              new THREE.Vector3(-stickerOffset, 0, 0),
              new THREE.Euler(0, -Math.PI / 2, 0),
              stickerSize);
          }
          // F face (z = 1): normal +Z
          if (z === 1) {
            this.addSticker(cubie, x, y, z, 2, // faceIndex 2 = F
              new THREE.Vector3(0, 0, stickerOffset),
              new THREE.Euler(0, 0, 0),
              stickerSize);
          }
          // B face (z = -1): normal -Z
          if (z === -1) {
            this.addSticker(cubie, x, y, z, 5, // faceIndex 5 = B
              new THREE.Vector3(0, 0, -stickerOffset),
              new THREE.Euler(0, Math.PI, 0),
              stickerSize);
          }

          this.cubeGroup.add(cubie);
        }
      }
    }
  }

  private addSticker(
    cubie: THREE.Group,
    cx: number, cy: number, cz: number,
    faceIndex: number,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    size: number
  ): void {
    const stickerGeom = new THREE.PlaneGeometry(size, size);
    // Rounded corners via shape
    const color = INTERNAL_COLOR;
    const stickerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.FrontSide,
    });

    const sticker = new THREE.Mesh(stickerGeom, stickerMat) as unknown as StickerMesh;
    sticker.position.copy(position);
    sticker.rotation.copy(rotation);
    sticker.userData = {
      faceIndex,
      stickerIndex: this.getStickerIndex(cx, cy, cz, faceIndex),
      globalIndex: faceIndex * 9 + this.getStickerIndex(cx, cy, cz, faceIndex),
    };

    cubie.add(sticker);
    this.stickers.push(sticker);
  }

  /** Get sticker index (0-8) within a face based on cubie position */
  private getStickerIndex(cx: number, cy: number, cz: number, faceIndex: number): number {
    // Row-major order matching rubik-solver library convention:
    // Face U: row = cz+1 (front z=1 at bottom row 2), col = cx+1
    // Face R: row = 1-cy, col = 1-cz (front z=1 at left col 0)
    // Face F: row = 1-cy, col = cx+1
    // Face D: row = 1-cz (front z=1 at top row 0), col = cx+1
    // Face L: row = 1-cy, col = cz+1 (front z=1 at right col 2)
    // Face B: row = 1-cy, col = 1-cx

    let row: number, col: number;
    switch (faceIndex) {
      case 0: // U - library: front(z=1)=row2, back(z=-1)=row0
        row = cz + 1; col = cx + 1; break;
      case 1: // R - library: front(z=1)=col0, back(z=-1)=col2
        row = 1 - cy; col = 1 - cz; break;
      case 2: // F - standard orientation
        row = 1 - cy; col = cx + 1; break;
      case 3: // D - library: front(z=1)=row0, back(z=-1)=row2
        row = 1 - cz; col = cx + 1; break;
      case 4: // L - library: front(z=1)=col2, back(z=-1)=col0
        row = 1 - cy; col = cz + 1; break;
      case 5: // B - standard orientation
        row = 1 - cy; col = 1 - cx; break;
      default:
        row = 0; col = 0;
    }
    return row * 3 + col;
  }

  /** Update sticker colors from cube state (null = uncolored, shows as dark gray) */
  updateColors(state: (ColorName | null)[]): void {
    for (const sticker of this.stickers) {
      const { globalIndex } = sticker.userData;
      const colorName = state[globalIndex];
      if (colorName && FACE_COLORS[colorName]) {
        (sticker.material as THREE.MeshStandardMaterial).color.set(FACE_COLORS[colorName]);
      } else {
        (sticker.material as THREE.MeshStandardMaterial).color.set(0x2a2a2a);
      }
    }
  }

  /** Highlight a specific face during animation */
  highlightMovingFace(faceIndex: number): void {
    this.highlightFace = faceIndex;
    for (const sticker of this.stickers) {
      if (sticker.userData.faceIndex === faceIndex) {
        const mat = sticker.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(0x333333);
      }
    }
  }

  clearHighlight(): void {
    this.highlightFace = -1;
    for (const sticker of this.stickers) {
      const mat = sticker.material as THREE.MeshStandardMaterial;
      mat.emissive = new THREE.Color(0x000000);
    }
  }

  /** Set sticker click handler */
  setStickerClickHandler(handler: StickerClickCallback): void {
    this.onStickerClick = handler;
  }

  private onClick(event: MouseEvent): void {
    if (this.isAnimating || !this.onStickerClick) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshes = this.stickers.map(s => s as THREE.Mesh);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object as StickerMesh;
      this.onStickerClick(hit.userData.faceIndex, hit.userData.globalIndex);
    }
  }

  /** Get move axis and angle for animation */
  private getMoveAxisAndAngle(move: Move): { axis: THREE.Vector3; angle: number } {
    // All CW moves use -PI/2 around the face's outward normal axis.
    // Verified: library's physical sticker flow matches R_x(-PI/2) for R,
    // R_y(-PI/2) for U, R_z(-PI/2) for F, etc.
    // CCW moves invert the angle. Double moves use PI.
    const PI2 = Math.PI / 2;
    switch (move) {
      case 'U': return { axis: new THREE.Vector3(0, 1, 0), angle: -PI2 };
      case "U'": return { axis: new THREE.Vector3(0, 1, 0), angle: PI2 };
      case 'U2': return { axis: new THREE.Vector3(0, 1, 0), angle: Math.PI };
      case 'D': return { axis: new THREE.Vector3(0, -1, 0), angle: -PI2 };
      case "D'": return { axis: new THREE.Vector3(0, -1, 0), angle: PI2 };
      case 'D2': return { axis: new THREE.Vector3(0, -1, 0), angle: Math.PI };
      case 'R': return { axis: new THREE.Vector3(1, 0, 0), angle: -PI2 };
      case "R'": return { axis: new THREE.Vector3(1, 0, 0), angle: PI2 };
      case 'R2': return { axis: new THREE.Vector3(1, 0, 0), angle: Math.PI };
      case 'L': return { axis: new THREE.Vector3(-1, 0, 0), angle: -PI2 };
      case "L'": return { axis: new THREE.Vector3(-1, 0, 0), angle: PI2 };
      case 'L2': return { axis: new THREE.Vector3(-1, 0, 0), angle: Math.PI };
      case 'F': return { axis: new THREE.Vector3(0, 0, 1), angle: -PI2 };
      case "F'": return { axis: new THREE.Vector3(0, 0, 1), angle: PI2 };
      case 'F2': return { axis: new THREE.Vector3(0, 0, 1), angle: Math.PI };
      case 'B': return { axis: new THREE.Vector3(0, 0, -1), angle: -PI2 };
      case "B'": return { axis: new THREE.Vector3(0, 0, -1), angle: PI2 };
      case 'B2': return { axis: new THREE.Vector3(0, 0, -1), angle: Math.PI };
    }
  }

  /** Get face index from move name */
  private getMoveFaceIndex(move: Move): number {
    const base = move.charAt(0);
    switch (base) {
      case 'U': return 0;
      case 'R': return 1;
      case 'F': return 2;
      case 'D': return 3;
      case 'L': return 4;
      case 'B': return 5;
      default: return 0;
    }
  }

  /** Get which cubies belong to a face */
  private getCubiesForFace(faceIndex: number): THREE.Object3D[] {
    return this.cubeGroup.children.filter(cubie => {
      const { x, y, z } = cubie.userData;
      switch (faceIndex) {
        case 0: return y === 1;   // U
        case 1: return x === 1;   // R
        case 2: return z === 1;   // F
        case 3: return y === -1;  // D
        case 4: return x === -1;  // L
        case 5: return z === -1;  // B
        default: return false;
      }
    });
  }

  /** Animate a single move */
  animateMove(move: Move, duration: number, onComplete: AnimationCompleteCallback): void {
    if (this.isAnimating) return;

    const { axis, angle } = this.getMoveAxisAndAngle(move);
    const faceIndex = this.getMoveFaceIndex(move);
    const cubies = this.getCubiesForFace(faceIndex);

    // Highlight moving face
    this.highlightMovingFace(faceIndex);

    // Create pivot at origin
    const pivot = new THREE.Group();
    this.scene.add(pivot);

    // Remember original parents
    const originalParents = cubies.map(c => c.parent!);

    // Move cubies to pivot
    for (const cubie of cubies) {
      // Convert to world position then to pivot local
      const worldPos = new THREE.Vector3();
      cubie.getWorldPosition(worldPos);
      const worldQuat = new THREE.Quaternion();
      cubie.getWorldQuaternion(worldQuat);

      this.cubeGroup.remove(cubie);
      pivot.add(cubie);

      cubie.position.copy(worldPos);
      cubie.quaternion.copy(worldQuat);
    }

    this.isAnimating = true;
    this.moveAnimation = {
      axis,
      angle,
      currentAngle: 0,
      cubies,
      originalParents,
      pivot,
      onComplete,
    };

    // Animate in render loop
    const startTime = performance.now();
    const animateStep = (time: number) => {
      if (!this.moveAnimation) return;

      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Easing: ease in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const targetAngle = this.moveAnimation.angle * eased;
      const deltaAngle = targetAngle - this.moveAnimation.currentAngle;

      pivot.rotateOnAxis(this.moveAnimation.axis, deltaAngle);
      this.moveAnimation.currentAngle = targetAngle;

      if (t >= 1) {
        this.finishMoveAnimation();
        return;
      }

      requestAnimationFrame(animateStep);
    };

    requestAnimationFrame(animateStep);
  }

  private finishMoveAnimation(): void {
    if (!this.moveAnimation) return;

    const { cubies, pivot, onComplete } = this.moveAnimation;

    // Move cubies back to cube group
    for (let i = 0; i < cubies.length; i++) {
      const cubie = cubies[i];

      // Get world position/rotation
      const worldPos = new THREE.Vector3();
      cubie.getWorldPosition(worldPos);
      const worldQuat = new THREE.Quaternion();
      cubie.getWorldQuaternion(worldQuat);

      pivot.remove(cubie);
      this.cubeGroup.add(cubie);

      // Convert world position to cubeGroup local
      const groupWorldPos = new THREE.Vector3();
      this.cubeGroup.getWorldPosition(groupWorldPos);
      const groupWorldQuat = new THREE.Quaternion();
      this.cubeGroup.getWorldQuaternion(groupWorldQuat);
      const invGroupQuat = groupWorldQuat.invert();

      cubie.position.copy(worldPos.sub(groupWorldPos).applyQuaternion(invGroupQuat));
      cubie.quaternion.copy(invGroupQuat.multiply(worldQuat));

      // Round position to nearest grid point
      const gap = 1.02;
      cubie.position.x = Math.round(cubie.position.x / gap) * gap;
      cubie.position.y = Math.round(cubie.position.y / gap) * gap;
      cubie.position.z = Math.round(cubie.position.z / gap) * gap;

      // Snap cubie's grid coordinates
      cubie.userData.x = Math.round(cubie.position.x / gap);
      cubie.userData.y = Math.round(cubie.position.y / gap);
      cubie.userData.z = Math.round(cubie.position.z / gap);

      // Update sticker faceIndex and globalIndex after rotation
      this.updateStickerData(cubie);
    }

    // Remove pivot
    this.scene.remove(pivot);

    this.isAnimating = false;
    this.moveAnimation = null;
    this.clearHighlight();
    onComplete();
  }

  /** Update sticker faceIndex/globalIndex after a rotation animation */
  private updateStickerData(cubie: THREE.Object3D): void {
    const { x: cx, y: cy, z: cz } = cubie.userData;

    // For each sticker on this cubie, determine its new face
    for (const child of cubie.children) {
      if (!(child as THREE.Mesh).isMesh) continue;
      const sticker = child as unknown as StickerMesh;
      if (sticker.userData.globalIndex === undefined) continue;

      // Get sticker's world normal direction
      const stickerNormal = new THREE.Vector3(0, 0, 1); // Plane default normal
      stickerNormal.applyQuaternion(sticker.getWorldQuaternion(new THREE.Quaternion()));

      // Determine which face the sticker is on based on its normal
      let faceIndex: number;
      if (stickerNormal.y > 0.9) faceIndex = 0;       // U
      else if (stickerNormal.x > 0.9) faceIndex = 1;   // R
      else if (stickerNormal.z > 0.9) faceIndex = 2;   // F
      else if (stickerNormal.y < -0.9) faceIndex = 3;  // D
      else if (stickerNormal.x < -0.9) faceIndex = 4;  // L
      else if (stickerNormal.z < -0.9) faceIndex = 5;  // B
      else continue; // Skip non-face-aligned stickers

      const stickerIndex = this.getStickerIndex(cx, cy, cz, faceIndex);
      sticker.userData.faceIndex = faceIndex;
      sticker.userData.stickerIndex = stickerIndex;
      sticker.userData.globalIndex = faceIndex * 9 + stickerIndex;
    }
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** Reset camera to default view */
  resetCamera(): void {
    this.camera.position.set(4.5, 3.5, 4.5);
    this.camera.lookAt(0, 0, 0);
    this.controls.reset();
  }

  /** Check if currently animating */
  getIsAnimating(): boolean {
    return this.isAnimating;
  }

  /** Dispose of resources */
  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.renderer.domElement.removeEventListener('click', this.onClick.bind(this));
    window.removeEventListener('resize', this.onResize.bind(this));
    this.renderer.dispose();
    this.controls.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
