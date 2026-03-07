import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { scene } from "../scene/setup";
import { syncNameSprite } from "./NameSprite";

// ─── Weapon transform configs (tweak these to adjust models) ─────────────────
// Each has: scale [x,y,z], rotation [x,y,z] (radians), position [x,y,z]

export const M4A1_FP = {
  scale: [2, 2, 2] as [number, number, number],
  rotation: [0, Math.PI, 0] as [number, number, number],
  position: [0.3, -0.75, -0.5] as [number, number, number], // group position in camera space
};

export const M4A1_3P = {
  scale: [2, 2, 2] as [number, number, number],
  rotation: [0, Math.PI, 0] as [number, number, number],
  position: [0.08, -0.2, -0.42] as [number, number, number], // position on other-player model
};

export const AWP_FP = {
  scale: [0.1, 0.1, 0.1] as [number, number, number],
  rotation: [0, 1.5, 0] as [number, number, number],
  position: [0.3, -0.32, -0.5] as [number, number, number],
};

export const AWP_3P = {
  scale: [0.1, 0.1, 0.1] as [number, number, number],
  rotation: [0, 1.5, 0] as [number, number, number],
  position: [0.08, 0.1, -0.42] as [number, number, number],
};

// ─── Pre-loaded M4A1 GLB model ───────────────────────────────────────────────
let m4a1Template: THREE.Group | null = null;
const m4a1Loader = new GLTFLoader();
m4a1Loader.load("/models/M4A1/PSX_Old_FN_FAL.glb", (gltf) => {
  m4a1Template = gltf.scene;
  m4a1Template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  refreshAll3PWeapons();
  window.dispatchEvent(new Event("weapon-model-loaded"));
});

// ─── Pre-loaded AWP/Sniper GLB model ─────────────────────────────────────────
let awpTemplate: THREE.Group | null = null;
m4a1Loader.load("/models/SNIPER/low-poly_m24_sniper_rifle.glb", (gltf) => {
  awpTemplate = gltf.scene;
  awpTemplate.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  refreshAll3PWeapons();
  window.dispatchEvent(new Event("weapon-model-loaded"));
});

/** Refresh all 3P weapons on existing players (replaces fallback with GLB). */
function refreshAll3PWeapons() {
  for (const id of Object.keys(otherPlayers)) {
    const grp = otherPlayers[id];
    const old = grp.getObjectByName("weapon3p");
    if (!old) continue;
    // Determine current weapon type from userData, default to "ar"
    const weaponId = (old.userData.weaponId as "ar" | "awp") || "ar";
    grp.remove(old);
    const wep = weaponId === "awp" ? makeAwpModel(false) : makeWeapon(false);
    const cfg3p = weaponId === "awp" ? AWP_3P : M4A1_3P;
    wep.name = "weapon3p";
    wep.userData.weaponId = weaponId;
    wep.position.set(...cfg3p.position);
    grp.add(wep);
  }
}

export const otherPlayers: Record<string, THREE.Group> = {};
export const playerOriginalMaterial: Record<
  string,
  THREE.MeshStandardMaterial
> = {};
export const playerCurrentNames: Record<string, string> = {};

/**
 * First-person arm rig — two forearm + hand blocks positioned in camera space
 * to visually "hold" the weapon. Added to the camera separately from the weapon.
 */
export function makeFirstPersonArms(
  variant: "rifle" | "awp" = "rifle",
  color: string | number = 0xc68642,
): THREE.Group {
  const rig = new THREE.Group();

  const fpCfg = variant === "awp" ? AWP_FP : M4A1_FP;
  const [wx, wy, wz] = fpCfg.position;

  const skin = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.0,
  });

  // Single Minecraft-style rectangular arm block (4×12×4 proportions)
  const armGeo = new THREE.BoxGeometry(0.12, 0.48, 0.12);

  function addArm(
    side: "left" | "right",
    offset: [number, number, number],
    rot: [number, number, number],
  ): void {
    const sign = side === "left" ? -1 : 1;
    const mesh = new THREE.Mesh(armGeo, skin);
    mesh.position.set(wx + offset[0] * sign, wy + offset[1], wz + offset[2]);
    mesh.rotation.set(rot[0], rot[1] * sign, rot[2] * sign);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    rig.add(mesh);
  }

  if (variant === "rifle") {
    // Right arm: gripping the stock
    addArm("right", [0.04, 0.28, 0.22], [-0.62, 0.06, -0.05]);
    // Left arm: supporting the barrel
    addArm("left",  [0.2,  0.31, -0.1], [-0.88, 0.18,  0.1]);
  } else {
    // AWP — arms shifted to match scope hold
    addArm("right", [0.04, -0.1, 0.22], [-0.64, 0.06, -0.05]);
    addArm("left",  [0.26, -0.06, -0.3], [-0.96, 0.24,  0.12]);
  }

  return rig;
}

