import * as THREE from "three";
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  GRAVITY,
  JUMP_FORCE,
  ACCELERATION,
  FRICTION,
  MAP_HALF_SIZE,
} from "../config";
import { mapBlocks } from "../scene/map";
import { camera } from "../scene/setup";

export const velocity = new THREE.Vector3();
const moveDir = new THREE.Vector3();

// World-space impulse applied directly to camera.position (bypasses camera rotation)
const _worldImpulse = new THREE.Vector3();
const KNOCKBACK_FRICTION = 1.8; // must match FLING_FRICTION in PlayerModel.ts

/** Apply a world-space knockback (XYZ in metres/s). Safe to call from any system. */
export function applyKnockback(force: THREE.Vector3): void {
  // Vertical component goes straight into velocity so the standard
  // ground-check / gravity path handles it correctly.
  velocity.y += force.y;
  isOnGround = false;

  // Horizontal component is world-space (camera-rotation-independent)
  _worldImpulse.x += force.x;
  _worldImpulse.z += force.z;
}

export let moveForward = false;
export let moveBackward = false;
export let moveLeft = false;
export let moveRight = false;
export let wantsJump = false;
export let isOnGround = false;
let _jumpsUsed = 0;
const MAX_JUMPS = 2;

// ─── Slide state ──────────────────────────────────────────────────────────────
const SLIDE_DURATION = 0.75;
const SLIDE_SPEED_BOOST = 1.5;
const SLIDE_FRICTION = 1.2;
const SLIDE_HEIGHT_DROP = 0.7; // how much camera drops during slide
const SLIDE_HEIGHT_LERP = 14; // speed of camera drop/rise
const MIN_SPEED_TO_SLIDE = 2.0;

export let isSliding = false;
let _slideTimer = 0;
let _slideHeightOffset = 0; // current smooth offset (0 → SLIDE_HEIGHT_DROP)
// World-space slide velocity captured at slide start so camera rotation
// doesn't change the slide direction mid-slide.
const _slideWorldVel = new THREE.Vector3();

export function getSlideHeightOffset(): number {
  return _slideHeightOffset;
}

export function startSlide(): boolean {
  if (isSliding || !isOnGround) return false;
  const hSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  if (hSpeed < MIN_SPEED_TO_SLIDE) return false;
  isSliding = true;
  _slideTimer = SLIDE_DURATION;
  // Boost current velocity
  const boost = SLIDE_SPEED_BOOST;
  velocity.x *= boost;
  velocity.z *= boost;
  // Convert camera-local velocity to world-space and lock the direction
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  fwd.y = 0;
  fwd.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0;
  right.normalize();
  // velocity.z = forward component (negative = forward), velocity.x = right component (negative = right)
  _slideWorldVel.set(0, 0, 0);
  _slideWorldVel.addScaledVector(fwd, -velocity.z);
  _slideWorldVel.addScaledVector(right, -velocity.x);
  return true;
}

export function cancelSlide(): void {
  if (!isSliding) return;
  isSliding = false;
  _slideTimer = 0;
  _slideWorldVel.set(0, 0, 0);
}

export function setMoveForward(v: boolean) {
  moveForward = v;
}
export function setMoveBackward(v: boolean) {
  moveBackward = v;
}
export function setMoveLeft(v: boolean) {
  moveLeft = v;
}
export function setMoveRight(v: boolean) {
  moveRight = v;
}
export function setWantsJump(v: boolean) {
  wantsJump = v;
}
export function setIsOnGround(v: boolean) {
  isOnGround = v;
}
export function canJump(): boolean {
  return _jumpsUsed < MAX_JUMPS;
}

function resolveBoxCollision(pos: THREE.Vector3, box: THREE.Mesh) {
  const geo = box.geometry as THREE.BoxGeometry;
  const hw = geo.parameters.width / 2 + PLAYER_RADIUS;
  const hh = geo.parameters.height / 2;
  const hd = geo.parameters.depth / 2 + PLAYER_RADIUS;
  const { x: bx, y: by, z: bz } = box.position;
  const pBot = pos.y - PLAYER_HEIGHT,
    pTop = pos.y;
  const bBot = by - hh,
    bTop = by + hh;
  const ox = hw - Math.abs(pos.x - bx);
  const oy = Math.min(pTop, bTop) - Math.max(pBot, bBot);
  const oz = hd - Math.abs(pos.z - bz);
  if (ox > 0 && oy > 0 && oz > 0) {
    if (ox < oz && ox < oy) {
      pos.x += ox * Math.sign(pos.x - bx);
      velocity.x = 0;
    } else if (oz < ox && oz < oy) {
      pos.z += oz * Math.sign(pos.z - bz);
      velocity.z = 0;
    } else if (pos.y > by) {
      pos.y = bTop + PLAYER_HEIGHT;
      if (velocity.y < 0) {
        velocity.y = 0;
        isOnGround = true;
        _jumpsUsed = 0;
      }
    } else {
      pos.y = bBot - 0.01;
      if (velocity.y > 0) velocity.y = 0;
    }
  }
}

