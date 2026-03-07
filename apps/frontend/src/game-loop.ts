import * as THREE from "three";
import { PLAYER_HEIGHT } from "./config";
import { scene, camera, renderer } from "./scene/setup";
import { socket } from "./network/socket";
import { controls, getIsDead, getGameStarted } from "./systems/input";
import { updatePhysics } from "./systems/physics";
import { updateBullets, updateAmmo } from "./systems/shooting";
import { updateGrenade } from "./systems/grenade";
import { updateMinimap } from "./ui/minimap";
import { getMyId } from "./network/events";
import { updateRagdolls, updateFlings } from "./player/PlayerModel";
import { updateAbilityItems } from "./systems/abilities";
import {
  updateRagdolls,
  updateFloatingDamageNumbers,
  updatePlayerAnimations,
} from "./player/PlayerModel";
import { removeBobOffset, applyBobOffset } from "./systems/headBob";

const _fwd = new THREE.Vector3();
let prevTime = performance.now();

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
      const bodyY = camera.position.y - PLAYER_HEIGHT + 1;
      // Derive yaw/pitch from forward vector to avoid Euler decomposition flips
      const fwd = _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const yaw = Math.atan2(-fwd.x, -fwd.z);
      const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
      socket.emit("update_state", {
        position: { x: camera.position.x, y: bodyY, z: camera.position.z },
        rotation: { x: pitch, y: yaw, z: 0 },
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
  updatePlayerAnimations(delta);
  updateFloatingDamageNumbers(delta);

  updateMinimap();
  renderer.render(scene, camera);
}
