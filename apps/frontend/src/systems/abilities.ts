import * as THREE from "three";
import { scene, camera } from "../scene/setup";
import { socket } from "../network/socket";
import { playShoutSound, playShoutChargeSound } from "./audio";
import type { Ability } from "../types";

// ─── Dovah Shout ability ─────────────────────────────────────────────────────
//
// Press Z → 1-second charge wind-up → shout fires.
// Knocks back + deals 40 dmg to any player ≤5 m in front.

const SHOUT_CHARGE_TIME = 2.0; // seconds

let _isCharging = false;
let _chargeElapsed = 0;

function _startShoutCharge(): void {
  if (_isCharging) return;
  _isCharging = true;
  _chargeElapsed = 0;
  _setSlotCharging(true);
  showAbilityFeed("🐉 Carregando grito...");
  playShoutChargeSound();
}

function _fireShout(): void {
  _isCharging = false;
  _setSlotCharging(false);

  const pos = camera.position;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  socket.emit("shout", {
    origin: { x: pos.x, y: pos.y, z: pos.z },
    forward: { x: forward.x, y: 0, z: forward.z },
  });

  playShoutSound();
  showAbilityFeed("🐉 DOVAH GRITO!");
}

// ─── Shout Aura visual ───────────────────────────────────────────────────────
//
// Spawns a large light-blue energy orb at `origin` that travels to `targetPos`
// over ~0.45 s, then bursts into expanding rings on arrival.
// Called from events.ts whenever a shout_blast is confirmed by the server.

// ── Cached geometries & materials (avoid per-event allocations → no stutter) ─
const _texture = new THREE.TextureLoader().load("/dovahpowerup.png");
const _orbGeo = new THREE.SphereGeometry(0.55, 18, 14);
const _glowGeo = new THREE.SphereGeometry(1.1, 18, 14);
const _burstGeo = new THREE.TorusGeometry(0.4, 0.1, 8, 40);

const _orbMatTemplate = new THREE.MeshBasicMaterial({
  color: 0x44ccff,
  transparent: true,
  opacity: 0.8,
  depthWrite: false,
});
const _glowMatTemplate = new THREE.MeshBasicMaterial({
  color: 0x99eeff,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
  side: THREE.BackSide,
});
const _burstMatTemplate = new THREE.MeshBasicMaterial({
  color: 0x44ccff,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
});
const _itemSpriteMat = new THREE.SpriteMaterial({
  map: _texture,
  transparent: true,
  depthWrite: false,
  sizeAttenuation: true,
});

export function spawnShoutAura(
  origin: THREE.Vector3,
  targetPos: THREE.Vector3,
): void {
  // ── Orb body ───────────────────────────────────────────────────────────────
  const orbMat = _orbMatTemplate.clone();
  const orb = new THREE.Mesh(_orbGeo, orbMat);

  // ── Outer glow shell (drawn on the back face so it halos the orb) ─────────
  const glowMat = _glowMatTemplate.clone();
  const glow = new THREE.Mesh(_glowGeo, glowMat);
  orb.add(glow);

  // ── Point light that illuminates nearby geometry ───────────────────────────
  const light = new THREE.PointLight(0x44ccff, 2.5, 6);
  orb.add(light);

  const EYE_OFFSET = 0.9; // raise to roughly eye-level
  const start = origin.clone();
  start.y += EYE_OFFSET;
  const end = targetPos.clone();
  end.y += EYE_OFFSET;

  orb.position.copy(start);
  scene.add(orb);

  const TRAVEL_DUR = 0.45; // seconds
  let t = 0;

  const animate = () => {
    t += 0.016;
    const p = Math.min(t / TRAVEL_DUR, 1);
    // Ease-out cubic so it decelerates near the target
    const ease = 1 - Math.pow(1 - p, 3);
    orb.position.lerpVectors(start, end, ease);

    // Gentle pulse
    const pulse = 1 + Math.sin(t * 18) * 0.08;
    orb.scale.setScalar(pulse);

    // Fade out the last 20 % of travel
    orbMat.opacity = p > 0.8 ? 0.8 * (1 - (p - 0.8) / 0.2) : 0.8;
    glowMat.opacity = p > 0.8 ? 0.28 * (1 - (p - 0.8) / 0.2) : 0.28;

    if (p < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(orb);
      _spawnShoutBurst(end);
    }
  };
  requestAnimationFrame(animate);
}

