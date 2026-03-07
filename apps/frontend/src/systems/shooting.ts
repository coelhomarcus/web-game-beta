import * as THREE from "three";
import { BULLET_SPEED, BULLET_MAX_LIFETIME, BULLET_RADIUS } from "../config";
import { scene, camera, sceneFog } from "../scene/setup";
import { mapBlocks } from "../scene/map";
import { otherPlayers } from "../player/PlayerModel";
import { isPlayerInvincible } from "../player/PlayerModel";
import { socket } from "../network/socket";
import { playShootSound, playAwpSound, playReloadSound } from "./audio";
import { showHitMarker, stopLocalInvincibleBlink } from "../ui/overlays";
import {
  updateHudAmmo,
  updateHudWeapon,
  startReloadRing,
  stopReloadRing,
} from "../ui/hud";
import { showScope, hideScope } from "../ui/overlays";
import { controls } from "./input";
import { addRecoil, updateRecoil } from "./cameraLook";
import { isSliding } from "./physics";
import { getNormalSensitivity, getScopeSensitivity } from "../ui/settings";
import { triggerScreenShake, triggerWeaponRecoil } from "./headBob";

// ─── Weapon definitions ───────────────────────────────────────────────────────
export interface WeaponDef {
  id: "ar" | "awp";
  name: string;
  label: string;
  magSize: number;
  reloadTime: number; // seconds
  fireRate: number; // min seconds between shots (0 = no limit)
  damage: number; // hp damage per hit (100 = one-shot kill)
  bulletColor: number;
  bulletSpeed: number;
  bulletMaxLife: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  ar: {
    id: "ar",
    name: "FAL",
    label: "1",
    magSize: 30,
    reloadTime: 2.0,
    fireRate: 0.09,
    damage: 15,
    bulletColor: 0xf3a833,
    bulletSpeed: BULLET_SPEED,
    bulletMaxLife: BULLET_MAX_LIFETIME,
  },
  awp: {
    id: "awp",
    name: "AWP",
    label: "2",
    magSize: 1,
    reloadTime: 3.2,
    fireRate: 1.1, // bolt-action delay
    damage: 60,
    bulletColor: 0x6dead6,
    bulletSpeed: 800,
    bulletMaxLife: 3.0,
  },
};

export const MAG_SIZE = WEAPONS.ar.magSize;

// ─── Weapon state ─────────────────────────────────────────────────────────────
let currentWeaponId: "ar" | "awp" = "ar";
let ammo = WEAPONS.ar.magSize;
let isReloading = false;
let reloadTimer = 0;
let fireCooldown = 0;

// AR reserve pool — 30 in mag + 90 reserve
const AR_RESERVE_START = 90;
let arReserve = AR_RESERVE_START;

// Auto-fire state (AR only)
let _mouseHeld = false;

// AWP reserve pool — 1 in chamber + 5 in reserve = 6 total
const AWP_RESERVE_START = 5;
let awpReserve = AWP_RESERVE_START;

// Scope state (AWP only)
let isScoped = false;

export function setMouseHeld(held: boolean): void {
  _mouseHeld = held;
}

export function getCurrentWeapon(): WeaponDef {
  return WEAPONS[currentWeaponId];
}
export function getAmmo() {
  return ammo;
}
export function getIsReloading() {
  return isReloading;
}
export function getIsScoped() {
  return isScoped;
}

// ─── Switch weapon ────────────────────────────────────────────────────────────
export function switchWeapon(id: "ar" | "awp") {
  if (id === currentWeaponId) return;
  if (isReloading) return; // Don't switch mid-reload
  // Exit scope if switching away from AWP
  if (isScoped) exitScope();
  currentWeaponId = id;
  ammo = WEAPONS[id].magSize;
  isReloading = false;
  reloadTimer = 0;
  fireCooldown = 0;
  _mouseHeld = false;
  if (id === "awp") {
    awpReserve = AWP_RESERVE_START;
    updateHudAmmo(ammo, false, awpReserve);
    document.body.classList.add("awp");
  } else {
    updateHudAmmo(ammo, false, arReserve);
    document.body.classList.remove("awp");
  }
  updateHudWeapon(WEAPONS[id]);
  window.dispatchEvent(new CustomEvent("weapon-switched"));
}

// ─── Scope (AWP right-click toggle) ───────────────────────────────────────────
export function toggleScope() {
  if (currentWeaponId !== "awp") return;
  if (isScoped) {
    exitScope();
  } else {
    enterScope();
  }
}

export function enterScope() {
  if (currentWeaponId !== "awp" || isScoped) return;
  isScoped = true;
  showScope();
  document.body.classList.add("scoped");
  camera.fov = 20;
  camera.updateProjectionMatrix();
  controls.pointerSpeed = getScopeSensitivity();
  // Push fog far so scoped view is clear
  sceneFog.near = 40;
  sceneFog.far = 200;
  window.dispatchEvent(
    new CustomEvent("scope-changed", { detail: { scoped: true } }),
  );
}

