import * as THREE from "three";
import { BULLET_SPEED, BULLET_MAX_LIFETIME, BULLET_RADIUS } from "../config";
import { scene, camera, sceneFog } from "../scene/setup";
import { mapBlocks } from "../scene/map";
import { otherPlayers } from "../player/PlayerModel";
import { socket } from "../network/socket";
import { playShootSound, playAwpSound, playReloadSound } from "./audio";
import { showHitMarker, stopLocalInvincibleBlink } from "../ui/overlays";
import { updateHudAmmo, updateHudWeapon, startReloadRing, stopReloadRing } from "../ui/hud";
import { showScope, hideScope } from "../ui/overlays";

// ─── Weapon definitions ───────────────────────────────────────────────────────
export interface WeaponDef {
  id: "ar" | "awp";
  name: string;
  label: string;
  magSize: number;
  reloadTime: number; // seconds
  fireRate: number;   // min seconds between shots (0 = no limit)
  damage: number;     // hp damage per hit (100 = one-shot kill)
  bulletColor: number;
  bulletSpeed: number;
  bulletMaxLife: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  ar: {
    id: "ar",
    name: "M4A1",
    label: "1",
    magSize: 20,
    reloadTime: 2.0,
    fireRate: 0,
    damage: 25,
    bulletColor: 0xffe000,
    bulletSpeed: BULLET_SPEED,
    bulletMaxLife: BULLET_MAX_LIFETIME,
  },
  awp: {
    id: "awp",
    name: "AWP",
    label: "2",
    magSize: 5,
    reloadTime: 3.2,
    fireRate: 1.1, // bolt-action delay
    damage: 100,   // one-hit kill
    bulletColor: 0x00ffff,
    bulletSpeed: 120,
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

// Scope state (AWP only)
let isScoped = false;

export function getCurrentWeapon(): WeaponDef { return WEAPONS[currentWeaponId]; }
export function getAmmo() { return ammo; }
export function getIsReloading() { return isReloading; }
export function getIsScoped() { return isScoped; }

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
  updateHudAmmo(ammo, false);
  updateHudWeapon(WEAPONS[id]);
  window.dispatchEvent(new CustomEvent("weapon-switched"));
}

// ─── Scope (AWP right-click toggle) ───────────────────────────────────────────
export function toggleScope() {
  if (currentWeaponId !== "awp") return;
  if (isScoped) { exitScope(); } else { enterScope(); }
}

export function enterScope() {
  if (currentWeaponId !== "awp" || isScoped) return;
  isScoped = true;
  showScope();
  document.body.classList.add("scoped");
  camera.fov = 20;
  camera.updateProjectionMatrix();
  // Push fog far so scoped view is clear
  sceneFog.near = 40;
  sceneFog.far = 200;
  window.dispatchEvent(new CustomEvent("scope-changed", { detail: { scoped: true } }));
}

export function exitScope() {
  if (!isScoped) return;
  isScoped = false;
  hideScope();
  document.body.classList.remove("scoped");
  camera.fov = 75;
  camera.updateProjectionMatrix();
  // Restore normal fog
  sceneFog.near = 0;
  sceneFog.far = 60;
  window.dispatchEvent(new CustomEvent("scope-changed", { detail: { scoped: false } }));
}

// ─── Reload ───────────────────────────────────────────────────────────────────
export function startReload() {
  const w = getCurrentWeapon();
  if (isReloading || ammo === w.magSize) return;
  isReloading = true;
  reloadTimer = w.reloadTime;
  if (isScoped) exitScope();
  playReloadSound();
  startReloadRing(w.reloadTime);
  updateHudAmmo(ammo, true);
}

export function updateAmmo(delta: number) {
  if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - delta);
  if (!isReloading) return;
  reloadTimer -= delta;
  if (reloadTimer <= 0) {
    isReloading = false;
    ammo = getCurrentWeapon().magSize;
    stopReloadRing();
    updateHudAmmo(ammo, false);
  }
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

function getBulletMat(color: number): THREE.MeshBasicMaterial {
  if (!matCache[color]) matCache[color] = new THREE.MeshBasicMaterial({ color });
  return matCache[color];
}

export function createVisualBullet(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  color = 0xffe000,
  speed = BULLET_SPEED,
  maxLife = BULLET_MAX_LIFETIME,
) {
  const mesh = new THREE.Mesh(bulletGeo, getBulletMat(color));
  mesh.position.copy(origin);
  scene.add(mesh);
  activeBullets.push({ mesh, dir: dir.clone().normalize(), lifeTime: 0, speed, maxLife });
}

const raycaster = new THREE.Raycaster();
raycaster.near = 0.1;

function findPlayerGroup(o: THREE.Object3D): THREE.Group | null {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (cur instanceof THREE.Group && Object.values(otherPlayers).includes(cur as THREE.Group))
      return cur;
    cur = cur.parent;
  }
  return null;
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
  updateHudAmmo(ammo, false);
  if (ammo === 0) startReload();

  // AWP: exit scope on shoot
  if (currentWeaponId === "awp") {
    playAwpSound();
    if (isScoped) exitScope();
  } else {
    playShootSound();
  }

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const allTargets = [...Object.values(otherPlayers), ...mapBlocks];
  const hits = raycaster.intersectObjects(allTargets, true);
  const firstPlayerHit = hits.find((h) => findPlayerGroup(h.object) !== null);
  if (firstPlayerHit) {
    const wallHit = hits.find((h) => mapBlocks.includes(h.object as THREE.Mesh));
    const playerBlocked = wallHit && wallHit.distance < firstPlayerHit.distance;
    if (!playerBlocked) {
      const grp = findPlayerGroup(firstPlayerHit.object)!;
      const tid = Object.keys(otherPlayers).find((id) => otherPlayers[id] === grp);
      if (tid) {
        socket.emit("hit_player", { targetId: tid, damage: w.damage, weaponId: w.id });
        showHitMarker();
      }
    }
  }

  const orig = new THREE.Vector3();
  camera.getWorldPosition(orig);
  orig.y -= 0.1;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  createVisualBullet(orig, dir, w.bulletColor, w.bulletSpeed, w.bulletMaxLife);
  socket.emit("shoot", {
    origin: { x: orig.x, y: orig.y, z: orig.z },
    direction: { x: dir.x, y: dir.y, z: dir.z },
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
    const nextPos = b.mesh.position.clone().addScaledVector(b.dir, step);
    if (bulletHitsBlock(nextPos)) {
      scene.remove(b.mesh);
      activeBullets.splice(i, 1);
      continue;
    }
    b.mesh.position.copy(nextPos);
    b.lifeTime += delta;
    if (b.lifeTime > b.maxLife || b.mesh.position.y <= 0) {
      scene.remove(b.mesh);
      activeBullets.splice(i, 1);
    }
  }
}