export function makeWeapon(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const cfg = firstPerson ? M4A1_FP : M4A1_3P;

  if (m4a1Template) {
    const model = m4a1Template.clone();
    model.scale.set(...cfg.scale);
    model.rotation.set(...cfg.rotation);
    g.add(model);
  } else {
    // Fallback while GLB is still loading
    const m = (c: number, r = 0.5) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.6),
      m(0x333333),
    );
    barrel.position.set(0, 0, -0.2);
    g.add(barrel);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.4),
      m(0x555555, 0.8),
    );
    body.position.set(0, -0.05, 0.1);
    g.add(body);
  }

  if (firstPerson) g.position.set(...M4A1_FP.position);
  return g;
}

export function makeAwpModel(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const cfg = firstPerson ? AWP_FP : AWP_3P;

  if (awpTemplate) {
    const model = awpTemplate.clone();
    model.scale.set(...cfg.scale);
    model.rotation.set(...cfg.rotation);
    g.add(model);
  } else {
    // Fallback while GLB is still loading
    const m = (c: number, r = 0.5) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 1.1),
      m(0x222222),
    );
    barrel.position.set(0, 0.02, -0.35);
    g.add(barrel);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.14, 0.5),
      m(0x8b5a2b, 0.9),
    );
    body.position.set(0, -0.03, 0.2);
    g.add(body);
  }

  if (firstPerson) g.position.set(...AWP_FP.position);
  return g;
}

export function addOtherPlayer(player: {
  id: string;
  name: string;
  color: string;
  position: { x: number; y: number; z: number };
  isDead: boolean;
}) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: player.color });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  playerOriginalMaterial[player.id] = mat;

  // ── Torso ──────────────────────────────────────────────────────────────
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
  torso.name = "torso";
  torso.castShadow = torso.receiveShadow = true;
  grp.add(torso);

  // ── Head group ─────────────────────────────────────────────────────────
  const headGrp = new THREE.Group();
  headGrp.name = "headGroup";
  headGrp.position.set(0, 0.55, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
  head.castShadow = true;
  headGrp.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), darkMat);
  face.position.set(0, 0.0, -0.2);
  headGrp.add(face);
  grp.add(headGrp);

  // ── Arms (shoulder pivots, posed in combat hold facing -Z) ─────────────
  const leftArm = makeLimb(
    "leftArm",
    0.18,
    0.55,
    0.18,
    mat,
    -0.27,
    0.20,
    0,
    -0.27,
  );
  const rightArm = makeLimb(
    "rightArm",
    0.18,
    0.55,
    0.18,
    mat,
    0.27,
    0.20,
    0,
    -0.27,
  );
  // Arms angled forward-down to align hands with weapon grip
  leftArm.rotation.x = ARM_HOLD_LEFT;
  leftArm.rotation.z = 0.15;  // lean inward toward weapon center
  rightArm.rotation.x = ARM_HOLD_RIGHT;
  rightArm.rotation.z = -0.15; // lean inward toward weapon center
  grp.add(leftArm);
  grp.add(rightArm);

  // ── Weapon (attached to torso group, aligned with hands) ───────────────
  const wep3p = makeWeapon(false);
  wep3p.name = "weapon3p";
  wep3p.userData.weaponId = "ar";
  wep3p.position.set(...M4A1_3P.position);
  grp.add(wep3p);

  // ── Legs ───────────────────────────────────────────────────────────────
  grp.add(makeLimb("leftLeg", 0.2, 0.6, 0.2, mat, -0.12, -0.4, 0, -0.3));
  grp.add(makeLimb("rightLeg", 0.2, 0.6, 0.2, mat, 0.12, -0.4, 0, -0.3));

  grp.position.set(player.position.x, 1, player.position.z);
  grp.visible = !player.isDead;
  scene.add(grp);
  otherPlayers[player.id] = grp;

  syncNameSprite(grp, player.id, player.name, player.color);
}

