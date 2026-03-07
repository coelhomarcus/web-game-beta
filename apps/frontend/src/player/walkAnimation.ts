import * as THREE from "three";
import { otherPlayers, networkTargets } from "./playerState";
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

// Track which remote players are sliding (set from events.ts game_state)
export const slidingPlayers: Set<string> = new Set();

const SLIDE_TORSO_TILT = -0.7; // lean backward (radians)
const SLIDE_LEG_EXTEND = 1.2; // legs kicked forward
const SLIDE_ARM_UP = 0.5; // arms stay raised
const SLIDE_LERP = 8; // how fast to blend into/out of slide pose
const SLIDE_BODY_DROP = 0.55; // how far the 3P body drops during slide

// Per-player smooth slide Y offset (0 → SLIDE_BODY_DROP)
const slideYOffset: Map<string, number> = new Map();

// ─── Main update ──────────────────────────────────────────────────────────────

export function updatePlayerAnimations(delta: number): void {
  for (const id in otherPlayers) {
    if (isRagdollActive(id)) continue;
    const grp = otherPlayers[id];
    if (!grp.visible) {
      walkState.delete(id);
      networkTargets.delete(id);
      slideYOffset.delete(id);
      continue;
    }

    // ── Per-frame position interpolation (smooth 60fps, not just on tick) ──
    const target = networkTargets.get(id);
    const sliding = slidingPlayers.has(id);
    if (target) {
      const posLerp = Math.min(1, delta * 12); // ~12/s → smooth catch-up
      // Lerp X/Z always; handle Y separately so we can drop it during slides
      grp.position.x += (target.x - grp.position.x) * posLerp;
      grp.position.z += (target.z - grp.position.z) * posLerp;
      if (!sliding) {
        grp.position.y += (target.y - grp.position.y) * posLerp;
      }
    }

    // ── Smooth slide body drop ───────────────────────────────────────────────
    let curSlideY = slideYOffset.get(id) ?? 0;
    const slideYTarget = sliding ? SLIDE_BODY_DROP : 0;
    curSlideY += (slideYTarget - curSlideY) * Math.min(1, delta * SLIDE_LERP);
    if (Math.abs(curSlideY - slideYTarget) < 0.001) curSlideY = slideYTarget;
    slideYOffset.set(id, curSlideY);
    grp.position.y = (target ? target.y : grp.position.y) - curSlideY;

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
    const torso = grp.getObjectByName("torso") as THREE.Mesh | null;

    const sLerp = Math.min(1, delta * SLIDE_LERP);

    if (sliding) {
      // Slide pose: torso tilts back, legs extend forward, arms stay up
      if (torso)
        torso.rotation.x += (SLIDE_TORSO_TILT - torso.rotation.x) * sLerp;
      if (la)
        la.rotation.x += (ARM_HOLD_LEFT + SLIDE_ARM_UP - la.rotation.x) * sLerp;
      if (ra)
        ra.rotation.x +=
          (ARM_HOLD_RIGHT + SLIDE_ARM_UP - ra.rotation.x) * sLerp;
      if (ll) ll.rotation.x += (SLIDE_LEG_EXTEND - ll.rotation.x) * sLerp;
      if (rl) rl.rotation.x += (SLIDE_LEG_EXTEND - rl.rotation.x) * sLerp;
      if (wep && ra) wep.rotation.x = (ra.rotation.x - ARM_HOLD_RIGHT) * 0.5;
    } else {
      // Normal walk animation
      if (torso) torso.rotation.x += (0 - torso.rotation.x) * sLerp;

      const sinPhase = Math.sin(ws.timer);

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
      if (wep && ra) {
        wep.rotation.x = (ra.rotation.x - ARM_HOLD_RIGHT) * 0.5;
      }
    }
  }
}