export function exitScope() {
  if (!isScoped) return;
  isScoped = false;
  hideScope();
  document.body.classList.remove("scoped");
  camera.fov = 75;
  camera.updateProjectionMatrix();
  controls.pointerSpeed = getNormalSensitivity();
  // Restore normal fog
  sceneFog.near = 80;
  sceneFog.far = 250;
  window.dispatchEvent(
    new CustomEvent("scope-changed", { detail: { scoped: false } }),
  );
}

// ─── Reload ───────────────────────────────────────────────────────────────────
export function startReload() {
  const w = getCurrentWeapon();
  if (isReloading || ammo === w.magSize) return;
  // Only reload if there are reserve bullets
  if (currentWeaponId === "awp" && awpReserve <= 0) return;
  if (currentWeaponId === "ar" && arReserve <= 0) return;
  isReloading = true;
  reloadTimer = w.reloadTime;
  if (isScoped) exitScope();
  playReloadSound();
  startReloadRing(w.reloadTime);
  updateHudAmmo(ammo, true);
}

export function updateAmmo(delta: number) {
  if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - delta);

  // Auto-fire for AR while mouse is held
  if (
    _mouseHeld &&
    currentWeaponId === "ar" &&
    !isReloading &&
    fireCooldown <= 0
  ) {
    const controls = { isLocked: document.pointerLockElement !== null };
    handleShoot(false, controls);
  }

  // Camera recoil recovery
  updateRecoil(delta, _mouseHeld && currentWeaponId === "ar" && !isReloading && !isSliding);

  if (!isReloading) return;
  reloadTimer -= delta;
  if (reloadTimer <= 0) {
    isReloading = false;
    stopReloadRing();
    if (currentWeaponId === "awp") {
      ammo = WEAPONS.awp.magSize;
      awpReserve = Math.max(0, awpReserve - 1);
      updateHudAmmo(ammo, false, awpReserve);
    } else {
      const need = WEAPONS.ar.magSize - ammo;
      const take = Math.min(need, arReserve);
      ammo += take;
      arReserve -= take;
      updateHudAmmo(ammo, false, arReserve);
    }
  }
}

/** Refill all reserve ammo to max. Returns true if anything was refilled. */
export function refillAmmo(): boolean {
  const arFull = arReserve >= AR_RESERVE_START;
  const awpFull = awpReserve >= AWP_RESERVE_START;
  if (arFull && awpFull) return false;
  arReserve = AR_RESERVE_START;
  awpReserve = AWP_RESERVE_START;
  if (currentWeaponId === "awp") {
    updateHudAmmo(ammo, isReloading, awpReserve);
  } else {
    updateHudAmmo(ammo, isReloading, arReserve);
  }
  return true;
}

// ─── Bullets ──────────────────────────────────────────────────────────────────
interface ActiveBullet {
  mesh: THREE.Mesh;
  dir: THREE.Vector3;
  lifeTime: number;
  speed: number;
  maxLife: number;
}

const activeBullets: ActiveBullet[] = [];
const bulletGeo = new THREE.SphereGeometry(0.06, 6, 6);
const matCache: Record<number, THREE.MeshBasicMaterial> = {};
const _rayCenter = new THREE.Vector2(0, 0);
const _tmpShootOrigin = new THREE.Vector3();
const _tmpShootDir = new THREE.Vector3();
const _shotTargets: THREE.Object3D[] = [];

function getBulletMat(color: number): THREE.MeshBasicMaterial {
  if (!matCache[color])
    matCache[color] = new THREE.MeshBasicMaterial({ color });
  return matCache[color];
}

export function createVisualBullet(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  color = 0xf3a833,
  speed = BULLET_SPEED,
  maxLife = BULLET_MAX_LIFETIME,
) {
  const mesh = new THREE.Mesh(bulletGeo, getBulletMat(color));
  mesh.position.copy(origin);
  scene.add(mesh);
  activeBullets.push({
    mesh,
    dir: dir.clone().normalize(),
    lifeTime: 0,
    speed,
    maxLife,
  });
}

const raycaster = new THREE.Raycaster();
raycaster.near = 0.1;

function findPlayerGroup(o: THREE.Object3D): THREE.Group | null {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (
      cur instanceof THREE.Group &&
      Object.values(otherPlayers).includes(cur as THREE.Group)
    )
      return cur;
    cur = cur.parent;
  }
  return null;
}

/** Returns true if the hit mesh belongs to the headGroup hierarchy. */
function isHeadHit(hitObject: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = hitObject;
  while (cur) {
    if (cur.name === "headGroup") return true;
    // Stop once we reach the player root group
    if (cur instanceof THREE.Group && Object.values(otherPlayers).includes(cur))
      break;
    cur = cur.parent;
  }
  return false;
}

