import * as THREE from "three";
import { otherPlayers } from "./playerState";
import { isRagdollActive } from "./ragdollSystem";

// ─── Animation constants (exported for playerBody to use when building rigs) ──

export const ARM_HOLD_LEFT = 1.0; // ~57° forward — left arm supports barrel
export const ARM_HOLD_RIGHT = 0.81; // ~46° forward-down — right hand grips trigger

const ARM_SWING = 0.22; // arm swing amplitude (radians)
const LEG_SWING = 0.7; // leg swing amplitude (radians)
const WALK_SPEED_3P = 12; // oscillations per second
const ANIM_LERP = 10; // smoothing speed for limb transitions
const SPEED_THRESHOLD = 0.3; // minimum speed to count as "walking"

// ─── Per-player walk state ────────────────────────────────────────────────────

interface WalkState {
  timer: number;
  lastPos: THREE.Vector3;
  smoothSpeed: number;
}

export const walkState: Map<string, WalkState> = new Map();

// ─── Main update ──────────────────────────────────────────────────────────────

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

    const blend = Math.min(1, ws.smoothSpeed / 3);
    const lerpFactor = Math.min(1, delta * ANIM_LERP);

    const la = grp.getObjectByName("leftArm") as THREE.Group | null;
    const ra = grp.getObjectByName("rightArm") as THREE.Group | null;
    const ll = grp.getObjectByName("leftLeg") as THREE.Group | null;
    const rl = grp.getObjectByName("rightLeg") as THREE.Group | null;
    const wep = grp.getObjectByName("weapon3p") as THREE.Group | null;

    const sinPhase = Math.sin(ws.timer);

    // Arms swing opposite to their corresponding leg (natural gait)
    if (la) {
      const t = ARM_HOLD_LEFT + sinPhase * ARM_SWING * blend;
      la.rotation.x += (t - la.rotation.x) * lerpFactor;
    }
    if (ra) {
      const t = ARM_HOLD_RIGHT - sinPhase * ARM_SWING * blend;
      ra.rotation.x += (t - ra.rotation.x) * lerpFactor;
    }
    if (ll) {
      const t = sinPhase * LEG_SWING * blend;
      ll.rotation.x += (t - ll.rotation.x) * lerpFactor;
    }
    if (rl) {
      const t = -sinPhase * LEG_SWING * blend;
      rl.rotation.x += (t - rl.rotation.x) * lerpFactor;
    }
    // Weapon pitches slightly with right arm for a natural look
    if (wep && ra) {
      wep.rotation.x = (ra.rotation.x - ARM_HOLD_RIGHT) * 0.5;
    }
  }
}