/** Swap an other player's 3P weapon model (called on weapon_switch event). */
export function swapOtherPlayerWeapon(
  id: string,
  weaponId: "ar" | "awp",
): void {
  const grp = otherPlayers[id];
  if (!grp) return;
  const old = grp.getObjectByName("weapon3p");
  if (old) grp.remove(old);
  const wep = weaponId === "awp" ? makeAwpModel(false) : makeWeapon(false);
  const cfg3p = weaponId === "awp" ? AWP_3P : M4A1_3P;
  wep.name = "weapon3p";
  wep.userData.weaponId = weaponId;
  wep.position.set(...cfg3p.position);
  grp.add(wep);
}

function makeLimb(
  name: string,
  w: number,
  h: number,
  d: number,
  mat: THREE.MeshStandardMaterial,
  px: number,
  py: number,
  pz: number,
  meshOffY: number,
): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(px, py, pz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = m.receiveShadow = true;
  m.position.y = meshOffY;
  g.add(m);
  return g;
}

// ─── Hit flash ────────────────────────────────────────────────────────────────

export function flashPlayerHit(id: string) {
  const orig = playerOriginalMaterial[id];
  if (!orig) return;
  // Mutate the shared material so every body part (head, torso, arms, legs) flashes.
  orig.emissive.setHex(0xff0000);
  orig.emissiveIntensity = 0.8;
  setTimeout(() => {
    orig.emissive.setHex(0x000000);
    orig.emissiveIntensity = 0;
  }, 150);
}

const shieldMeshes: Record<string, THREE.Mesh> = {};

export function isPlayerInvincible(id: string): boolean {
  return id in shieldMeshes;
}

export function startInvincibleBlink(id: string, duration: number) {
  stopInvincibleBlink(id);
  const grp = otherPlayers[id];
  if (!grp) return;

  // Create a blue semi-transparent capsule around the player
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.2, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0x2299ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: 0x2299ff,
      emissiveIntensity: 0.4,
    }),
  );
  capsule.name = "invincible-shield";
  capsule.position.set(0, 0.1, 0);
  grp.add(capsule);
  shieldMeshes[id] = capsule;

  setTimeout(() => stopInvincibleBlink(id), duration);
}

function stopInvincibleBlink(id: string) {
  const capsule = shieldMeshes[id];
  if (capsule) {
    const grp = otherPlayers[id];
    if (grp) grp.remove(capsule);
    capsule.geometry.dispose();
    (capsule.material as THREE.Material).dispose();
    delete shieldMeshes[id];
  }
}

export function removeOtherPlayer(id: string) {
  stopInvincibleBlink(id);
  cleanupRagdoll(id);
  walkState.delete(id);
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }
  delete playerOriginalMaterial[id];
  delete playerCurrentNames[id];
}

// ─── Third-person walk animation ─────────────────────────────────────────────

const ARM_HOLD_LEFT = 1.00;  // ~57° forward — left arm supports barrel
const ARM_HOLD_RIGHT = 0.81; // ~46° forward-down — right hand grips trigger
const ARM_SWING = 0.22; // arm swing amplitude (radians)
const LEG_SWING = 0.7; // leg swing amplitude (radians)
const WALK_SPEED_3P = 12; // oscillations per second
const ANIM_LERP = 10; // smoothing speed for limb transitions
const SPEED_THRESHOLD = 0.3; // minimum speed to count as "walking"

interface WalkState {
  timer: number;
  lastPos: THREE.Vector3;
  smoothSpeed: number; // smoothed horizontal speed
}
const walkState: Map<string, WalkState> = new Map();