export function updatePhysics(
  controls: {
    isLocked: boolean;
    moveRight: (d: number) => void;
    moveForward: (d: number) => void;
  },
  delta: number,
) {
  // ── Slide timers ──────────────────────────────────────────────────────────
  if (isSliding) {
    _slideTimer -= delta;
    if (_slideTimer <= 0) cancelSlide();
  }

  // ── Friction (reduced while sliding) ──────────────────────────────────────
  if (isSliding) {
    // Apply friction to world-space slide velocity
    _slideWorldVel.x -= _slideWorldVel.x * SLIDE_FRICTION * delta;
    _slideWorldVel.z -= _slideWorldVel.z * SLIDE_FRICTION * delta;
  } else {
    velocity.x -= velocity.x * FRICTION * delta;
    velocity.z -= velocity.z * FRICTION * delta;
  }

  // ── Directional input (disabled while sliding) ────────────────────────────
  if (!isSliding) {
    moveDir.z = Number(moveForward) - Number(moveBackward);
    moveDir.x = Number(moveRight) - Number(moveLeft);
    moveDir.normalize();
    if (moveForward || moveBackward)
      velocity.z -= moveDir.z * ACCELERATION * delta;
    if (moveLeft || moveRight) velocity.x -= moveDir.x * ACCELERATION * delta;
  }

  // ── Jump (cancels slide) ──────────────────────────────────────────────────
  if (wantsJump && _jumpsUsed < MAX_JUMPS) {
    if (isSliding) cancelSlide();
    velocity.y = JUMP_FORCE;
    isOnGround = false;
    wantsJump = false;
    _jumpsUsed++;
  }

  // ── Smooth slide height offset ────────────────────────────────────────────
  const targetOffset = isSliding ? SLIDE_HEIGHT_DROP : 0;
  _slideHeightOffset +=
    (targetOffset - _slideHeightOffset) *
    Math.min(1, delta * SLIDE_HEIGHT_LERP);
  if (Math.abs(_slideHeightOffset - targetOffset) < 0.001)
    _slideHeightOffset = targetOffset;

  const groundHeight = PLAYER_HEIGHT - _slideHeightOffset;

  if (isSliding) {
    // Pin camera to the sliding ground so gravity doesn't cause bouncing
    camera.position.y = groundHeight;
    velocity.y = 0;
    isOnGround = true;
    _jumpsUsed = 0;
  } else {
    isOnGround = false;
    velocity.y += GRAVITY * delta;
    camera.position.y += velocity.y * delta;
    if (camera.position.y <= groundHeight) {
      camera.position.y = groundHeight;
      velocity.y = 0;
      isOnGround = true;
      _jumpsUsed = 0;
    }
  }

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  // Slide movement in world-space (camera-independent direction)
  if (isSliding) {
    camera.position.x += _slideWorldVel.x * delta;
    camera.position.z += _slideWorldVel.z * delta;
  }

  // World-space impulse (knockback) — applied directly, decays with low friction
  if (_worldImpulse.lengthSq() > 0.0001) {
    camera.position.x += _worldImpulse.x * delta;
    camera.position.z += _worldImpulse.z * delta;
    _worldImpulse.x -= _worldImpulse.x * KNOCKBACK_FRICTION * delta;
    _worldImpulse.z -= _worldImpulse.z * KNOCKBACK_FRICTION * delta;
    if (_worldImpulse.lengthSq() < 0.01) _worldImpulse.set(0, 0, 0);
  }

  for (const box of mapBlocks) resolveBoxCollision(camera.position, box);
  camera.position.x = Math.max(
    -MAP_HALF_SIZE,
    Math.min(MAP_HALF_SIZE, camera.position.x),
  );
  camera.position.z = Math.max(
    -MAP_HALF_SIZE,
    Math.min(MAP_HALF_SIZE, camera.position.z),
  );
}
