import * as THREE from "three";
import { otherPlayers } from "./playerState";

// ─── Constants ────────────────────────────────────────────────────────────────

const RAGDOLL_GRAVITY = 22;
const GROUND_Y = 0.0;
const BOUNCE_RESTITUTION = 0.3;

const FLING_DURATION = 1.4; // seconds until recovery starts
const FLING_RECOVER = 0.35; // lerp-back duration
const FLING_FRICTION = 1.8; // must match KNOCKBACK_FRICTION in physics.ts

export const LIMB_NAMES = [
  "headGroup",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
];

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── Active simulations ───────────────────────────────────────────────────────

const activeRagdolls: Map<string, RagdollSim> = new Map();
const activeFlings: Map<string, FlingAnim> = new Map();

// ─── Ragdoll ──────────────────────────────────────────────────────────────────

export function isRagdollActive(id: string): boolean {
  return activeRagdolls.has(id);
}

export function triggerRagdoll(
  id: string,
  cause: "bullet" | "grenade" = "bullet",
  explosionPos?: { x: number; y: number; z: number },
): void {
  cleanupRagdoll(id);
  const grp = otherPlayers[id];
  if (!grp) return;
  grp.visible = true;

  const ns = grp.getObjectByName("nameSprite");
  if (ns) ns.visible = false;

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
    const dx = grp.position.x - explosionPos.x;
    const dz = grp.position.z - explosionPos.z;
    const dist = Math.max(0.3, Math.sqrt(dx * dx + dz * dz));
    const nx = dx / dist;
    const nz = dz / dist;
    const force = 16 + Math.random() * 10;
    velX = nx * force;
    velZ = nz * force;
    velY = 12 + Math.random() * 8;
    angSpeed = 18 + Math.random() * 10;
    for (const l of limbs) {
      l.angVelX *= 4;
      l.angVelZ *= 4;
    }
  } else {
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

export function cleanupRagdoll(id: string): void {
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

export function updateRagdolls(delta: number): void {
  for (const [, r] of activeRagdolls) {
    r.elapsed += delta;

    if (!r.settled) {
      r.velY -= RAGDOLL_GRAVITY * delta;
      r.group.position.x += r.velX * delta;
      r.group.position.z += r.velZ * delta;
      r.group.position.y += r.velY * delta;

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

      r.group.rotation.x += r.angVelX * delta;
      r.group.rotation.y += r.angVelY * delta;
      r.group.rotation.z += r.angVelZ * delta;

      const angDrag = Math.pow(0.3, delta);
      r.angVelX *= angDrag;
      r.angVelY *= angDrag;
      r.angVelZ *= angDrag;
    }

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
  }
}

// ─── Shout fling (non-lethal ragdoll-lite) ────────────────────────────────────

export function isFlinging(id: string): boolean {
  return activeFlings.has(id);
}

/**
 * Triggers a temporary "fling" on another player's model.
 * The body flies away from `origin` for ~1.4 s then snaps back upright.
 */
export function triggerShoutFling(
  id: string,
  origin: { x: number; y: number; z: number },
): void {
  if (activeFlings.has(id)) return;
  if (activeRagdolls.has(id)) return;
  const grp = otherPlayers[id];
  if (!grp) return;

  const dx = grp.position.x - origin.x;
  const dz = grp.position.z - origin.z;
  const dist = Math.max(0.3, Math.sqrt(dx * dx + dz * dz));
  const nx = dx / dist;
  const nz = dz / dist;
  const hForce = 26; // matches backend KNOCK_H

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
      f.velY -= RAGDOLL_GRAVITY * delta;
      f.group.position.x += f.velX * delta;
      f.group.position.z += f.velZ * delta;
      f.group.position.y += f.velY * delta;

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
        l.group.rotation.x = THREE.MathUtils.clamp(
          l.group.rotation.x,
          -Math.PI * 0.5,
          Math.PI * 0.5,
        );
        l.group.rotation.z = THREE.MathUtils.clamp(
          l.group.rotation.z,
          -Math.PI * 0.3,
          Math.PI * 0.3,
        );
      }
    } else {
      // Recovery phase — lerp back to upright
      const rT = Math.min((f.elapsed - FLING_DURATION) / FLING_RECOVER, 1);
      f.group.rotation.x = THREE.MathUtils.lerp(f.group.rotation.x, 0, rT);
      f.group.rotation.z = THREE.MathUtils.lerp(f.group.rotation.z, 0, rT);
      f.group.position.y = THREE.MathUtils.lerp(
        f.group.position.y,
        GROUND_Y,
        rT,
      );

      for (const l of f.limbs) {
        l.group.rotation.x = THREE.MathUtils.lerp(l.group.rotation.x, 0, rT);
        l.group.rotation.z = THREE.MathUtils.lerp(l.group.rotation.z, 0, rT);
      }

      if (rT >= 1) {
        f.group.rotation.set(0, f.group.rotation.y, 0);
        f.group.position.y = GROUND_Y;
        for (const l of f.limbs) l.group.rotation.set(0, 0, 0);
        activeFlings.delete(id);
      }
    }
  }
}
