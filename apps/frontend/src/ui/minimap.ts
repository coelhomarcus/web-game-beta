import * as THREE from "three";
import { camera } from "../scene/setup";
import { mapBlocks } from "../scene/map";
import { otherPlayers } from "../player/PlayerModel";

const SIZE = 160;
const MAP_RANGE = 50; // world goes from -50 to 50
const SCALE = SIZE / (MAP_RANGE * 2);

// ─── Create DOM ───────────────────────────────────────────────────────────────
const wrapper = document.createElement("div");
wrapper.id = "minimap";

const canvas = document.createElement("canvas");
canvas.width = SIZE;
canvas.height = SIZE;
wrapper.appendChild(canvas);

document.body.appendChild(wrapper);

const ctx = canvas.getContext("2d")!;

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function worldToMinimap(wx: number, wz: number): [number, number] {
  return [
    (wx + MAP_RANGE) * SCALE,
    (wz + MAP_RANGE) * SCALE,
  ];
}

// ─── Update every frame ──────────────────────────────────────────────────────
export function updateMinimap() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Clip everything to a circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  // Background
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Grid lines (subtle)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const pos = (i / 10) * SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(SIZE, pos);
    ctx.stroke();
  }

  // Map blocks
  for (const box of mapBlocks) {
    const geo = box.geometry as THREE.BoxGeometry;
    const w = geo.parameters.width * SCALE;
    const d = geo.parameters.depth * SCALE;
    const [mx, mz] = worldToMinimap(box.position.x, box.position.z);
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.fillRect(mx - w / 2, mz - d / 2, w, d);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mx - w / 2, mz - d / 2, w, d);
  }

  // Other players (dots)
  for (const id of Object.keys(otherPlayers)) {
    const group = otherPlayers[id];
    if (!group.visible) continue;
    const [mx, mz] = worldToMinimap(group.position.x, group.position.z);
    ctx.beginPath();
    ctx.arc(mx, mz, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#f87171";
    ctx.fill();
    ctx.strokeStyle = "#fca5a5";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Local player (arrow showing direction)
  const [px, pz] = worldToMinimap(camera.position.x, camera.position.z);

  // Direction indicator (field of view cone)
  const angle = -camera.rotation.y;
  const fovHalf = Math.PI / 6;
  const coneLen = 14;
  ctx.beginPath();
  ctx.moveTo(px, pz);
  ctx.lineTo(
    px + Math.sin(angle - fovHalf) * coneLen,
    pz - Math.cos(angle - fovHalf) * coneLen,
  );
  ctx.lineTo(
    px + Math.sin(angle + fovHalf) * coneLen,
    pz - Math.cos(angle + fovHalf) * coneLen,
  );
  ctx.closePath();
  ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
  ctx.fill();

  // Player dot
  ctx.beginPath();
  ctx.arc(px, pz, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#38bdf8";
  ctx.fill();
  ctx.strokeStyle = "#7dd3fc";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Restore context (removes circular clip)
  ctx.restore();
}
