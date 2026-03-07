import * as THREE from "three";
import { BULLET_SPEED, BULLET_MAX_LIFETIME, BULLET_RADIUS } from "../config";
import { scene, camera, sceneFog } from "../scene/setup";
import { mapBlocks } from "../scene/map";
import { otherPlayers } from "../player/PlayerModel";
import { isPlayerInvincible } from "../player/PlayerModel";
import { socket } from "../network/socket";
import { playShootSound, playAwpSound, playReloadSound, playKatanaSlashSound, playKatanaChargeSound } from "./audio";
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
export type WeaponId = "ar" | "awp" | "katana";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  label: string;
  magSize: number;
  reloadTime: number; // seconds
  fireRate: number; // min seconds between shots (0 = no limit)
  damage: number; // hp damage per hit (100 = one-shot kill)
  bulletColor: number;
  bulletSpeed: number;
  bulletMaxLife: number;
  melee?: boolean; // true for melee weapons (no ammo, no bullets)
  meleeRange?: number; // max hit distance for melee weapons
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
  katana: {
    id: "katana",
    name: "KATANA",
    label: "3",
    magSize: Infinity,
    reloadTime: 0,
    fireRate: 0.5, // slash cooldown
    damage: 45,
    bulletColor: 0xff4444,
    bulletSpeed: 0,
    bulletMaxLife: 0,
    melee: true,
    meleeRange: 4.5,
  },
};

export const MAG_SIZE = WEAPONS.ar.magSize;

// ─── Weapon state ─────────────────────────────────────────────────────────────
let currentWeaponId: WeaponId = "ar";
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

// ─── Katana charged leap state ───────────────────────────────────────────────
let _katanaCharging = false;
let _katanaChargeTime = 0;
const KATANA_CHARGE_DURATION = 0.6; // seconds to fully charge
const KATANA_LEAP_RANGE = 25; // max distance to find a target
const KATANA_LEAP_SPEED = 40; // m/s movement towards target
const KATANA_LEAP_DAMAGE = 80; // charged attack damage
let _katanaLeaping = false;
let _katanaLeapTarget: THREE.Vector3 | null = null;
let _katanaLeapTargetId: string | null = null;

export function isKatanaLeaping(): boolean {
  return _katanaLeaping;
}

// ─── Switch weapon ────────────────────────────────────────────────────────────
export function switchWeapon(id: WeaponId) {
  if (id === currentWeaponId) return;
  if (isReloading) return; // Don't switch mid-reload
  // Exit scope if switching away from AWP
  if (isScoped) exitScope();
  // Cancel katana charge if switching away
  _katanaCharging = false;
  _katanaChargeTime = 0;
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
  } else if (id === "katana") {
    updateHudAmmo(Infinity, false, null);
    document.body.classList.remove("awp");
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
  if (currentWeaponId === "katana") return; // Katana doesn't reload
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
  const w = getCurrentWeapon();

  // Melee (katana) path — no ammo, no bullets
  if (w.melee) {
    if (fireCooldown > 0) return;
    stopLocalInvincibleBlink();
    socket.emit("end_invincible");
    fireCooldown = w.fireRate;
    playKatanaSlashSound();
    triggerScreenShake(0.08);
    triggerWeaponRecoil(0.06);
    window.dispatchEvent(new Event("katana-slash"));

    // Melee raycast with range limit
    raycaster.setFromCamera(_rayCenter, camera);
    raycaster.far = w.meleeRange!;
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
        if (tid && !isPlayerInvincible(tid)) {
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
    raycaster.far = Infinity; // restore default
    return;
  }

  // Ranged weapon path
  if (isReloading || ammo <= 0) {
    if (ammo <= 0 && !isReloading) startReload();
    return;
  }
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

// ─── Katana charged leap attack (right-click) ────────────────────────────────
const _leapDir = new THREE.Vector3();
const _playerPos = new THREE.Vector3();

export function startKatanaCharge() {
  if (currentWeaponId !== "katana" || _katanaLeaping || _katanaCharging) return;
  _katanaCharging = true;
  _katanaChargeTime = 0;
  playKatanaChargeSound();
}

export function releaseKatanaCharge(isDead: boolean) {
  if (!_katanaCharging) return;
  _katanaCharging = false;

  if (isDead || _katanaChargeTime < KATANA_CHARGE_DURATION) {
    _katanaChargeTime = 0;
    return;
  }
  _katanaChargeTime = 0;

  // Find the closest player to crosshair within range
  stopLocalInvincibleBlink();
  socket.emit("end_invincible");

  camera.getWorldPosition(_playerPos);
  camera.getWorldDirection(_leapDir);

  let bestTarget: { id: string; pos: THREE.Vector3; dot: number } | null = null;
  for (const id in otherPlayers) {
    if (isPlayerInvincible(id)) continue;
    const grp = otherPlayers[id];
    if (!grp.visible) continue;
    const targetPos = grp.position.clone();
    const toTarget = targetPos.clone().sub(_playerPos);
    const dist = toTarget.length();
    if (dist > KATANA_LEAP_RANGE) continue;
    toTarget.normalize();
    const dot = toTarget.dot(_leapDir);
    if (dot < 0.5) continue; // must be roughly in front (within ~60deg cone)
    if (!bestTarget || dot > bestTarget.dot) {
      bestTarget = { id, pos: targetPos, dot };
    }
  }

  if (bestTarget) {
    _katanaLeaping = true;
    _katanaLeapTarget = bestTarget.pos.clone();
    _katanaLeapTarget.y = _playerPos.y; // keep same height initially
    _katanaLeapTargetId = bestTarget.id;
    window.dispatchEvent(new Event("katana-leap-start"));
  }
}

export function updateKatanaCharge(delta: number) {
  if (_katanaCharging) {
    _katanaChargeTime = Math.min(_katanaChargeTime + delta, KATANA_CHARGE_DURATION);
  }
}

export function getKatanaChargeProgress(): number {
  if (!_katanaCharging) return 0;
  return Math.min(_katanaChargeTime / KATANA_CHARGE_DURATION, 1);
}

/** Called each frame from the main loop to drive the katana leap movement. */
export function updateKatanaLeap(delta: number): THREE.Vector3 | null {
  if (!_katanaLeaping || !_katanaLeapTarget) return null;

  camera.getWorldPosition(_playerPos);
  const toTarget = _katanaLeapTarget.clone().sub(_playerPos);
  toTarget.y = 0;
  const dist = toTarget.length();

  if (dist < 1.5) {
    // Arrived — deal damage
    _katanaLeaping = false;
    if (_katanaLeapTargetId && otherPlayers[_katanaLeapTargetId]) {
      if (!isPlayerInvincible(_katanaLeapTargetId)) {
        socket.emit("hit_player", {
          targetId: _katanaLeapTargetId,
          damage: KATANA_LEAP_DAMAGE,
          weaponId: "katana",
          headshot: false,
        });
        showHitMarker(false);
      }
    }
    triggerScreenShake(0.3);
    playKatanaSlashSound();
    window.dispatchEvent(new Event("katana-leap-end"));
    _katanaLeapTarget = null;
    _katanaLeapTargetId = null;
    return null;
  }

  // Move towards target
  toTarget.normalize();
  const step = KATANA_LEAP_SPEED * delta;
  // Add upward arc: jump up in first half, come down in second
  const moveVec = toTarget.multiplyScalar(step);
  moveVec.y = 8 * delta; // slight upward force during leap
  return moveVec;
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
