/**
 * Floating 3D character preview — rendered into a full-screen right-side panel.
 * Transparent background, character faces forward, mouse-drag rotates Y.
 */
import * as THREE from "three";

const FACE_LS_KEY = "fps_arena_face";

let previewRenderer: THREE.WebGLRenderer | null = null;
let previewAnimId: number | null = null;
let previewFacePlane: THREE.Mesh | null = null;
let previewFaceVisor: THREE.Mesh | null = null;
let previewBodyMat: THREE.MeshStandardMaterial | null = null;

// Mouse-drag state
let isDragging = false;
let dragLastX = 0;
let currentRotY = 0;
let targetRotY = 0;

export function initCharacterPreview(container: HTMLElement): void {
  if (previewRenderer) destroyCharacterPreview();

  const W = container.clientWidth || 480;
  const H = container.clientHeight || window.innerHeight;

  const previewScene = new THREE.Scene();
  // No background — canvas is transparent

  const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 50);
  cam.position.set(0, 0.1, 3.2);
  cam.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);
  previewRenderer = renderer;

  // Lighting
  previewScene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(3, 6, 4);
  sun.castShadow = true;
  previewScene.add(sun);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
  fill.position.set(-4, 2, -3);
  previewScene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(0, 4, -5);
  previewScene.add(rim);

  // Subtle shadow-only ground disc
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.75;
  ground.receiveShadow = true;
  previewScene.add(ground);

  const savedColor = localStorage.getItem("fps_arena_color") ?? "#4a90e2";
  const { group, facePlane, faceVisor, bodyMat } =
    buildPreviewCharacter(savedColor);
  previewFacePlane = facePlane;
  previewFaceVisor = faceVisor;
  previewBodyMat = bodyMat;
  previewScene.add(group);

  // Reset rotation state
  currentRotY = 0;
  targetRotY = 0;

  // ── Mouse-drag handlers ──────────────────────────────────────────────────
  const el = renderer.domElement;

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    dragLastX = e.clientX;
    el.style.cursor = "grabbing";
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragLastX;
    dragLastX = e.clientX;
    targetRotY += dx * 0.012;
  };
  const onMouseUp = () => {
    isDragging = false;
    el.style.cursor = "grab";
  };

  // Touch support
  const onTouchStart = (e: TouchEvent) => {
    isDragging = true;
    dragLastX = e.touches[0].clientX;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - dragLastX;
    dragLastX = e.touches[0].clientX;
    targetRotY += dx * 0.012;
  };
  const onTouchEnd = () => {
    isDragging = false;
  };

  el.style.cursor = "grab";
  el.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd);

  // Store cleanup on the renderer for destroyCharacterPreview
  (renderer as any)._cleanup = () => {
    el.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    el.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  };

  // Handle container resize
  const ro = new ResizeObserver(() => {
    const nW = container.clientWidth;
    const nH = container.clientHeight;
    renderer.setSize(nW, nH);
    cam.aspect = nW / nH;
    cam.updateProjectionMatrix();
  });
  ro.observe(container);
  (renderer as any)._ro = ro;

  // ── Render loop ──────────────────────────────────────────────────────────
  let t = 0;
  const loop = () => {
    previewAnimId = requestAnimationFrame(loop);
    t += 0.016;

    // Smooth rotation toward target
    currentRotY += (targetRotY - currentRotY) * 0.12;
    group.rotation.y = currentRotY;

    // Subtle idle float
    group.position.y = Math.sin(t * 1.6) * 0.03;

    renderer.render(previewScene, cam);
  };
  loop();
}

/** Call this after storeFaceDataUrl to update the preview face texture. */
export function updatePreviewFaceTexture(texture: THREE.Texture): void {
  if (!previewFacePlane) return;
  const mat = previewFacePlane.material as THREE.MeshStandardMaterial;
  mat.map = texture;
  mat.needsUpdate = true;
  previewFacePlane.visible = true;
  if (previewFaceVisor) previewFaceVisor.visible = false;
}

/** Update the body colour on the preview character. */
export function updatePreviewBodyColor(hex: string): void {
  if (!previewBodyMat) return;
  previewBodyMat.color.set(hex);
}

/** Remove face texture from preview (if photo is cleared). */
export function clearPreviewFaceTexture(): void {
  if (!previewFacePlane) return;
  const mat = previewFacePlane.material as THREE.MeshStandardMaterial;
  mat.map = null;
  mat.needsUpdate = true;
  previewFacePlane.visible = false;
  if (previewFaceVisor) previewFaceVisor.visible = true;
}

/** Dispose the preview renderer — call when the game starts. */
export function destroyCharacterPreview(): void {
  if (previewAnimId !== null) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
  if (previewRenderer) {
    (previewRenderer as any)._cleanup?.();
    (previewRenderer as any)._ro?.disconnect();
    previewRenderer.dispose();
    previewRenderer.domElement.remove();
    previewRenderer = null;
  }
  previewFacePlane = null;
  previewFaceVisor = null;
  previewBodyMat = null;
  isDragging = false;
}

// ── localStorage helpers ─────────────────────────────────────────────────────

export function saveFaceToStorage(dataUrl: string): void {
  try {
    localStorage.setItem(FACE_LS_KEY, dataUrl);
  } catch {
    /* quota */
  }
}

export function loadFaceFromStorage(): string | null {
  try {
    return localStorage.getItem(FACE_LS_KEY);
  } catch {
    return null;
  }
}

export function clearFaceFromStorage(): void {
  try {
    localStorage.removeItem(FACE_LS_KEY);
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function buildPreviewCharacter(color: string | number): {
  group: THREE.Group;
  facePlane: THREE.Mesh;
  faceVisor: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
} {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
  torso.castShadow = true;
  grp.add(torso);

  // Head group
  const headGrp = new THREE.Group();
  headGrp.position.set(0, 0.55, 0);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
  head.castShadow = true;
  headGrp.add(head);

  // Visor (shown when no face photo)
  const faceVisor = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.12, 0.1),
    darkMat,
  );
  faceVisor.name = "faceVisor";
  faceVisor.position.set(0, 0, 0.21); // +Z faces the camera
  headGrp.add(faceVisor);

  // Face plane (hidden until photo uploaded)
  const facePlaneMat = new THREE.MeshStandardMaterial({
    roughness: 0.55,
    metalness: 0.0,
  });
  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.4),
    facePlaneMat,
  );
  facePlane.name = "facePlane";
  facePlane.rotation.y = 0; // already faces +Z (toward camera)
  facePlane.position.set(0, 0, 0.21);
  facePlane.visible = false;
  headGrp.add(facePlane);

  grp.add(headGrp);

  // Arms
  grp.add(makeLimb(mat, -0.27, 0.2, 0, 0.18, 0.55, 0.18, -0.27));
  grp.add(makeLimb(mat, 0.27, 0.2, 0, 0.18, 0.55, 0.18, -0.27));

  // Legs
  grp.add(makeLimb(mat, -0.12, -0.35, 0, 0.2, 0.6, 0.2, -0.3));
  grp.add(makeLimb(mat, 0.12, -0.35, 0, 0.2, 0.6, 0.2, -0.3));

  return { group: grp, facePlane, faceVisor, bodyMat: mat };
}

function makeLimb(
  mat: THREE.MeshStandardMaterial,
  px: number,
  py: number,
  pz: number,
  w: number,
  h: number,
  d: number,
  meshOffY: number,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(px, py, pz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = meshOffY;
  m.castShadow = true;
  g.add(m);
  return g;
}
