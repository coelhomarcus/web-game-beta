import * as THREE from "three";
import { scene } from "../scene/setup";
import { syncNameSprite } from "./NameSprite";

export const otherPlayers: Record<string, THREE.Group> = {};
export const playerOriginalMaterial: Record<string, THREE.MeshStandardMaterial> = {};
export const playerCurrentNames: Record<string, string> = {};

export function makeWeapon(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
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
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.1),
    m(0x222222, 0.9),
  );
  grip.position.set(0, -0.2, 0.2);
  grip.rotation.x = -Math.PI / 8;
  g.add(grip);
  if (firstPerson) g.position.set(0.3, -0.3, -0.5);
  return g;
}

export function makeAwpModel(firstPerson: boolean): THREE.Group {
  const g = new THREE.Group();
  const m = (c: number, r = 0.5) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r });
  // Long barrel
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.1), m(0x222222));
  barrel.position.set(0, 0.02, -0.35);
  g.add(barrel);
  // Scope body
  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.3), m(0x111111, 0.9));
  scope.position.set(0, 0.1, -0.1);
  g.add(scope);
  // Scope lens (cyan tint)
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x00ffff, roughness: 0.1, metalness: 0.5 }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.1, -0.26);
  g.add(lens);
  // Stock / body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.5), m(0x8b5a2b, 0.9));
  body.position.set(0, -0.03, 0.2);
  g.add(body);
  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.09), m(0x222222, 0.9));
  grip.position.set(0, -0.18, 0.1);
  grip.rotation.x = -Math.PI / 10;
  g.add(grip);
  if (firstPerson) g.position.set(0.3, -0.32, -0.5);
  return g;
}

export function addOtherPlayer(player: {
  id: string; name: string; color: string;
  position: { x: number; y: number; z: number }; isDead: boolean;
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
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.12, 0.1),
    darkMat,
  );
  face.position.set(0, 0.0, -0.2);
  headGrp.add(face);
  headGrp.add(makeWeapon(false));
  grp.add(headGrp);

  // ── Arms ───────────────────────────────────────────────────────────────
  grp.add(makeLimb("leftArm", 0.18, 0.55, 0.18, mat, -0.35, 0.15, 0, -0.27));
  grp.add(makeLimb("rightArm", 0.18, 0.55, 0.18, mat, 0.35, 0.15, 0, -0.27));

  // ── Legs ───────────────────────────────────────────────────────────────
  grp.add(makeLimb("leftLeg", 0.2, 0.6, 0.2, mat, -0.12, -0.4, 0, -0.3));
  grp.add(makeLimb("rightLeg", 0.2, 0.6, 0.2, mat, 0.12, -0.4, 0, -0.3));

  grp.position.set(player.position.x, 1, player.position.z);
  grp.visible = !player.isDead;
  scene.add(grp);
  otherPlayers[player.id] = grp;

  syncNameSprite(grp, player.id, player.name, player.color);
}

function makeLimb(
  name: string,
  w: number, h: number, d: number,
  mat: THREE.MeshStandardMaterial,
  px: number, py: number, pz: number,
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

const blinkingPlayers: Record<string, { interval: number; toggle: boolean }> = {};

export function startInvincibleBlink(id: string, duration: number) {
  stopInvincibleBlink(id);
  let toggle = false;
  const interval = setInterval(() => {
    const orig = playerOriginalMaterial[id];
    if (!orig) { stopInvincibleBlink(id); return; }
    toggle = !toggle;
    // Toggle a blue emissive on the shared material so all body parts blink.
    orig.emissive.setHex(toggle ? 0x3399ff : 0x000000);
    orig.emissiveIntensity = toggle ? 0.6 : 0;
  }, 150);
  blinkingPlayers[id] = { interval: interval as unknown as number, toggle: false };
  setTimeout(() => stopInvincibleBlink(id), duration);
}

function stopInvincibleBlink(id: string) {
  const entry = blinkingPlayers[id];
  if (entry != null) {
    clearInterval(entry.interval);
    delete blinkingPlayers[id];
    const orig = playerOriginalMaterial[id];
    if (orig) {
      orig.emissive.setHex(0x000000);
      orig.emissiveIntensity = 0;
    }
  }
}

export function removeOtherPlayer(id: string) {
  stopInvincibleBlink(id);
  cleanupRagdoll(id);
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }
  delete playerOriginalMaterial[id];
  delete playerCurrentNames[id];
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
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
    const nx = dx / dist;
    const nz = dz / dist;
    const force = 10 + Math.random() * 6;
    velX = nx * force;
    velZ = nz * force;
    velY = 8 + Math.random() * 5;
    angSpeed = 10 + Math.random() * 6;
    // Extra crazy limb spin for grenade
    for (const l of limbs) {
      l.angVelX *= 2.5;
      l.angVelZ *= 2.5;
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
      l.group.rotation.x = THREE.MathUtils.clamp(l.group.rotation.x, -Math.PI * 0.7, Math.PI * 0.7);
      l.group.rotation.z = THREE.MathUtils.clamp(l.group.rotation.z, -Math.PI * 0.4, Math.PI * 0.4);
    }

    // Body stays on the ground until respawn – no auto-hide / no fade
  }
}
