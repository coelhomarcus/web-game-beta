import * as THREE from "three";
import { camera } from "../scene/setup";
import { velocity, isOnGround } from "./physics";

// Tuning constants
const BOB_SPEED = 8; // oscillations per second while walking
const BOB_AMPLITUDE_Y = 0.045; // vertical camera displacement (units)
const BOB_ROLL_AMPLITUDE = 0.016; // weapon roll (radians)
const LERP_SPEED = 10; // how fast bob fades in/out when stopping

let bobTimer = 0;
let bobY = 0;
let bobRoll = 0;

// Reference to the first-person weapon so it can be swayed independently
let fpWeaponRef: THREE.Group | null = null;
let weaponBaseY = 0;

// Reference to the first-person arms rig
let fpArmsRef: THREE.Group | null = null;

/** Call this whenever the active FP weapon changes (creation or swap). */
export function setFpWeapon(weapon: THREE.Group | null): void {
  fpWeaponRef = weapon;
  if (weapon) {
    weaponBaseY = weapon.position.y;
  }
}

/** Call this whenever the arms rig changes (creation or weapon swap). */
export function setFpArms(arms: THREE.Group | null): void {
  fpArmsRef = arms;
}

/**
 * Remove the bobbing offset that was applied last frame.
 * Must be called BEFORE updatePhysics so physics works on the real player Y.
 */
export function removeBobOffset(): void {
  camera.position.y -= bobY;
}

/**
 * Compute and apply the new bobbing offset for this frame.
 * Must be called AFTER updatePhysics (and after the network emit).
 *
 * @param delta  Frame delta-time in seconds.
 * @param active Whether the player is alive and in-game (bob only when true).
 */
export function applyBobOffset(delta: number, active: boolean): void {
  const hSpeed = active
    ? Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
    : 0;

  const isMoving = hSpeed > 0.5 && isOnGround;

  if (isMoving) bobTimer += delta * BOB_SPEED;

  const targetY = isMoving ? Math.sin(bobTimer) * BOB_AMPLITUDE_Y : 0;
  const targetRoll = isMoving
    ? Math.sin(bobTimer * 0.5) * BOB_ROLL_AMPLITUDE
    : 0;

  const lerp = Math.min(1, delta * LERP_SPEED);
  bobY += (targetY - bobY) * lerp;
  bobRoll += (targetRoll - bobRoll) * lerp;

  // Apply vertical bob to the camera
  camera.position.y += bobY;

  // Apply independent weapon sway so the gun feels alive
  if (fpWeaponRef) {
    fpWeaponRef.position.y = weaponBaseY + bobY * 0.9;
    fpWeaponRef.rotation.z = -bobRoll * 2;
  }

  // Arms follow the weapon bob exactly
  if (fpArmsRef) {
    fpArmsRef.position.y = bobY * 0.9;
    fpArmsRef.rotation.z = -bobRoll * 2;
  }
}
