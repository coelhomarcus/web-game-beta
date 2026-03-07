import * as THREE from "three";
import { camera } from "../scene/setup";
import { mapBlocks } from "../scene/map";
import { otherPlayers } from "../player/PlayerModel";

const SIZE = 160;
const MAP_RANGE = 28; // zoom: smaller = more zoomed in
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

// ─── Update every frame ──────────────────────────────────────────────────────
export function updateMinimap() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Player world position
  const px = camera.position.x;
  const pz = camera.position.z;

  // Camera yaw — extracted from quaternion to avoid Euler wrap-around glitch.
  // atan2 on the quaternion Y/W components gives a continuous [-π, π] angle
  // that matches the visual yaw without any discontinuous jumps.
  const q = camera.quaternion;
  const angle = 2 * Math.atan2(q.y, q.w);

  ctx.save();

  // Clip to minimap bounds
  ctx.beginPath();
  ctx.rect(0, 0, SIZE, SIZE);
  ctx.clip();

  // Background
  ctx.fillStyle = "rgba(10, 16, 28, 0.9)";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Translate to center, rotate so player faces up
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Helper: convert a world point to rotated minimap coords (relative to player)
  function worldToLocal(wx: number, wz: number): [number, number] {
    return [(wx - px) * SCALE, (wz - pz) * SCALE];
  }

  // Grid lines (subtle) — drawn in rotated space, large enough to cover
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 0.5;
  const gridStep = SCALE * 10; // one grid cell = 10 world units
  const gridHalf = SIZE * 1.5; // large enough to cover when rotated
  for (let g = -gridHalf; g <= gridHalf; g += gridStep) {
    ctx.beginPath();
    ctx.moveTo(g, -gridHalf);
    ctx.lineTo(g, gridHalf);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-gridHalf, g);
    ctx.lineTo(gridHalf, g);
    ctx.stroke();
  }

  // Map blocks
  for (const box of mapBlocks) {
    const geo = box.geometry as THREE.BoxGeometry;
    const w = geo.parameters.width * SCALE;
    const d = geo.parameters.depth * SCALE;
    const [lx, lz] = worldToLocal(box.position.x, box.position.z);
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.fillRect(lx - w / 2, lz - d / 2, w, d);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(lx - w / 2, lz - d / 2, w, d);
  }

  // Other players (dots) — also in rotated space
  for (const id of Object.keys(otherPlayers)) {
    const group = otherPlayers[id];
    if (!group.visible) continue;
    const [lx, lz] = worldToLocal(group.position.x, group.position.z);
    ctx.beginPath();
    ctx.arc(lx, lz, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#f87171";
    ctx.fill();
    ctx.strokeStyle = "#fca5a5";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Restore rotation — draw player fixed at center, always pointing up
  ctx.restore();

  // FOV cone — always pointing up (north)
  const fovHalf = Math.PI / 6;
  const coneLen = 14;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(-fovHalf) * coneLen, cy - Math.cos(-fovHalf) * coneLen);
  ctx.lineTo(cx + Math.sin(fovHalf) * coneLen, cy - Math.cos(fovHalf) * coneLen);
  ctx.closePath();
  ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
  ctx.fill();

  // Player dot — always at center
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#38bdf8";
  ctx.fill();
  ctx.strokeStyle = "#7dd3fc";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