/** Expanding light-blue ring burst at the point of impact. */
function _spawnShoutBurst(pos: THREE.Vector3): void {
  const BURST_RINGS = 4;
  for (let i = 0; i < BURST_RINGS; i++) {
    const delay = i * 0.07;
    setTimeout(() => {
      const ringMat = _burstMatTemplate.clone();
      const ring = new THREE.Mesh(_burstGeo, ringMat);
      ring.position.copy(pos);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);

      let bt = 0;
      const BDUR = 0.42;
      const bust = () => {
        bt += 0.016;
        const bp = Math.min(bt / BDUR, 1);
        ring.scale.setScalar(1 + bp * 9);
        ringMat.opacity = 0.9 * (1 - bp);
        if (bp < 1) requestAnimationFrame(bust);
        else scene.remove(ring);
      };
      requestAnimationFrame(bust);
    }, delay * 1000);
  }
}

const shoutAbility: Ability = {
  id: "shout",
  name: "Grito de Dovah",
  description: "Arremessa inimigos na sua frente com um grito devastador.",
  icon: "🐉",
  execute: () => {
    _startShoutCharge();
    return true; // consumed immediately — charge handles the rest
  },
};

// ─── Player ability inventory (single slot) ──────────────────────────────────

let heldAbility: Ability | null = null;

export function getHeldAbility(): Ability | null {
  return heldAbility;
}

/** Called when the player presses Z. */
export function activateAbility(): void {
  if (_isCharging) return; // already charging
  if (!heldAbility) {
    showAbilityFeed("Sem habilidade equipada  [Z]");
    return;
  }
  const consumed = heldAbility.execute();
  if (consumed) {
    heldAbility = null;
    updateAbilityHudSlot(null);
  }
}

// ─── Dropped items ───────────────────────────────────────────────────────────

interface DroppedItem {
  group: THREE.Group;
  ability: Ability;
  baseY: number;
  pickedUp: boolean;
}

const droppedItems: DroppedItem[] = [];

/** Radius (XZ plane) within which the player auto-picks up an item. */
const PICKUP_RADIUS = 1.8;

/**
 * Possible spawn positions around the map.
 * Each [x, z] coordinate has DROP_CHANCE probability of actually spawning.
 */
const SPAWN_POINTS: Array<[number, number]> = [
  [8, 5],
  [-8, 5],
  [12, -8],
  [-12, -6],
  [0, 12],
  [-5, -12],
  [6, -6],
  [-10, 10],
  [15, 0],
  [0, -15],
  [-15, 3],
  [3, 15],
];

const DROP_CHANCE = 0.6; // 60 % per spawn point

// ─── Visual factory ──────────────────────────────────────────────────────────

function makeItemMesh(): THREE.Group {
  const group = new THREE.Group();

  // Billboard sprite using the PNG
  const sprite = new THREE.Sprite(_itemSpriteMat.clone());
  sprite.name = "sprite";
  sprite.scale.set(0.9, 0.9, 1);
  group.add(sprite);

  // Small point light so it illuminates nearby ground
  const light = new THREE.PointLight(0xcc44ff, 1.2, 3.5);
  group.add(light);

  return group;
}

// ─── Init ────────────────────────────────────────────────────────────────────

const MIN_ACTIVE_ITEMS = 2; // always keep at least this many on the map
const RESPAWN_CHECK_INTERVAL = 5; // seconds between respawn checks

let _respawnTimer = 0;

function _spawnOneItem(): void {
  // Pick a random spawn point that has no active item nearby
  const available = SPAWN_POINTS.filter(
    ([sx, sz]) =>
      !droppedItems.some(
        (d) =>
          !d.pickedUp &&
          Math.abs(d.group.position.x - sx) < 1 &&
          Math.abs(d.group.position.z - sz) < 1,
      ),
  );
  if (available.length === 0) return;

  const [x, z] = available[Math.floor(Math.random() * available.length)];
  const baseY = 0.65;
  const group = makeItemMesh();
  group.position.set(x, baseY, z);
  scene.add(group);
  droppedItems.push({ group, ability: shoutAbility, baseY, pickedUp: false });
}

function _ensureMinItems(): void {
  const activeCount = droppedItems.filter((d) => !d.pickedUp).length;
  const needed = MIN_ACTIVE_ITEMS - activeCount;
  for (let i = 0; i < needed; i++) _spawnOneItem();
}

