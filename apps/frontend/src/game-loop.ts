import * as THREE from "three";
import { PLAYER_HEIGHT } from "./config";
import { scene, camera, renderer } from "./scene/setup";
import { sceneFog } from "./scene/setup";
import { socket } from "./network/socket";
import { controls, getIsDead, getGameStarted } from "./systems/input";
import {
  updatePhysics,
  isSliding,
  getSlideHeightOffset,
} from "./systems/physics";
import { updateBullets, updateAmmo } from "./systems/shooting";
import { updateGrenade } from "./systems/grenade";
import { updateMinimap } from "./ui/minimap";
import { getMyId } from "./network/events";
import {
  updateRagdolls,
  updateFlings,
  updateFloatingDamageNumbers,
  updatePlayerAnimations,
  getLocalCorpseGroup,
} from "./player/PlayerModel";
import { updateAbilityItems } from "./systems/abilities";
import { updateAmmoBoxes } from "./systems/ammoBoxes";
import { removeBobOffset, applyBobOffset } from "./systems/headBob";
import { updateStats } from "./ui/stats";

const _fwd = new THREE.Vector3();
let prevTime = performance.now();

// ── Death camera (third-person orbiting the local corpse) ─────────────────────
const deathCam = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  300,
);
let _deathCamAngle = 0;
let _wasDead = false;
const DEATH_CAM_DIST = 5;
const DEATH_CAM_HEIGHT = 2.5;
const DEATH_CAM_ORBIT_SPEED = 0.3;

// ── Overview camera (start screen background) ─────────────────────────────────
const overviewCam = new THREE.PerspectiveCamera(
  85,
  window.innerWidth / window.innerHeight,
  0.5,
  300,
);
let _overviewAngle = Math.PI * 0.25;
const OVERVIEW_RADIUS = 8; // near-top-down, slight orbit
const OVERVIEW_HEIGHT = 30;
const OVERVIEW_SPEED = 0.04; // rad/s — slow lazy orbit around map center

window.addEventListener("resize", () => {
  overviewCam.aspect = window.innerWidth / window.innerHeight;
  overviewCam.updateProjectionMatrix();
  deathCam.aspect = window.innerWidth / window.innerHeight;
  deathCam.updateProjectionMatrix();
});

export function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.05);
  prevTime = time;

  const isDead = getIsDead();
  const myId = getMyId();

  const active = getGameStarted() && !isDead;

  removeBobOffset(); // strip last frame's bob so physics sees real player Y

  if (active) {
    updatePhysics(controls, delta);

    if (myId) {
      const bodyY =
        camera.position.y - PLAYER_HEIGHT + 1 + getSlideHeightOffset();
      // Derive yaw/pitch from forward vector to avoid Euler decomposition flips
      const fwd = _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const yaw = Math.atan2(-fwd.x, -fwd.z);
      const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
      socket.emit("update_state", {
        position: { x: camera.position.x, y: bodyY, z: camera.position.z },
        rotation: { x: pitch, y: yaw, z: 0 },
        isSliding,
      });
    }
  }

  applyBobOffset(delta, active); // re-apply bob after physics & emit

  updateBullets(delta);
  updateAmmo(delta);
  updateGrenade(delta);
  updateRagdolls(delta);
  updateFlings(delta);
  updateAbilityItems(delta);
  updateAmmoBoxes(delta);
  updatePlayerAnimations(delta);
  updateFloatingDamageNumbers(delta);

  updateMinimap();
  updateStats(delta);

  // ── Death camera: detect transition and orbit corpse ──────────────────────
  if (isDead && !_wasDead) {
    // Just died — initialize death cam angle behind the player's look direction
    const camFwd = _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _deathCamAngle = Math.atan2(-camFwd.x, -camFwd.z);
    // Hide FP weapon & arms (children of camera)
    for (const child of camera.children) child.visible = false;
  }
  if (!isDead && _wasDead) {
    // Just respawned — restore FP weapon & arms visibility
    for (const child of camera.children) child.visible = true;
  }
  _wasDead = isDead;

  if (!getGameStarted()) {
    // Slowly orbit the map top-down for the start screen background
    _overviewAngle += delta * OVERVIEW_SPEED;
    overviewCam.position.set(
      Math.sin(_overviewAngle) * OVERVIEW_RADIUS,
      OVERVIEW_HEIGHT,
      Math.cos(_overviewAngle) * OVERVIEW_RADIUS,
    );
    overviewCam.lookAt(0, 0, 0);
    // Disable fog — camera is above fog range, scene would be invisible
    scene.fog = null;
    renderer.render(scene, overviewCam);
    scene.fog = sceneFog;
  } else if (isDead) {
    const corpse = getLocalCorpseGroup();
    if (corpse) {
      _deathCamAngle += delta * DEATH_CAM_ORBIT_SPEED;
      deathCam.position.set(
        corpse.position.x + Math.sin(_deathCamAngle) * DEATH_CAM_DIST,
        corpse.position.y + DEATH_CAM_HEIGHT,
        corpse.position.z + Math.cos(_deathCamAngle) * DEATH_CAM_DIST,
      );
      deathCam.lookAt(
        corpse.position.x,
        corpse.position.y + 0.5,
        corpse.position.z,
      );
    }
    renderer.render(scene, deathCam);
  } else {
    renderer.render(scene, camera);
  }
}
