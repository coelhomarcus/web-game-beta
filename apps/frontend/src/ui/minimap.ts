import * as THREE from "three";
import { camera, scene } from "../scene/setup";
import { otherPlayers } from "../player/PlayerModel";

const SIZE = 160;
const MAP_RANGE = 28; // orthographic half-extent in world units
const CAM_HEIGHT = 80; // height above scene for top-down camera

// ─── DOM: wrapper + WebGL canvas + 2D overlay canvas ─────────────────────────
const wrapper = document.createElement("div");
wrapper.id = "minimap";

// WebGL canvas — 3D scene rendered here
const minimapCanvas = document.createElement("canvas");
minimapCanvas.style.cssText = "position:absolute;inset:0;";
wrapper.appendChild(minimapCanvas);

// 2D overlay canvas — player arrow and enemy dots drawn on top of WebGL
const overlayCanvas = document.createElement("canvas");
overlayCanvas.width = SIZE;
overlayCanvas.height = SIZE;
overlayCanvas.style.cssText = "position:absolute;inset:0;";
wrapper.appendChild(overlayCanvas);

document.body.appendChild(wrapper);

const overlayCtx = overlayCanvas.getContext("2d")!;

// ─── Top-down orthographic camera ─────────────────────────────────────────────
// OrthographicCamera(left, right, top, bottom, near, far)
const topDownCam = new THREE.OrthographicCamera(
  -MAP_RANGE,
  MAP_RANGE,
  MAP_RANGE,
  -MAP_RANGE,
  1,
  200,
);

// ─── Dedicated minimap WebGLRenderer ─────────────────────────────────────────
const minimapRenderer = new THREE.WebGLRenderer({
  canvas: minimapCanvas,
  antialias: false,
  alpha: false,
});
minimapRenderer.setSize(SIZE, SIZE);
minimapRenderer.setPixelRatio(1);
minimapRenderer.shadowMap.enabled = false;
minimapRenderer.setClearColor(0x1a2332, 1);

// Reused for projection math
const _projPos = new THREE.Vector3();

// ─── Update every frame ──────────────────────────────────────────────────────
export function updateMinimap() {
  const px = camera.position.x;
  const pz = camera.position.z;

  // Extract player yaw so the map is heading-up (player always faces screen-top)
  const q = camera.quaternion;
  const yaw = 2 * Math.atan2(q.y, q.w);

  // Place camera above the player; tilt the "up" vector so the player's
  // facing direction maps to screen-up (heading-up minimap behaviour).
  topDownCam.position.set(px, CAM_HEIGHT, pz);
  topDownCam.up.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  topDownCam.lookAt(px, 0, pz);
  topDownCam.updateMatrixWorld();

  // Render the real 3D scene without fog (everything would be fogged at this height)
  const savedFog = scene.fog;
  scene.fog = null;
  minimapRenderer.render(scene, topDownCam);
  scene.fog = savedFog;

  // ─── 2D overlay: enemy dots + player arrow ────────────────────────────────
  overlayCtx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Enemy dots — project each player's world position to minimap canvas coords
  for (const id of Object.keys(otherPlayers)) {
    const group = otherPlayers[id];
    if (!group.visible) continue;

    _projPos.set(group.position.x, group.position.y, group.position.z);
    _projPos.project(topDownCam); // NDC [-1, 1]

    // Skip if outside the orthographic frustum
    if (Math.abs(_projPos.x) > 1 || Math.abs(_projPos.y) > 1) continue;

    const ex = ((_projPos.x + 1) / 2) * SIZE;
    const ey = ((1 - _projPos.y) / 2) * SIZE;

    overlayCtx.beginPath();
    overlayCtx.arc(ex, ey, 4, 0, Math.PI * 2);
    overlayCtx.fillStyle = "#f87171";
    overlayCtx.fill();
    overlayCtx.strokeStyle = "#fca5a5";
    overlayCtx.lineWidth = 1;
    overlayCtx.stroke();
  }

  // Player arrow — always at the center of a heading-up minimap
  overlayCtx.save();
  overlayCtx.translate(cx, cy);

  // Chevron/arrow shape pointing up
  overlayCtx.beginPath();
  overlayCtx.moveTo(0, -8); // tip
  overlayCtx.lineTo(5, 5);
  overlayCtx.lineTo(0, 1); // inner notch
  overlayCtx.lineTo(-5, 5);
  overlayCtx.closePath();
  overlayCtx.fillStyle = "#38bdf8";
  overlayCtx.fill();
  overlayCtx.strokeStyle = "#7dd3fc";
  overlayCtx.lineWidth = 1.5;
  overlayCtx.stroke();

  overlayCtx.restore();
}