export function updatePlayerAnimations(delta: number): void {
  for (const id in otherPlayers) {
    if (isRagdollActive(id)) continue;
    const grp = otherPlayers[id];
    if (!grp.visible) {
      walkState.delete(id);
      continue;
    }

    let ws = walkState.get(id);
    if (!ws) {
      ws = { timer: 0, lastPos: grp.position.clone(), smoothSpeed: 0 };
      walkState.set(id, ws);
    }

    // Compute horizontal distance moved this frame
    const dx = grp.position.x - ws.lastPos.x;
    const dz = grp.position.z - ws.lastPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const instantSpeed = delta > 0 ? dist / delta : 0;
    ws.lastPos.copy(grp.position);

    // Smooth the speed to avoid flickering
    ws.smoothSpeed += (instantSpeed - ws.smoothSpeed) * Math.min(1, delta * 8);

    const isWalking = ws.smoothSpeed > SPEED_THRESHOLD;

    if (isWalking) ws.timer += delta * WALK_SPEED_3P;

    // Blend factor: 0 when still, 1 when walking at full speed
    const blend = Math.min(1, ws.smoothSpeed / 3);
    const lerpFactor = Math.min(1, delta * ANIM_LERP);

    const la = grp.getObjectByName("leftArm") as THREE.Group | null;
    const ra = grp.getObjectByName("rightArm") as THREE.Group | null;
    const ll = grp.getObjectByName("leftLeg") as THREE.Group | null;
    const rl = grp.getObjectByName("rightLeg") as THREE.Group | null;
    const wep = grp.getObjectByName("weapon3p") as THREE.Group | null;

    const sinPhase = Math.sin(ws.timer);

    // Arms swing opposite to their corresponding leg
    if (la) {
      const t = ARM_HOLD_LEFT + sinPhase * ARM_SWING * blend;
      la.rotation.x += (t - la.rotation.x) * lerpFactor;
    }
    if (ra) {
      const t = ARM_HOLD_RIGHT - sinPhase * ARM_SWING * blend;
      ra.rotation.x += (t - ra.rotation.x) * lerpFactor;
    }
    // Left leg forward when right arm forward, and vice-versa (natural gait)
    if (ll) {
      const t = sinPhase * LEG_SWING * blend;
      ll.rotation.x += (t - ll.rotation.x) * lerpFactor;
    }
    if (rl) {
      const t = -sinPhase * LEG_SWING * blend;
      rl.rotation.x += (t - rl.rotation.x) * lerpFactor;
    }
    // Weapon pitches very slightly with the right arm for a natural look
    if (wep && ra) {
      wep.rotation.x = (ra.rotation.x - ARM_HOLD_RIGHT) * 0.5;
    }
  }
}

// ─── Ragdoll ──────────────────────────────────────────────────────────────────

const RAGDOLL_GRAVITY = 22;
const GROUND_Y = 0.0;
const BOUNCE_RESTITUTION = 0.3;

const LIMB_NAMES = ["headGroup", "leftArm", "rightArm", "leftLeg", "rightLeg"];

interface LimbAnim {
  group: THREE.Group;
  angVelX: number;
  angVelZ: number;
}

interface RagdollSim {
  playerId: string;
  group: THREE.Group;
  limbs: LimbAnim[];
  velX: number;
  velY: number;
  velZ: number;
  angVelX: number;
  angVelY: number;
  angVelZ: number;
  bouncesLeft: number;
  settled: boolean;
  elapsed: number;
}

const activeRagdolls: Map<string, RagdollSim> = new Map();

/** Returns true if the player's body is in ragdoll state (dead on the floor). */
export function isRagdollActive(id: string): boolean {
  return activeRagdolls.has(id);
}

// ── Shout fling (non-lethal ragdoll-lite) ─────────────────────────────────────

interface FlingAnim {
  group: THREE.Group;
  limbs: LimbAnim[];
  velX: number;
  velY: number;
  velZ: number;
  angVelX: number;
  angVelZ: number;
  elapsed: number;
  origPos: THREE.Vector3;
  origRot: THREE.Euler;
}

