import * as THREE from "three";
import { GRENADE_FUSE, GRENADE_COOLDOWN, GRENADE_GRAVITY, GRENADE_THROW_SPD, GRENADE_THROW_UP } from "../config";
import { scene, camera } from "../scene/setup";
import { mapBlocks } from "../scene/map";
import { socket } from "../network/socket";
import { playGrenadeThrowSound, playExplosionSound } from "./audio";
import { triggerScreenShake } from "./headBob";

interface ActiveGrenade {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  fuse: number;
}

interface GrenadeStepResult {
  exploded: boolean;
}

let activeGrenade: ActiveGrenade | null = null;
let grenadeCooldown = 0;

// Remote grenades (visual only, thrown by other players)
const remoteGrenades: ActiveGrenade[] = [];
const _tmpGrenadePos = new THREE.Vector3();

export function cleanupRemoteGrenades() {
  // Remove all remote grenade meshes immediately (called when server sends grenade_explode)
  for (const g of remoteGrenades) scene.remove(g.mesh);
  remoteGrenades.length = 0;
}

const grenadeGeo = new THREE.SphereGeometry(0.12, 8, 8);
const grenadeMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1b, roughness: 0.6 });

let hudGrenadeEl: HTMLElement | null = null;
let hudGrenadeCd: HTMLElement | null = null;

function getHudElements() {
  if (!hudGrenadeEl) hudGrenadeEl = document.getElementById("hud-grenade");
  if (!hudGrenadeCd) hudGrenadeCd = document.getElementById("hud-grenade-cd");
}

export function throwGrenade(controls: { isLocked: boolean }, isDead: boolean) {
  if (!controls.isLocked || isDead || activeGrenade || grenadeCooldown > 0) return;

  const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  origin.y -= 0.2;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);

  const vel = forward.clone().multiplyScalar(GRENADE_THROW_SPD);
  vel.y += GRENADE_THROW_UP;

  mesh.position.copy(origin);
  scene.add(mesh);

  activeGrenade = { mesh, vel, fuse: GRENADE_FUSE };
  grenadeCooldown = GRENADE_COOLDOWN;

  playGrenadeThrowSound();

  socket.emit("grenade_launched", {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    velocity: { x: vel.x, y: vel.y, z: vel.z },
  });
}

export function spawnRemoteGrenade(origin: THREE.Vector3, vel: THREE.Vector3) {
  const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
  mesh.position.copy(origin);
  scene.add(mesh);
  remoteGrenades.push({ mesh, vel: vel.clone(), fuse: GRENADE_FUSE });
}

export function explodeGrenade(pos: THREE.Vector3) {
  playExplosionSound();

  // Distance-based screen shake — stronger when closer
  const dist = camera.position.distanceTo(pos);
  const MAX_SHAKE_DIST = 20;
  if (dist < MAX_SHAKE_DIST) {
    const intensity = 0.8 * (1 - dist / MAX_SHAKE_DIST);
    triggerScreenShake(intensity);
  }

  const flashGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.9 });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.copy(pos);
  scene.add(flash);

  let start: number | null = null;
  const DURATION = 0.6; // seconds
  const expandFlash = (timestamp: number) => {
    if (start === null) start = timestamp;
    const t = Math.min((timestamp - start) / 1000 / DURATION, 1);
    flash.scale.setScalar(1 + t * 14);
    flashMat.opacity = Math.max(0, 0.9 * (1 - t));
    if (t < 1) requestAnimationFrame(expandFlash);
    else scene.remove(flash);
  };
  requestAnimationFrame(expandFlash);

  const debrisGeo = new THREE.SphereGeometry(0.06, 4, 4);
  for (let i = 0; i < 16; i++) {
    const debrisMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const d = new THREE.Mesh(debrisGeo, debrisMat);
    d.position.copy(pos);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random(),
      (Math.random() - 0.5) * 2,
    ).normalize().multiplyScalar(4 + Math.random() * 4);
    scene.add(d);
    let dStart: number | null = null;
    const DEBRIS_DUR = 0.8;
    const animDebris = (ts: number) => {
      if (dStart === null) dStart = ts;
      const dt = Math.min((ts - dStart) / 1000 / DEBRIS_DUR, 1);
      d.position.addScaledVector(dir, 0.016);
      d.position.y = Math.max(0.1, d.position.y - 0.08);
      if (dt < 1) requestAnimationFrame(animDebris);
      else scene.remove(d);
    };
    requestAnimationFrame(animDebris);
  }
}

export function updateGrenade(delta: number) {
  if (grenadeCooldown > 0) {
    grenadeCooldown -= delta;
    if (grenadeCooldown < 0) grenadeCooldown = 0;
  }
  getHudElements();
  if (hudGrenadeEl) {
    hudGrenadeEl.style.opacity = grenadeCooldown > 0 ? "0.45" : "1";
  }
  if (hudGrenadeCd) {
    hudGrenadeCd.textContent = grenadeCooldown > 0
      ? Math.ceil(grenadeCooldown) + "s"
      : "";
  }

  if (activeGrenade) {
    const g = activeGrenade;
    const step = _stepGrenade(g, delta);
    if (step.exploded) {
      const ep = g.mesh.position;
      scene.remove(g.mesh);
      activeGrenade = null;

      socket.emit("grenade_throw", {
        explosionPos: { x: ep.x, y: ep.y, z: ep.z },
      });
    }
  }

  // Update remote grenades (visual only)
  for (let i = remoteGrenades.length - 1; i >= 0; i--) {
    const g = remoteGrenades[i];
    const step = _stepGrenade(g, delta);
    if (step.exploded) {
      scene.remove(g.mesh);
      remoteGrenades.splice(i, 1);
    }
  }
}

function _stepGrenade(g: ActiveGrenade, delta: number): GrenadeStepResult {
  g.fuse -= delta;
  g.vel.y += GRENADE_GRAVITY * delta;

  _tmpGrenadePos.copy(g.mesh.position).addScaledVector(g.vel, delta);

  if (_tmpGrenadePos.y <= 0.12) {
    _tmpGrenadePos.y = 0.12;
    g.vel.y = Math.abs(g.vel.y) * 0.35;
    g.vel.x *= 0.6;
    g.vel.z *= 0.6;
    if (Math.abs(g.vel.y) < 0.5) g.vel.y = 0;
  }

  _resolveMapCollision(_tmpGrenadePos, g);
  g.mesh.position.copy(_tmpGrenadePos);

  return { exploded: g.fuse <= 0 };
}

function _resolveMapCollision(nextPos: THREE.Vector3, g: ActiveGrenade): void {
  for (let i = 0; i < mapBlocks.length; i++) {
    const box = mapBlocks[i];
    const geo = box.geometry as THREE.BoxGeometry;
    const hw = geo.parameters.width / 2 + 0.15;
    const hh = geo.parameters.height / 2 + 0.15;
    const hd = geo.parameters.depth / 2 + 0.15;
    const bp = box.position;

    if (
      Math.abs(nextPos.x - bp.x) < hw &&
      Math.abs(nextPos.y - bp.y) < hh &&
      Math.abs(nextPos.z - bp.z) < hd
    ) {
      const overlapX = hw - Math.abs(nextPos.x - bp.x);
      const overlapZ = hd - Math.abs(nextPos.z - bp.z);
      if (overlapX < overlapZ) {
        nextPos.x = g.mesh.position.x;
        g.vel.x *= -0.4;
      } else {
        nextPos.z = g.mesh.position.z;
        g.vel.z *= -0.4;
      }
    }
  }
}
