import * as THREE from "three";
import { camera } from "../scene/setup";

const MAX_PITCH = Math.PI / 2 - 0.05;
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

// Base look angles (driven by mouse + recoil baked in)
const look = { yaw: 0, pitch: 0 };

// ─── Recoil ──────────────────────────────────────────────────────────────────
const RECOIL_PER_SHOT_PITCH = 0.006; // radians of upward kick per shot
const RECOIL_PER_SHOT_YAW = 0.003; // radians of horizontal kick per shot

let _shotsSinceReset = 0;

function _apply(): void {
  const p = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, look.pitch));
  _euler.set(p, look.yaw, 0);
  camera.quaternion.setFromEuler(_euler);
}

/** Called every frame (no-op now — no recovery). */
export function updateRecoil(_delta: number, _isFiring: boolean): void {
  // Crosshair stays wherever it lands; no automatic recovery.
}

/** Called once per shot fired. */
export function addRecoil(): void {
  _shotsSinceReset++;

  // Pitch: kick the view upward
  look.pitch += RECOIL_PER_SHOT_PITCH;

  // Yaw: alternate left/right with slight randomness
  const side =
    (_shotsSinceReset % 2 === 0 ? 1 : -1) * (0.4 + Math.random() * 0.6);
  look.yaw += RECOIL_PER_SHOT_YAW * side;

  _apply();
}

/** Update the base look angles from mouse input. */
export function addMouseDelta(dYaw: number, dPitch: number): void {
  look.yaw += dYaw;
  look.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, look.pitch + dPitch));
  _apply();
}

export function getLookAngles() {
  return look;
}