const activeFlings: Map<string, FlingAnim> = new Map();
const FLING_DURATION = 1.4;      // seconds until we start recovering
const FLING_RECOVER  = 0.35;     // lerp-back duration
const FLING_FRICTION = 1.8;      // must match KNOCKBACK_FRICTION in physics.ts

export function isFlinging(id: string): boolean {
  return activeFlings.has(id);
}

/**
 * Triggers a temporary "fling" (ragdoll-lite) on another player's model.
 * The body flies away from `origin` for ~1.4 s then snaps back to normal.
 */
export function triggerShoutFling(
  id: string,
  origin: { x: number; y: number; z: number },
): void {
  if (activeFlings.has(id)) return; // already flinging
  if (activeRagdolls.has(id)) return; // dead ragdoll takes priority
  const grp = otherPlayers[id];
  if (!grp) return;

  const dx = grp.position.x - origin.x;
  const dz = grp.position.z - origin.z;
  const dist = Math.max(0.3, Math.sqrt(dx * dx + dz * dz));
  const nx = dx / dist;
  const nz = dz / dist;
  // Use same force values as backend KNOCK_H / KNOCK_V
  const hForce = 26;

  const limbs: LimbAnim[] = [];
  for (const name of LIMB_NAMES) {
    const lg = grp.getObjectByName(name) as THREE.Group | undefined;
    if (lg) {
      limbs.push({
        group: lg,
        angVelX: (Math.random() - 0.5) * 6,
        angVelZ: (Math.random() - 0.5) * 3,
      });
    }
  }

  activeFlings.set(id, {
    group: grp,
    limbs,
    velX: nx * hForce,
    velY: 14,
    velZ: nz * hForce,
    angVelX: (Math.random() - 0.5) * 12,
    angVelZ: (Math.random() - 0.5) * 8,
    elapsed: 0,
    origPos: grp.position.clone(),
    origRot: grp.rotation.clone(),
  });
}

export function updateFlings(delta: number): void {
  for (const [id, f] of activeFlings) {
    f.elapsed += delta;

    if (f.elapsed < FLING_DURATION) {
      // Flying phase
      f.velY -= RAGDOLL_GRAVITY * delta;
      f.group.position.x += f.velX * delta;
      f.group.position.z += f.velZ * delta;
      f.group.position.y += f.velY * delta;

      // Horizontal friction matching the victim's real knockback
      f.velX -= f.velX * FLING_FRICTION * delta;
      f.velZ -= f.velZ * FLING_FRICTION * delta;

      if (f.group.position.y <= GROUND_Y) {
        f.group.position.y = GROUND_Y;
        f.velY = Math.abs(f.velY) * 0.3;
        f.velX *= 0.5;
        f.velZ *= 0.5;
      }

      f.group.rotation.x += f.angVelX * delta;
      f.group.rotation.z += f.angVelZ * delta;
      const drag = Math.pow(0.3, delta);
      f.angVelX *= drag;
      f.angVelZ *= drag;

      for (const l of f.limbs) {
        l.group.rotation.x += l.angVelX * delta;
        l.group.rotation.z += l.angVelZ * delta;
        l.angVelX *= drag;
        l.angVelZ *= drag;
        l.group.rotation.x = THREE.MathUtils.clamp(l.group.rotation.x, -Math.PI * 0.5, Math.PI * 0.5);
        l.group.rotation.z = THREE.MathUtils.clamp(l.group.rotation.z, -Math.PI * 0.3, Math.PI * 0.3);
      }
    } else {
      // Recovery phase — stand upright at the landing spot (no position reset)
      const rT = Math.min((f.elapsed - FLING_DURATION) / FLING_RECOVER, 1);
      f.group.rotation.x = THREE.MathUtils.lerp(f.group.rotation.x, 0, rT);
      f.group.rotation.z = THREE.MathUtils.lerp(f.group.rotation.z, 0, rT);
      f.group.position.y = THREE.MathUtils.lerp(f.group.position.y, GROUND_Y, rT);

      for (const l of f.limbs) {
        l.group.rotation.x = THREE.MathUtils.lerp(l.group.rotation.x, 0, rT);
        l.group.rotation.z = THREE.MathUtils.lerp(l.group.rotation.z, 0, rT);
      }

      if (rT >= 1) {
        // Keep current XZ position, just reset rotation to upright
        f.group.rotation.set(0, f.group.rotation.y, 0);
        f.group.position.y = GROUND_Y;
        for (const l of f.limbs) l.group.rotation.set(0, 0, 0);
        activeFlings.delete(id);
      }
    }
  }
}

