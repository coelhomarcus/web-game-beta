import { PLAYER_HEIGHT } from "./config";
import { scene, camera, renderer } from "./scene/setup";
import { socket } from "./network/socket";
import { controls, getIsDead } from "./systems/input";
import { updatePhysics } from "./systems/physics";
import { updateBullets, updateAmmo } from "./systems/shooting";
import { updateGrenade } from "./systems/grenade";
import { getMyId } from "./network/events";

let prevTime = performance.now();

export function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.05);
  prevTime = time;

  const isDead = getIsDead();
  const myId = getMyId();

  if (controls.isLocked && !isDead) {
    updatePhysics(controls, delta);

    if (myId) {
      const bodyY = camera.position.y - PLAYER_HEIGHT + 1;
      socket.emit("update_state", {
        position: { x: camera.position.x, y: bodyY, z: camera.position.z },
        rotation: { x: camera.rotation.x, y: camera.rotation.y, z: 0 },
      });
    }
  }

  updateBullets(delta);
  updateAmmo(delta);
  updateGrenade(delta);

  renderer.render(scene, camera);
}
