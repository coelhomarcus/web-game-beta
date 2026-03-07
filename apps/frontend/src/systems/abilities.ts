import * as THREE from "three";
import { scene, camera } from "../scene/setup";
import { socket } from "../network/socket";
import { playShoutSound, playShoutChargeSound } from "./audio";
import { triggerScreenShake } from "./headBob";
import type { Ability } from "../types";

const SHOUT_CHARGE_TIME = 1.0;
const ABILITY_COOLDOWN = 15.0;

let _isCharging = false;
let _chargeElapsed = 0;
let _cooldownRemaining = 0;
let _lastCooldownSeconds = -1;

const _tmpForward = new THREE.Vector3();

function _startShoutCharge(): void {
  if (_isCharging || _cooldownRemaining > 0) return;
  _isCharging = true;
  _chargeElapsed = 0;
  _setSlotCharging(true);
  showAbilityFeed("Carregando grito...");
  playShoutChargeSound();
}

function _fireShout(): void {
  _isCharging = false;
  _setSlotCharging(false);

  const pos = camera.position;
  camera.getWorldDirection(_tmpForward);
  _tmpForward.y = 0;
  _tmpForward.normalize();

  socket.emit("shout", {
    origin: { x: pos.x, y: pos.y, z: pos.z },
    forward: { x: _tmpForward.x, y: 0, z: _tmpForward.z },
  });

  _cooldownRemaining = ABILITY_COOLDOWN;
  _lastCooldownSeconds = -1;
  _updateCooldownHud();

  playShoutSound();
  triggerScreenShake(2.0);
  showAbilityFeed("DOVAH GRITO!");
}

const _orbGeo = new THREE.SphereGeometry(0.55, 16, 12);
const _glowGeo = new THREE.SphereGeometry(1.1, 16, 12);
const _burstGeo = new THREE.TorusGeometry(0.4, 0.1, 8, 30);

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

interface ActiveShoutAura {
  orb: THREE.Mesh;
  orbMat: THREE.MeshBasicMaterial;
  glowMat: THREE.MeshBasicMaterial;
  start: THREE.Vector3;
  end: THREE.Vector3;
  t: number;
}

interface ActiveShoutRing {
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  t: number;
  delay: number;
}

const _activeAuras: ActiveShoutAura[] = [];
const _activeRings: ActiveShoutRing[] = [];

const SHOUT_TRAVEL_DUR = 0.45;
const SHOUT_EYE_OFFSET = 0.9;
const BURST_RINGS = 4;
const BURST_RING_DELAY = 0.07;
const BURST_DUR = 0.42;

export function spawnShoutAura(
  origin: THREE.Vector3,
  targetPos: THREE.Vector3,
): void {
  const orbMat = _orbMatTemplate.clone();
  const orb = new THREE.Mesh(_orbGeo, orbMat);

  const glowMat = _glowMatTemplate.clone();
  const glow = new THREE.Mesh(_glowGeo, glowMat);
  orb.add(glow);

  const light = new THREE.PointLight(0x44ccff, 2.5, 6);
  orb.add(light);

  const start = origin.clone();
  start.y += SHOUT_EYE_OFFSET;
  const end = targetPos.clone();
  end.y += SHOUT_EYE_OFFSET;

  orb.position.copy(start);
  scene.add(orb);

  _activeAuras.push({
    orb,
    orbMat,
    glowMat,
    start,
    end,
    t: 0,
  });
}

function _spawnShoutBurst(pos: THREE.Vector3): void {
  for (let i = 0; i < BURST_RINGS; i++) {
    const ringMat = _burstMatTemplate.clone();
    ringMat.opacity = 0;

    const ring = new THREE.Mesh(_burstGeo, ringMat);
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    scene.add(ring);

    _activeRings.push({
      ring,
      ringMat,
      t: 0,
      delay: i * BURST_RING_DELAY,
    });
  }
}

function _updateShoutFx(delta: number): void {
  for (let i = _activeAuras.length - 1; i >= 0; i--) {
    const fx = _activeAuras[i];
    fx.t += delta;

    const p = Math.min(fx.t / SHOUT_TRAVEL_DUR, 1);
    const ease = 1 - Math.pow(1 - p, 3);

    fx.orb.position.lerpVectors(fx.start, fx.end, ease);

    const pulse = 1 + Math.sin(fx.t * 18) * 0.08;
    fx.orb.scale.setScalar(pulse);

    fx.orbMat.opacity = p > 0.8 ? 0.8 * (1 - (p - 0.8) / 0.2) : 0.8;
    fx.glowMat.opacity = p > 0.8 ? 0.28 * (1 - (p - 0.8) / 0.2) : 0.28;

    if (p >= 1) {
      scene.remove(fx.orb);
      _spawnShoutBurst(fx.end);
      fx.orbMat.dispose();
      fx.glowMat.dispose();
      _activeAuras.splice(i, 1);
    }
  }

  for (let i = _activeRings.length - 1; i >= 0; i--) {
    const fx = _activeRings[i];
    fx.t += delta;

    if (fx.t < fx.delay) continue;

    const liveT = fx.t - fx.delay;
    const p = Math.min(liveT / BURST_DUR, 1);
    if (!fx.ring.visible) fx.ring.visible = true;

    fx.ring.scale.setScalar(1 + p * 9);
    fx.ringMat.opacity = 0.9 * (1 - p);

    if (p >= 1) {
      scene.remove(fx.ring);
      fx.ringMat.dispose();
      _activeRings.splice(i, 1);
    }
  }
}

