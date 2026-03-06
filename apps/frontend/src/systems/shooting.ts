import * as THREE from "three";
import { BULLET_SPEED, BULLET_MAX_LIFETIME, BULLET_RADIUS } from "../config";
import { scene, camera } from "../scene/setup";
import { mapBlocks } from "../scene/map";
import { otherPlayers } from "../player/PlayerModel";
import { socket } from "../network/socket";
import { playShootSound } from "./audio";
import { showHitMarker } from "../ui/overlays";

const activeBullets: {
  mesh: THREE.Mesh;
  dir: THREE.Vector3;
  lifeTime: number;
}[] = [];
const bulletGeo = new THREE.SphereGeometry(0.06, 6, 6);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe000 });

export function createVisualBullet(origin: THREE.Vector3, dir: THREE.Vector3) {
  const mesh = new THREE.Mesh(bulletGeo, bulletMat);
  mesh.position.copy(origin);
  scene.add(mesh);
  activeBullets.push({ mesh, dir: dir.clone().normalize(), lifeTime: 0 });
}

const raycaster = new THREE.Raycaster();
raycaster.near = 0.1;

function findPlayerGroup(o: THREE.Object3D): THREE.Group | null {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (
      cur instanceof THREE.Group &&
      Object.values(otherPlayers).includes(cur as THREE.Group)
    )
      return cur;
    cur = cur.parent;
  }
  return null;
}

export function handleShoot(isDead: boolean, controls: { isLocked: boolean }) {
  if (!controls.isLocked || isDead) return;
  playShootSound();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const allTargets = [
    ...Object.values(otherPlayers),
    ...mapBlocks,
  ];
  const hits = raycaster.intersectObjects(allTargets, true);
  const firstPlayerHit = hits.find((h) => findPlayerGroup(h.object) !== null);
  if (firstPlayerHit) {
    const wallHit = hits.find((h) => mapBlocks.includes(h.object as THREE.Mesh));
    const playerBlocked = wallHit && wallHit.distance < firstPlayerHit.distance;
    if (!playerBlocked) {
      const grp = findPlayerGroup(firstPlayerHit.object)!;
      const tid = Object.keys(otherPlayers).find(
        (id) => otherPlayers[id] === grp,
      );
      if (tid) {
        socket.emit("hit_player", { targetId: tid });
        showHitMarker();
      }
    }
  }
  const orig = new THREE.Vector3();
  camera.getWorldPosition(orig);
  orig.y -= 0.1;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  createVisualBullet(orig, dir);
  socket.emit("shoot", {
    origin: { x: orig.x, y: orig.y, z: orig.z },
    direction: { x: dir.x, y: dir.y, z: dir.z },
  });
}

function bulletHitsBlock(pos: THREE.Vector3): boolean {
  for (const box of mapBlocks) {
    const geo = box.geometry as THREE.BoxGeometry;
    const hw = geo.parameters.width / 2 + BULLET_RADIUS;
    const hh = geo.parameters.height / 2 + BULLET_RADIUS;
    const hd = geo.parameters.depth / 2 + BULLET_RADIUS;
    if (
      Math.abs(pos.x - box.position.x) < hw &&
      Math.abs(pos.y - box.position.y) < hh &&
      Math.abs(pos.z - box.position.z) < hd
    )
      return true;
  }
  return false;
}

export function updateBullets(delta: number) {
  for (let i = activeBullets.length - 1; i >= 0; i--) {
    const b = activeBullets[i];
    const step = BULLET_SPEED * delta;
    const nextPos = b.mesh.position.clone().addScaledVector(b.dir, step);

    if (bulletHitsBlock(nextPos)) {
      scene.remove(b.mesh);
      activeBullets.splice(i, 1);
      continue;
    }

    b.mesh.position.copy(nextPos);
    b.lifeTime += delta;
    if (b.lifeTime > BULLET_MAX_LIFETIME || b.mesh.position.y <= 0) {
      scene.remove(b.mesh);
      activeBullets.splice(i, 1);
    }
  }
}