export function handleShoot(isDead: boolean, controls: { isLocked: boolean }) {
  if (!controls.isLocked || isDead) return;
  if (isReloading || ammo <= 0) {
    if (ammo <= 0 && !isReloading) startReload();
    return;
  }
  const w = getCurrentWeapon();
  if (fireCooldown > 0) return; // Bolt-action / fire rate limiter

  // Cancel invincibility the moment the player shoots
  stopLocalInvincibleBlink();
  socket.emit("end_invincible");

  // Consume ammo & set cooldown
  ammo--;
  fireCooldown = w.fireRate;
  if (currentWeaponId === "awp") {
    updateHudAmmo(ammo, false, awpReserve);
    if (ammo === 0 && awpReserve > 0) startReload();
  } else {
    updateHudAmmo(ammo, false, arReserve);
    if (ammo === 0) startReload();
    // CS:GO-style recoil kick
    if (!isSliding) addRecoil();
  }

  // AWP: exit scope on shoot
  if (currentWeaponId === "awp") {
    playAwpSound();
    if (isScoped) exitScope();
    if (!isSliding) {
      triggerScreenShake(0.5);
      triggerWeaponRecoil(0.12);
    }
  } else {
    playShootSound();
    if (!isSliding) {
      triggerScreenShake(0.045);
      triggerWeaponRecoil(0.04);
    }
  }

  raycaster.setFromCamera(_rayCenter, camera);
  _shotTargets.length = 0;
  for (const id in otherPlayers) _shotTargets.push(otherPlayers[id]);
  for (let i = 0; i < mapBlocks.length; i++) _shotTargets.push(mapBlocks[i]);

  const hits = raycaster.intersectObjects(_shotTargets, true);
  const firstPlayerHit = hits.find((h) => findPlayerGroup(h.object) !== null);
  if (firstPlayerHit) {
    const wallHit = hits.find((h) =>
      mapBlocks.includes(h.object as THREE.Mesh),
    );
    const playerBlocked = wallHit && wallHit.distance < firstPlayerHit.distance;
    if (!playerBlocked) {
      const grp = findPlayerGroup(firstPlayerHit.object)!;
      const tid = Object.keys(otherPlayers).find(
        (id) => otherPlayers[id] === grp,
      );
      if (tid) {
        if (isPlayerInvincible(tid)) {
          // Don't show hitmarker or send damage for invincible players
        } else {
          const headshot = isHeadHit(firstPlayerHit.object);
          const dmg = headshot ? w.damage * 2 : w.damage;
          socket.emit("hit_player", {
            targetId: tid,
            damage: dmg,
            weaponId: w.id,
            headshot,
          });
          showHitMarker(headshot);
        }
      }
    }
  }

  camera.getWorldPosition(_tmpShootOrigin);
  _tmpShootOrigin.y -= 0.1;
  camera.getWorldDirection(_tmpShootDir);
  createVisualBullet(
    _tmpShootOrigin,
    _tmpShootDir,
    w.bulletColor,
    w.bulletSpeed,
    w.bulletMaxLife,
  );
  socket.emit("shoot", {
    origin: {
      x: _tmpShootOrigin.x,
      y: _tmpShootOrigin.y,
      z: _tmpShootOrigin.z,
    },
    direction: { x: _tmpShootDir.x, y: _tmpShootDir.y, z: _tmpShootDir.z },
    color: w.bulletColor,
  });
}

function bulletHitsBlock(pos: THREE.Vector3): boolean {
  for (const box of mapBlocks) {
    const geo = box.geometry as THREE.BoxGeometry;
    const hw = geo.parameters.width / 2 + BULLET_RADIUS;
    const hh = geo.parameters.height / 2 + BULLET_RADIUS;
    const hd = geo.parameters.depth / 2 + BULLET_RADIUS;
    if (
      Math.abs(pos.x - box.position.x) < hw &&
      Math.abs(pos.y - box.position.y) < hh &&
      Math.abs(pos.z - box.position.z) < hd
    )
      return true;
  }
  return false;
}

export function updateBullets(delta: number) {
  for (let i = activeBullets.length - 1; i >= 0; i--) {
    const b = activeBullets[i];
    const step = b.speed * delta;
    b.mesh.position.addScaledVector(b.dir, step);
    if (bulletHitsBlock(b.mesh.position)) {
      scene.remove(b.mesh);
      activeBullets.splice(i, 1);
      continue;
    }
    b.lifeTime += delta;
    if (b.lifeTime > b.maxLife || b.mesh.position.y <= 0) {
      scene.remove(b.mesh);
      activeBullets.splice(i, 1);
    }
  }
}