export function triggerRagdoll(
  id: string,
  cause: "bullet" | "grenade" = "bullet",
  explosionPos?: { x: number; y: number; z: number },
) {
  cleanupRagdoll(id);
  const grp = otherPlayers[id];
  if (!grp) return;
  grp.visible = true;

  // Hide name sprite during ragdoll
  const ns = grp.getObjectByName("nameSprite");
  if (ns) ns.visible = false;

  // Collect limb groups
  const limbs: LimbAnim[] = [];
  for (const name of LIMB_NAMES) {
    const lg = grp.getObjectByName(name) as THREE.Group | undefined;
    if (lg) {
      limbs.push({
        group: lg,
        angVelX: (Math.random() - 0.5) * 8,
        angVelZ: (Math.random() - 0.5) * 4,
      });
    }
  }

  let velX: number, velY: number, velZ: number;
  let angSpeed: number;

  if (cause === "grenade" && explosionPos) {
    // Launch AWAY from explosion with force
    const dx = grp.position.x - explosionPos.x;
    const dz = grp.position.z - explosionPos.z;
    const dist = Math.max(0.3, Math.sqrt(dx * dx + dz * dz));
    const nx = dx / dist;
    const nz = dz / dist;
    const force = 16 + Math.random() * 10; // strong horizontal blast
    velX = nx * force;
    velZ = nz * force;
    velY = 12 + Math.random() * 8; // high arc
    angSpeed = 18 + Math.random() * 10; // fast spin
    // Extra crazy limb spin for grenade
    for (const l of limbs) {
      l.angVelX *= 4;
      l.angVelZ *= 4;
    }
  } else {
    // Bullet: moderate topple
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2;
    velX = Math.cos(angle) * speed;
    velZ = Math.sin(angle) * speed;
    velY = 1.5 + Math.random() * 1.5;
    angSpeed = 3 + Math.random() * 3;
  }

  const tiltDir = Math.random() < 0.5 ? 1 : -1;

  activeRagdolls.set(id, {
    playerId: id,
    group: grp,
    limbs,
    velX,
    velY,
    velZ,
    angVelX: tiltDir * angSpeed,
    angVelY: (Math.random() - 0.5) * 3,
    angVelZ: (Math.random() - 0.5) * angSpeed * 0.5,
    bouncesLeft: cause === "grenade" ? 3 : 2,
    settled: false,
    elapsed: 0,
  });
}

export function cleanupRagdoll(id: string) {
  const r = activeRagdolls.get(id);
  if (!r) return;
  r.group.rotation.set(0, 0, 0);
  r.group.position.y = 1;
  for (const l of r.limbs) {
    l.group.rotation.set(0, 0, 0);
  }
  const ns = r.group.getObjectByName("nameSprite");
  if (ns) ns.visible = true;
  activeRagdolls.delete(id);
}

