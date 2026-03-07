import * as THREE from "three";
import { PLAYER_HEIGHT, PLAYER_RADIUS, GRAVITY, JUMP_FORCE, ACCELERATION, FRICTION } from "../config";
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

export function setMoveForward(v: boolean) { moveForward = v; }
export function setMoveBackward(v: boolean) { moveBackward = v; }
export function setMoveLeft(v: boolean) { moveLeft = v; }
export function setMoveRight(v: boolean) { moveRight = v; }
export function setWantsJump(v: boolean) { wantsJump = v; }
export function setIsOnGround(v: boolean) { isOnGround = v; }

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
      }
    } else {
      pos.y = bBot - 0.01;
      if (velocity.y > 0) velocity.y = 0;
    }
  }
}

export function updatePhysics(
  controls: { isLocked: boolean; moveRight: (d: number) => void; moveForward: (d: number) => void },
  delta: number,
) {
  velocity.x -= velocity.x * FRICTION * delta;
  velocity.z -= velocity.z * FRICTION * delta;
  moveDir.z = Number(moveForward) - Number(moveBackward);
  moveDir.x = Number(moveRight) - Number(moveLeft);
  moveDir.normalize();
  if (moveForward || moveBackward)
    velocity.z -= moveDir.z * ACCELERATION * delta;
  if (moveLeft || moveRight) velocity.x -= moveDir.x * ACCELERATION * delta;

  if (wantsJump && isOnGround) {
    velocity.y = JUMP_FORCE;
    isOnGround = false;
    wantsJump = false;
  }
  isOnGround = false;
  velocity.y += GRAVITY * delta;
  camera.position.y += velocity.y * delta;
  if (camera.position.y <= PLAYER_HEIGHT) {
    camera.position.y = PLAYER_HEIGHT;
    velocity.y = 0;
    isOnGround = true;
  }

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  // World-space impulse (knockback) — applied directly, decays with low friction
  if (_worldImpulse.lengthSq() > 0.0001) {
    camera.position.x += _worldImpulse.x * delta;
    camera.position.z += _worldImpulse.z * delta;
    _worldImpulse.x -= _worldImpulse.x * KNOCKBACK_FRICTION * delta;
    _worldImpulse.z -= _worldImpulse.z * KNOCKBACK_FRICTION * delta;
    if (_worldImpulse.lengthSq() < 0.01) _worldImpulse.set(0, 0, 0);
  }

  for (const box of mapBlocks) resolveBoxCollision(camera.position, box);
  camera.position.x = Math.max(-49, Math.min(49, camera.position.x));
  camera.position.z = Math.max(-49, Math.min(49, camera.position.z));
}
