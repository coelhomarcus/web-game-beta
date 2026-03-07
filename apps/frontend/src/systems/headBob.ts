import * as THREE from "three";
import { camera } from "../scene/setup";
import { velocity, isOnGround, isSliding } from "./physics";

// Tuning constants
const BOB_SPEED = 8; // oscillations per second while walking
const BOB_AMPLITUDE_Y = 0.045; // vertical camera displacement (units)
const BOB_ROLL_AMPLITUDE = 0.016; // weapon roll (radians)
const LERP_SPEED = 10; // how fast bob fades in/out when stopping

let bobTimer = 0;
let bobY = 0;
let bobRoll = 0;

// ─── Slide camera tilt ─────────────────────────────────────────────────────────
const SLIDE_TILT = 0.12; // radians (~7° roll)
const SLIDE_FOV_BOOST = 6; // degrees added to FOV during slide
let _slideTilt = 0;
let _slideFovOffset = 0;
let _prevSlideFovApplied = 0;

// ─── Screen shake state ───────────────────────────────────────────────────────
let shakeIntensity = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;
const SHAKE_DECAY = 12; // how fast the shake fades out

// ─── Weapon recoil state ──────────────────────────────────────────────────────
let recoilKickZ = 0; // current backward offset
let recoilKickRot = 0; // current upward rotation (pitch)
let recoilTarget = 0; // target kick magnitude
const RECOIL_SNAP = 35; // how fast the gun kicks back
const RECOIL_RECOVER = 8; // how fast the gun returns to rest

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

/** Trigger a screen shake (call from shooting, explosions, etc.). */
export function triggerScreenShake(intensity: number): void {
  shakeIntensity = Math.max(shakeIntensity, intensity);
}

/** Trigger weapon recoil kick (call when firing). */
export function triggerWeaponRecoil(kick: number): void {
  recoilTarget = kick;
}

/**
 * Remove the bobbing offset that was applied last frame.
 * Must be called BEFORE updatePhysics so physics works on the real player Y.
 */
export function removeBobOffset(): void {
  camera.position.y -= bobY;
  // Undo last frame's shake
  camera.position.x -= shakeOffsetX;
  camera.position.y -= shakeOffsetY;
  shakeOffsetX = 0;
  shakeOffsetY = 0;
}

/**
 * Compute and apply the new bobbing offset for this frame.
 * Must be called AFTER updatePhysics (and after the network emit).
 *
 * @param delta  Frame delta-time in seconds.
 * @param active Whether the player is alive and in-game (bob only when true).
 */
export function applyBobOffset(delta: number, active: boolean): void {
  const hSpeed =
    active && !isSliding
      ? Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
      : 0;

  const isMoving = hSpeed > 0.5 && isOnGround && !isSliding;

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

  // Apply screen shake
  if (shakeIntensity > 0.001) {
    shakeOffsetX = (Math.random() * 2 - 1) * shakeIntensity;
    shakeOffsetY = (Math.random() * 2 - 1) * shakeIntensity;
    camera.position.x += shakeOffsetX;
    camera.position.y += shakeOffsetY;
    shakeIntensity *= Math.max(0, 1 - SHAKE_DECAY * delta);
  } else {
    shakeIntensity = 0;
  }

  // ─── Weapon recoil animation ────────────────────────────────────────────
  if (recoilTarget > 0) {
    // Snap toward the kick target
    recoilKickZ +=
      (recoilTarget - recoilKickZ) * Math.min(1, delta * RECOIL_SNAP);
    recoilKickRot +=
      (recoilTarget * 0.6 - recoilKickRot) * Math.min(1, delta * RECOIL_SNAP);
    // Once close enough, start recovery
    if (recoilKickZ >= recoilTarget * 0.9) recoilTarget = 0;
  } else {
    // Smoothly return to rest
    recoilKickZ *= Math.max(0, 1 - RECOIL_RECOVER * delta);
    recoilKickRot *= Math.max(0, 1 - RECOIL_RECOVER * delta);
    if (Math.abs(recoilKickZ) < 0.0005) {
      recoilKickZ = 0;
      recoilKickRot = 0;
    }
  }

  // ─── Slide camera tilt & FOV ────────────────────────────────────────────
  const tiltTarget = isSliding ? SLIDE_TILT : 0;
  const fovTarget = isSliding ? SLIDE_FOV_BOOST : 0;
  const tiltLerp = Math.min(1, delta * 10);
  _slideTilt += (tiltTarget - _slideTilt) * tiltLerp;
  _slideFovOffset += (fovTarget - _slideFovOffset) * tiltLerp;
  if (Math.abs(_slideFovOffset) < 0.05 && !isSliding) _slideFovOffset = 0;
  if (Math.abs(_slideTilt) > 0.001) {
    // Apply roll tilt via the camera's local Z euler component
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    e.z = _slideTilt;
    camera.quaternion.setFromEuler(e);
  }
  // Additive FOV: undo previous frame's offset, apply new one
  const fovDelta = _slideFovOffset - _prevSlideFovApplied;
  if (Math.abs(fovDelta) > 0.01) {
    camera.fov += fovDelta;
    camera.updateProjectionMatrix();
  }
  _prevSlideFovApplied = _slideFovOffset;

  // Apply independent weapon sway so the gun feels alive
  if (fpWeaponRef) {
    fpWeaponRef.position.y = weaponBaseY + bobY * 0.9;
    fpWeaponRef.position.z = -recoilKickZ;
    fpWeaponRef.rotation.z = -bobRoll * 2;
    fpWeaponRef.rotation.x = -recoilKickRot;
  }

  // Arms follow the weapon bob exactly
  if (fpArmsRef) {
    fpArmsRef.position.y = bobY * 0.9;
    fpArmsRef.position.z = -recoilKickZ;
    fpArmsRef.rotation.z = -bobRoll * 2;
    fpArmsRef.rotation.x = -recoilKickRot;
  }
}