export function updateRagdolls(delta: number) {
  for (const [, r] of activeRagdolls) {
    r.elapsed += delta;

    if (!r.settled) {
      // ── Gravity ──────────────────────────────────────────────────────────
      r.velY -= RAGDOLL_GRAVITY * delta;

      // ── Translate ────────────────────────────────────────────────────────
      r.group.position.x += r.velX * delta;
      r.group.position.z += r.velZ * delta;
      r.group.position.y += r.velY * delta;

      // ── Ground bounce ────────────────────────────────────────────────────
      if (r.group.position.y <= GROUND_Y) {
        r.group.position.y = GROUND_Y;

        if (r.bouncesLeft > 0 && Math.abs(r.velY) > 1.0) {
          r.velY = Math.abs(r.velY) * BOUNCE_RESTITUTION;
          r.velX *= 0.5;
          r.velZ *= 0.5;
          r.angVelX *= 0.4;
          r.angVelY *= 0.4;
          r.angVelZ *= 0.4;
          for (const l of r.limbs) {
            l.angVelX *= 0.4;
            l.angVelZ *= 0.4;
          }
          r.bouncesLeft--;
        } else {
          r.velY = 0;
          r.settled = true;
        }
      }

      // ── Whole-body rotation ──────────────────────────────────────────────
      r.group.rotation.x += r.angVelX * delta;
      r.group.rotation.y += r.angVelY * delta;
      r.group.rotation.z += r.angVelZ * delta;

      // Air drag on angular vel
      const angDrag = Math.pow(0.3, delta);
      r.angVelX *= angDrag;
      r.angVelY *= angDrag;
      r.angVelZ *= angDrag;
    }

    // Once settled: heavy friction to stop everything
    if (r.settled) {
      const friction = Math.pow(0.02, delta);
      r.velX *= friction;
      r.velZ *= friction;
      r.angVelX *= friction;
      r.angVelY *= friction;
      r.angVelZ *= friction;
      r.group.rotation.x += r.angVelX * delta;
      r.group.rotation.y += r.angVelY * delta;
      r.group.rotation.z += r.angVelZ * delta;
    }

    // ── Limb flop ────────────────────────────────────────────────────────
    for (const l of r.limbs) {
      l.group.rotation.x += l.angVelX * delta;
      l.group.rotation.z += l.angVelZ * delta;
      const limbDamp = r.settled ? Math.pow(0.03, delta) : Math.pow(0.4, delta);
      l.angVelX *= limbDamp;
      l.angVelZ *= limbDamp;
      l.group.rotation.x = THREE.MathUtils.clamp(
        l.group.rotation.x,
        -Math.PI * 0.7,
        Math.PI * 0.7,
      );
      l.group.rotation.z = THREE.MathUtils.clamp(
        l.group.rotation.z,
        -Math.PI * 0.4,
        Math.PI * 0.4,
      );
    }

    // Body stays on the ground until respawn – no auto-hide / no fade
  }
}

// ─── Floating Damage Numbers ──────────────────────────────────────────────────

interface FloatingNumber {
  sprite: THREE.Sprite;
  velY: number;
  elapsed: number;
  lifetime: number;
}

const activeFloats: FloatingNumber[] = [];

function makeDamageSprite(damage: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 64);
  ctx.font = "bold 44px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Dark outline for readability
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 6;
  ctx.strokeText(`-${damage}`, 64, 34);
  // Fill: red for big damage, orange for mid, yellow for small
  ctx.fillStyle =
    damage >= 100 ? "#ff3300" : damage >= 50 ? "#ff7700" : "#ffdd00";
  ctx.fillText(`-${damage}`, 64, 34);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

export function showDamageNumber(id: string, damage: number): void {
  const grp = otherPlayers[id];
  if (!grp || !grp.visible) return;

  const sprite = makeDamageSprite(damage);
  // Slight random horizontal spread so stacked hits don't overlap
  sprite.position.set(
    grp.position.x + (Math.random() - 0.5) * 0.5,
    grp.position.y + 2.3,
    grp.position.z + (Math.random() - 0.5) * 0.3,
  );
  scene.add(sprite);

  activeFloats.push({
    sprite,
    velY: 2.0 + Math.random() * 0.6,
    elapsed: 0,
    lifetime: 1.1,
  });
}

export function updateFloatingDamageNumbers(delta: number): void {
  for (let i = activeFloats.length - 1; i >= 0; i--) {
    const f = activeFloats[i];
    f.elapsed += delta;

    // Float upward, decelerate
    f.sprite.position.y += f.velY * delta;
    f.velY = Math.max(0, f.velY - 3 * delta);

    // Fade out in last 50% of lifetime
    const fadeStart = f.lifetime * 0.5;
    if (f.elapsed >= fadeStart) {
      const t = (f.elapsed - fadeStart) / (f.lifetime - fadeStart);
      (f.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - t);
    }

    if (f.elapsed >= f.lifetime) {
      scene.remove(f.sprite);
      const mat = f.sprite.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
      activeFloats.splice(i, 1);
    }
  }
}