const shoutAbility: Ability = {
  id: "shout",
  name: "Grito de Dovah",
  description: "Arremessa inimigos na sua frente com um grito devastador.",
  icon: "",
  execute: () => {
    _startShoutCharge();
    return true;
  },
};

export function getHeldAbility(): Ability | null {
  return shoutAbility;
}

export function activateAbility(): void {
  if (_isCharging) return;

  if (_cooldownRemaining > 0) {
    const sec = Math.max(1, Math.ceil(_cooldownRemaining));
    showAbilityFeed(`Habilidade em cooldown: ${sec}s`);
    return;
  }

  shoutAbility.execute();
}

export function initAbilityItems(): void {
  buildAbilityHudSlot();
  updateAbilityHudSlot(shoutAbility);
  _updateCooldownHud();
}

export function updateAbilityItems(delta: number): void {
  if (_isCharging) {
    _chargeElapsed += delta;
    _updateChargeProgress(_chargeElapsed / SHOUT_CHARGE_TIME);
    if (_chargeElapsed >= SHOUT_CHARGE_TIME) _fireShout();
  }

  if (_cooldownRemaining > 0) {
    _cooldownRemaining = Math.max(0, _cooldownRemaining - delta);
    _updateCooldownHud();
  }

  _updateShoutFx(delta);
}

const SLOT_ID = "hud-ability-slot";
const FEED_ID = "ability-feed";

let _slotEl: HTMLElement | null = null;
let _iconEl: HTMLElement | null = null;
let _feedEl: HTMLElement | null = null;
let _keyEl: HTMLElement | null = null;

function buildAbilityHudSlot(): void {
  if (document.getElementById(SLOT_ID)) {
    _slotEl = document.getElementById(SLOT_ID);
    _iconEl = document.getElementById("hud-ability-icon");
    _keyEl = document.querySelector("#" + SLOT_ID + " .hud-ability-key");
    _feedEl = document.getElementById(FEED_ID);
    return;
  }

  const slot = document.createElement("div");
  slot.id = SLOT_ID;
  slot.className = "hud-ability-slot empty";
  slot.innerHTML = `
    <img id="hud-ability-icon" src="/dovahpowerup.png" alt="Dovah" draggable="false" />
    <span class="hud-ability-key">Z</span>
  `;

  const abilitiesBar = document.getElementById("hud-abilities");
  if (abilitiesBar) abilitiesBar.appendChild(slot);

  const feed = document.createElement("div");
  feed.id = FEED_ID;
  document.body.appendChild(feed);

  _slotEl = slot;
  _iconEl = slot.querySelector("#hud-ability-icon");
  _keyEl = slot.querySelector(".hud-ability-key");
  _feedEl = feed;
}

let _feedTimer: ReturnType<typeof setTimeout> | null = null;

export function showAbilityFeed(msg: string): void {
  if (!_feedEl) _feedEl = document.getElementById(FEED_ID);
  const el = _feedEl;
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
  if (!_slotEl) _slotEl = document.getElementById(SLOT_ID);
  const slot = _slotEl;
  if (!slot) return;

  if (on) {
    slot.classList.remove("ready");
    slot.classList.add("charging");
    slot.style.setProperty("--charge-pct", "0");
  } else {
    slot.classList.remove("charging");
  }
}

function _updateChargeProgress(pct: number): void {
  if (!_slotEl) _slotEl = document.getElementById(SLOT_ID);
  if (_slotEl) {
    _slotEl.style.setProperty("--charge-pct", String(Math.min(pct, 1)));
  }
}

function _updateCooldownHud(): void {
  if (!_keyEl) _keyEl = document.querySelector("#" + SLOT_ID + " .hud-ability-key");
  if (!_slotEl) _slotEl = document.getElementById(SLOT_ID);

  const slot = _slotEl;
  const key = _keyEl;
  if (!slot || !key) return;

  const sec = Math.ceil(_cooldownRemaining);
  if (sec === _lastCooldownSeconds) return;
  _lastCooldownSeconds = sec;

  if (_cooldownRemaining > 0) {
    key.textContent = String(sec);
    slot.classList.remove("ready");
    slot.classList.add("empty");
  } else {
    key.textContent = "Z";
    slot.classList.remove("empty");
    slot.classList.add("ready");
  }
}

function updateAbilityHudSlot(ability: Ability | null): void {
  if (!_slotEl) _slotEl = document.getElementById(SLOT_ID);
  if (!_iconEl) _iconEl = document.getElementById("hud-ability-icon");

  const slot = _slotEl;
  const icon = _iconEl;
  if (!slot || !icon) return;

  if (ability) {
    slot.classList.remove("empty");
    slot.classList.add("ready");
  } else {
    slot.classList.remove("ready");
    slot.classList.add("empty");
  }
}