export function initAbilityItems(): void {
  // Initial spawn — guarantee at least MIN_ACTIVE_ITEMS
  for (const [x, z] of SPAWN_POINTS) {
    if (Math.random() > DROP_CHANCE) continue;

    const baseY = 0.65;
    const group = makeItemMesh();
    group.position.set(x, baseY, z);
    scene.add(group);

    droppedItems.push({ group, ability: shoutAbility, baseY, pickedUp: false });
  }

  _ensureMinItems();

  buildAbilityHudSlot();
}

// ─── Update (called every frame) ─────────────────────────────────────────────

let _t = 0;

export function updateAbilityItems(delta: number): void {
  _t += delta;

  // ─ Shout charge tick ─────────────────────────────────────────────────────
  if (_isCharging) {
    _chargeElapsed += delta;
    _updateChargeProgress(_chargeElapsed / SHOUT_CHARGE_TIME);
    if (_chargeElapsed >= SHOUT_CHARGE_TIME) _fireShout();
  }

  // ─ Respawn loop: keep at least MIN_ACTIVE_ITEMS on the map ───────────────
  _respawnTimer += delta;
  if (_respawnTimer >= RESPAWN_CHECK_INTERVAL) {
    _respawnTimer = 0;
    _ensureMinItems();
  }

  for (const item of droppedItems) {
    if (item.pickedUp) continue;

    // Floating bob
    item.group.position.y = item.baseY + Math.sin(_t * 2.0) * 0.14;

    // Slow Y rotation (sprite ignores Y rotation visually, but the light orbits)
    item.group.rotation.y += delta * 1.8;

    // Proximity check (XZ only so jumping doesn't block pickup)
    const dx = camera.position.x - item.group.position.x;
    const dz = camera.position.z - item.group.position.z;
    if (Math.sqrt(dx * dx + dz * dz) < PICKUP_RADIUS) {
      _pickup(item);
    }
  }
}

function _pickup(item: DroppedItem): void {
  if (item.pickedUp) return;
  item.pickedUp = true;
  scene.remove(item.group);

  if (heldAbility) {
    showAbilityFeed("⚠ Already holding an ability!");
    return;
  }

  heldAbility = item.ability;
  updateAbilityHudSlot(heldAbility);
  showAbilityFeed(`📦 Picked up: ${heldAbility.name}  –  press Z to use`);
}

// ─── HUD slot ────────────────────────────────────────────────────────────────

const SLOT_ID = "hud-ability-slot";
const FEED_ID = "ability-feed";

function buildAbilityHudSlot(): void {
  if (document.getElementById(SLOT_ID)) return; // already built

  // Slot widget (goes next to grenade in #hud-abilities)
  const slot = document.createElement("div");
  slot.id = SLOT_ID;
  slot.className = "hud-ability-slot empty";
  slot.innerHTML = `
    <span id="hud-ability-icon">—</span>
    <span class="hud-ability-key">Z</span>
  `;
  const abilitiesBar = document.getElementById("hud-abilities");
  if (abilitiesBar) abilitiesBar.appendChild(slot);

  // Feed message element (top-centre of screen)
  const feed = document.createElement("div");
  feed.id = FEED_ID;
  document.body.appendChild(feed);
}

let _feedTimer: ReturnType<typeof setTimeout> | null = null;

export function showAbilityFeed(msg: string): void {
  const el = document.getElementById(FEED_ID);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("fade-out");
  el.classList.add("visible");
  if (_feedTimer) clearTimeout(_feedTimer);
  _feedTimer = setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => el.classList.remove("visible", "fade-out"), 500);
  }, 2200);
}

function _setSlotCharging(on: boolean): void {
  const slot = document.getElementById(SLOT_ID);
  if (!slot) return;
  if (on) {
    slot.classList.remove("ready");
    slot.classList.add("charging");
    // Reset CSS var so the ring animation restarts from 0
    slot.style.setProperty("--charge-pct", "0");
  } else {
    slot.classList.remove("charging");
  }
}

function _updateChargeProgress(pct: number): void {
  const slot = document.getElementById(SLOT_ID);
  if (slot) slot.style.setProperty("--charge-pct", String(Math.min(pct, 1)));
}

function updateAbilityHudSlot(ability: Ability | null): void {
  const slot = document.getElementById(SLOT_ID);
  const icon = document.getElementById("hud-ability-icon");
  if (!slot || !icon) return;
  if (ability) {
    icon.textContent = ability.icon;
    slot.classList.remove("empty");
    slot.classList.add("ready");
  } else {
    icon.textContent = "—";
    slot.classList.remove("ready");
    slot.classList.add("empty");
  }
}
